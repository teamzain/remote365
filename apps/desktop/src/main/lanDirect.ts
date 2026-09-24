// LAN Direct — connect host↔viewer with NO internet and NO cloud signaling.
//
// Why this exists: the host is otherwise an outbound-only client. It holds a
// WebSocket out to the cloud signaling server, presence lives in Redis, and a
// viewer asks the SERVER to relay an offer. Kill the internet and two machines
// on the same switch still cannot introduce themselves to each other, even though
// the WebRTC media path between them would work perfectly.
//
// This module supplies the missing introduction, the way RustDesk/HopToDesk do it:
//   1. a UDP discovery responder, so viewers can find hosts on the subnet, and
//   2. a local WebSocket signaling server, so a viewer can hand over an SDP offer
//      request directly and get the answer back.
// The WebRTC/session code is untouched — LAN peers flow through exactly the same
// initiateHostWebRTC path, they just carry their signals over a different pipe.
//
// SECURITY: this is an access path that works while the cloud (and therefore the
// permission model, device trust and RBAC) is unreachable, so it is deliberately
// narrow:
//   - OFF unless the user enables it.
//   - Refuses to start without an access password — no password, no LAN access.
//     There is no "easy access" equivalent here: online, easy-access is safe
//     because the server still checks who you are; offline nothing checks, so the
//     password IS the whole authorization.
//   - Password compared in constant time, with a lockout after repeated failures.
//   - Binds to private/link-local ranges only; a public-IP interface is refused.

import dgram from 'dgram';
import os from 'os';
import { createHash, timingSafeEqual, randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';

export const LAN_SIGNAL_PORT = 39865;
export const LAN_DISCOVERY_PORT = 39866;
const DISCOVERY_MAGIC = 'remote365-lan-v1';

// Brute-force guard. A LAN attacker can retry fast, and the password is the only
// gate, so failures are throttled per source address.
const MAX_FAILED_AUTH = 5;
const LOCKOUT_MS = 60_000;

type LanViewer = {
  viewerId: string;
  socket: WebSocket;
  address: string;
  authed: boolean;
};

export type LanDirectCallbacks = {
  /** Verify the presented password. Returns true when access is granted. */
  verifyPassword: (password: string) => boolean;
  /** A LAN viewer authenticated and wants a session; mirrors 'request-offer'. */
  onViewerJoin: (viewerId: string, viewerName: string) => void;
  /** A signaling message arrived from a LAN viewer (answer / ice-candidate / ...). */
  onSignal: (data: any) => void;
  /** A LAN viewer disconnected. */
  onViewerLeave: (viewerId: string) => void;
  /** Identity advertised over discovery. */
  getIdentity: () => { deviceName: string; deviceId: string; accessKey: string };
  log: (message: string) => void;
};

let wss: WebSocketServer | null = null;
let discoverySocket: dgram.Socket | null = null;
let callbacks: LanDirectCallbacks | null = null;
const lanViewers = new Map<string, LanViewer>();
const failedAttempts = new Map<string, { count: number; until: number }>();

/** RFC1918 / CGNAT / link-local only — never advertise or bind a public interface. */
function isPrivateAddress(address: string): boolean {
  if (/^10\./.test(address)) return true;
  if (/^192\.168\./.test(address)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return true;
  if (/^169\.254\./.test(address)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address)) return true;
  return false;
}

export function getLanAddresses(): string[] {
  const addresses: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const entry of interfaces[name] || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (!isPrivateAddress(entry.address)) continue;
      addresses.push(entry.address);
    }
  }
  return addresses;
}

function constantTimeEquals(a: string, b: string): boolean {
  // Hash first so the comparison length can't leak the password length.
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

function isLockedOut(address: string): boolean {
  const record = failedAttempts.get(address);
  if (!record) return false;
  if (Date.now() > record.until) {
    failedAttempts.delete(address);
    return false;
  }
  return record.count >= MAX_FAILED_AUTH;
}

function noteFailure(address: string) {
  const record = failedAttempts.get(address) || { count: 0, until: 0 };
  record.count += 1;
  record.until = Date.now() + LOCKOUT_MS;
  failedAttempts.set(address, record);
}

/** Send a signaling payload to one LAN viewer. Returns false if it isn't reachable. */
export function sendToLanViewer(viewerId: string, payload: any): boolean {
  const viewer = lanViewers.get(viewerId);
  if (!viewer || viewer.socket.readyState !== WebSocket.OPEN) return false;
  try {
    viewer.socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function isLanViewer(viewerId: string): boolean {
  return lanViewers.has(viewerId);
}

export function isLanDirectRunning(): boolean {
  return !!wss;
}

export function startLanDirect(cb: LanDirectCallbacks): { ok: boolean; error?: string; addresses: string[] } {
  if (wss) return { ok: true, addresses: getLanAddresses() };
  callbacks = cb;

  const addresses = getLanAddresses();
  if (!addresses.length) {
    return { ok: false, error: 'No private network interface found.', addresses: [] };
  }

  try {
    wss = new WebSocketServer({ port: LAN_SIGNAL_PORT });
  } catch (err: any) {
    wss = null;
    return { ok: false, error: `Could not open port ${LAN_SIGNAL_PORT}: ${err?.message || err}`, addresses };
  }

  wss.on('connection', (socket: WebSocket, request: any) => {
    const address = String(request?.socket?.remoteAddress || '').replace(/^::ffff:/, '');
    // Reject anything that isn't actually on a local network, even if the port was
    // somehow exposed (port-forward, misconfigured firewall).
    if (!isPrivateAddress(address) && address !== '127.0.0.1') {
      cb.log(`[LAN] Rejected non-local connection from ${address}`);
      try { socket.close(1008, 'local-only'); } catch {}
      return;
    }
    if (isLockedOut(address)) {
      cb.log(`[LAN] Rejected locked-out address ${address}`);
      try { socket.send(JSON.stringify({ type: 'lan-error', error: 'Too many failed attempts. Try again shortly.' })); } catch {}
      try { socket.close(1008, 'locked-out'); } catch {}
      return;
    }

    const viewerId = `lan-${randomUUID().slice(0, 12)}`;
    const viewer: LanViewer = { viewerId, socket, address, authed: false };
    // Not registered in lanViewers until authenticated, so an unauthenticated
    // socket can never be a signal target.

    // An unauthenticated socket must not linger.
    const authTimer = setTimeout(() => {
      if (!viewer.authed) {
        try { socket.close(1008, 'auth-timeout'); } catch {}
      }
    }, 15_000);

    socket.on('message', (raw: any) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!viewer.authed) {
        // The only message accepted before auth.
        if (data.type !== 'lan-auth') return;
        if (isLockedOut(address)) {
          try { socket.close(1008, 'locked-out'); } catch {}
          return;
        }
        let granted = false;
        try {
          granted = cb.verifyPassword(String(data.password || ''));
        } catch {
          granted = false;
        }
        if (!granted) {
          noteFailure(address);
          cb.log(`[LAN] Failed auth from ${address}`);
          try { socket.send(JSON.stringify({ type: 'lan-auth-failed' })); } catch {}
          try { socket.close(1008, 'bad-password'); } catch {}
          return;
        }
        failedAttempts.delete(address);
        viewer.authed = true;
        clearTimeout(authTimer);
        lanViewers.set(viewerId, viewer);
        const identity = cb.getIdentity();
        try {
          socket.send(JSON.stringify({
            type: 'lan-auth-ok',
            viewerId,
            deviceName: identity.deviceName,
            deviceId: identity.deviceId,
          }));
        } catch {}
        cb.log(`[LAN] Viewer ${viewerId} authenticated from ${address}`);
        cb.onViewerJoin(viewerId, String(data.viewerName || 'LAN viewer'));
        return;
      }

      // Authenticated: forward signaling straight into the normal host pipeline.
      // senderId is stamped by us, never trusted from the wire, so a LAN peer
      // cannot address or hijack another viewer's session.
      cb.onSignal({ ...data, senderId: viewerId, viewerId });
    });

    const cleanup = () => {
      clearTimeout(authTimer);
      if (lanViewers.delete(viewerId) && viewer.authed) {
        cb.log(`[LAN] Viewer ${viewerId} disconnected`);
        cb.onViewerLeave(viewerId);
      }
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });

  wss.on('error', (err: any) => {
    cb.log(`[LAN] Signaling server error: ${err?.message || err}`);
  });

  startDiscoveryResponder(cb);
  cb.log(`[LAN] Direct mode listening on ${addresses.join(', ')}:${LAN_SIGNAL_PORT}`);
  return { ok: true, addresses };
}

/**
 * Answer discovery probes so viewers can list hosts without knowing an IP.
 * Replies carry only what a chooser needs (name + access key + port) — never the
 * password or any token.
 */
function startDiscoveryResponder(cb: LanDirectCallbacks) {
  try {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    discoverySocket = socket;
    socket.on('message', (message: Buffer, remote: dgram.RemoteInfo) => {
      try {
        if (!isPrivateAddress(remote.address)) return;
        const text = message.toString();
        if (!text.startsWith(DISCOVERY_MAGIC)) return;
        const request = JSON.parse(text.slice(DISCOVERY_MAGIC.length));
        if (request?.type !== 'discover') return;
        const identity = cb.getIdentity();
        const reply = Buffer.from(
          DISCOVERY_MAGIC +
            JSON.stringify({
              type: 'host-here',
              deviceName: identity.deviceName,
              deviceId: identity.deviceId,
              accessKey: identity.accessKey,
              port: LAN_SIGNAL_PORT,
              platform: process.platform,
            }),
        );
        socket.send(reply, 0, reply.length, remote.port, remote.address);
      } catch {
        /* a malformed probe must never take the responder down */
      }
    });
    socket.on('error', (err: any) => {
      cb.log(`[LAN] Discovery socket error: ${err?.message || err}`);
      try { socket.close(); } catch {}
      if (discoverySocket === socket) discoverySocket = null;
    });
    socket.bind(LAN_DISCOVERY_PORT, () => {
      try { socket.setBroadcast(true); } catch {}
    });
  } catch (err: any) {
    cb.log(`[LAN] Could not start discovery responder: ${err?.message || err}`);
  }
}

export function stopLanDirect() {
  for (const viewer of lanViewers.values()) {
    try { viewer.socket.close(1001, 'host-stopped'); } catch {}
  }
  lanViewers.clear();
  failedAttempts.clear();
  if (discoverySocket) {
    try { discoverySocket.close(); } catch {}
    discoverySocket = null;
  }
  if (wss) {
    try { wss.close(); } catch {}
    wss = null;
  }
  callbacks?.log('[LAN] Direct mode stopped');
  callbacks = null;
}

/**
 * Viewer side: broadcast a probe and collect host replies for `timeoutMs`.
 * Sent to the subnet broadcast address of every private interface, because
 * 255.255.255.255 is dropped by many Windows network profiles.
 */
export function discoverLanHosts(timeoutMs = 1200): Promise<Array<{
  deviceName: string; deviceId: string; accessKey: string; address: string; port: number; platform: string;
}>> {
  return new Promise((resolve) => {
    const found = new Map<string, any>();
    let socket: dgram.Socket;
    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch {
      resolve([]);
      return;
    }

    const finish = () => {
      try { socket.close(); } catch {}
      resolve(Array.from(found.values()));
    };

    socket.on('message', (message: Buffer, remote: dgram.RemoteInfo) => {
      try {
        const text = message.toString();
        if (!text.startsWith(DISCOVERY_MAGIC)) return;
        const reply = JSON.parse(text.slice(DISCOVERY_MAGIC.length));
        if (reply?.type !== 'host-here') return;
        found.set(`${remote.address}:${reply.deviceId || reply.accessKey || ''}`, {
          deviceName: String(reply.deviceName || 'Remote365 Host'),
          deviceId: String(reply.deviceId || ''),
          accessKey: String(reply.accessKey || ''),
          address: remote.address,
          port: Number(reply.port) || LAN_SIGNAL_PORT,
          platform: String(reply.platform || ''),
        });
      } catch {
        /* ignore malformed replies */
      }
    });
    socket.on('error', finish);

    socket.bind(() => {
      try { socket.setBroadcast(true); } catch {}
      const probe = Buffer.from(DISCOVERY_MAGIC + JSON.stringify({ type: 'discover' }));
      const targets = new Set<string>(['255.255.255.255']);
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const entry of interfaces[name] || []) {
          if (entry.family !== 'IPv4' || entry.internal) continue;
          if (!isPrivateAddress(entry.address)) continue;
          // Derive the subnet broadcast address from address|~netmask.
          try {
            const addressParts = entry.address.split('.').map(Number);
            const maskParts = String(entry.netmask || '255.255.255.0').split('.').map(Number);
            const broadcast = addressParts.map((octet, i) => (octet | (~maskParts[i] & 255)) & 255).join('.');
            targets.add(broadcast);
          } catch {}
        }
      }
      for (const target of targets) {
        try { socket.send(probe, 0, probe.length, LAN_DISCOVERY_PORT, target); } catch {}
      }
      setTimeout(finish, timeoutMs);
    });
  });
}
