// Boot-time hosting intent — "this machine should be reachable".
//
// Why this exists: presence is established by exactly one call, main's
// connectHostSignaling(), and until now the ONLY path to it was the renderer's
// host:start IPC. The renderer only got there after two HTTP round-trips
// (/api/devices/self-register at bootstrap, then again inside handleStartHosting),
// each attempted exactly once. At boot the renderer is alive in a couple of
// seconds while Wi-Fi association, DHCP and DNS routinely take much longer, so
// those calls failed with a network error, nothing retried, and the device
// stayed Offline until a human walked over and toggled "Grant Easy Access" —
// which calls handleStartHosting() directly, bypassing the dead latches.
//
// The intent below breaks that dependency. It records the last access key this
// machine successfully hosted with, so a reboot can arm signaling immediately
// from disk with no server round-trip at all. If the network is down, main's
// existing reconnect supervisor simply keeps retrying until it isn't — the
// device comes online on its own the moment the link exists.
//
// Written on every successful host:start; cleared only when the user explicitly
// stops hosting, so "I turned it off" survives a reboot too.

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { networkInterfaces } from 'os';
import { join } from 'path';
import { app, net } from 'electron';
import log from 'electron-log';

export type HostIntent = {
  /** Last access key that registered successfully. */
  accessKey: string;
  /** Registered without a user token (nobody signed in to the app). */
  guestMode: boolean;
  serverHost: string;
  deviceName?: string;
  quality?: string;
  fps?: string;
  updatedAt?: string;
};

// Per-user, unlike the unattended credential: this drives the ordinary
// user-session host, and each Windows profile hosts as its own signed-in user.
const intentPath = () => join(app.getPath('userData'), 'host-intent.json');

export function readHostIntent(): HostIntent | null {
  try {
    const path = intentPath();
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const accessKey = String(parsed?.accessKey || '').replace(/\s/g, '');
    if (!accessKey) return null;
    return {
      accessKey,
      guestMode: Boolean(parsed?.guestMode),
      serverHost: String(parsed?.serverHost || ''),
      deviceName: parsed?.deviceName ? String(parsed.deviceName) : undefined,
      quality: parsed?.quality ? String(parsed.quality) : undefined,
      fps: parsed?.fps ? String(parsed.fps) : undefined,
      updatedAt: parsed?.updatedAt ? String(parsed.updatedAt) : undefined,
    };
  } catch (err: any) {
    log.warn(`[Autostart] Could not read host intent: ${err?.message || err}`);
    return null;
  }
}

export function saveHostIntent(intent: Omit<HostIntent, 'updatedAt'>) {
  if (!intent.accessKey) return;
  try {
    const existing = readHostIntent();
    // Only rewrite on a real change — this is called on every host:start and a
    // reconnect loop must not hammer the disk.
    if (
      existing &&
      existing.accessKey === intent.accessKey &&
      existing.guestMode === intent.guestMode &&
      existing.serverHost === intent.serverHost &&
      existing.deviceName === intent.deviceName &&
      existing.quality === intent.quality &&
      existing.fps === intent.fps
    ) {
      return;
    }
    writeFileSync(intentPath(), JSON.stringify({ ...intent, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    log.info(`[Autostart] Host intent saved (device ${intent.accessKey}${intent.guestMode ? ', guest' : ''}).`);
  } catch (err: any) {
    log.warn(`[Autostart] Could not save host intent: ${err?.message || err}`);
  }
}

export function clearHostIntent(reason: string) {
  try {
    const path = intentPath();
    if (!existsSync(path)) return;
    unlinkSync(path);
    log.info(`[Autostart] Host intent cleared (${reason}).`);
  } catch (err: any) {
    log.warn(`[Autostart] Could not clear host intent: ${err?.message || err}`);
  }
}

/**
 * Is there any usable network link right now?
 *
 * net.isOnline() is the accurate answer (Chromium's own connectivity state) but
 * it can throw or be unavailable before the network service is up, so a plain
 * interface scan backs it up. APIPA addresses (169.254.x — DHCP failed) and
 * loopback don't count as a link.
 */
export function hasNetworkLink(): boolean {
  try {
    if (net.isOnline()) return true;
  } catch { /* fall through to the interface scan */ }
  try {
    return Object.values(networkInterfaces())
      .flat()
      .some((iface: any) => iface && !iface.internal && iface.address && !String(iface.address).startsWith('169.254.'));
  } catch {
    // Can't tell — assume there is a link so callers still attempt to connect.
    return true;
  }
}

/**
 * Fire `onRestore` when the machine goes from "no link" to "link".
 *
 * Without this the reconnect backoff decides how fast a host recovers, so a PC
 * that booted before its Wi-Fi associated could sit offline for another 30s
 * after the network was perfectly usable. Polling (rather than an OS event) is
 * deliberate: it costs nothing measurable and it also catches the cases no event
 * fires for — a VPN adapter coming up, a captive portal releasing, a docking
 * station's NIC replacing Wi-Fi.
 */
export function startNetworkRestoreWatcher(onRestore: () => void, intervalMs = 5000): NodeJS.Timeout {
  let lastLink = hasNetworkLink();
  const timer = setInterval(() => {
    const link = hasNetworkLink();
    if (link && !lastLink) {
      log.info('[Autostart] Network link restored — waking the host connection.');
      lastLink = link;
      try { onRestore(); } catch (err: any) { log.warn(`[Autostart] Network-restore handler failed: ${err?.message || err}`); }
      return;
    }
    lastLink = link;
  }, intervalMs);
  timer.unref?.();
  return timer;
}
