import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any other imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createHmac } from 'crypto';
import { redisPublisher, redisSubscriber, verifyToken, EventChannel, prisma, userHasPermission, peekCloudflareTurnEntry, startCloudflareTurnRefresh, hostSecretMatches, getPlanLimits, fileTransferMaxBytesForPlan } from '@remotelink/shared';

const PORT = parseInt(process.env.PORT || '3002', 10);
const MEETING_LINK_TTL_MS = Number(process.env.MEETING_LINK_TTL_MINUTES || 30) * 60 * 1000;
const MEETING_EMPTY_END_DELAY_MS = Number(process.env.MEETING_EMPTY_END_DELAY_SECONDS || 120) * 1000;
// Presence lives in Redis and is refreshed by every register/heartbeat/pong. Clients
// heartbeat well inside this window (desktop 10s, Android host 25s), so 90s still
// tolerates ~3 consecutive missed beats before a device is reported Offline. The old
// 300s meant a phone that lost power kept showing "Online / Active now" for up to five
// minutes, so viewers would hit Connect on a device that was already gone.
const PRESENCE_TTL_SECONDS = Number(process.env.PRESENCE_TTL_SECONDS || 90);
const LAST_SEEN_UPDATE_INTERVAL_MS = Number(process.env.LAST_SEEN_UPDATE_INTERVAL_MS || 60_000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.SIGNAL_HEARTBEAT_INTERVAL_MS || 20_000);
// Missed server pings tolerated before a socket is treated as dead and terminated.
// At HEARTBEAT_INTERVAL_MS (20s) the old value of 45 meant a client that vanished
// (power loss, network drop) held its registration for ~15 minutes; 3 gives ~60s,
// which lines up with the presence TTL above so the two expire together.
const HEARTBEAT_MAX_MISSED = Number(process.env.SIGNAL_HEARTBEAT_MAX_MISSED || 3);
const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';

// In-memory map of active connections on this specific instance
const localClients = new Map<string, WebSocket>();
const clientMeta = new Map<string, {
  kind: string;
  userId?: string;
  sessionId?: string;
  meetingId?: string;
  appVersion?: string;
  platform?: string;
  lastMessageAt: number;
  lastPongAt: number;
  connectedAt: number;
}>();
// Map 9-digit sessionId -> host's connectionId
const sessionRegistry = new Map<string, string>(); // sessionId -> hostConnectionId
const reverseRegistry = new Map<string, string>(); // hostConnectionId -> sessionId
const viewerRegistry = new Map<string, string>(); // viewerConnectionId -> sessionId
const viewerGrantIds = new Map<string, string>();
const viewerExpiryTimers = new Map<string, NodeJS.Timeout[]>();
// Map meetingId -> Set of connectionIds
const meetingRooms = new Map<string, Set<string>>();
// connectionId -> meetingId (for cleanup)
const connectionToMeeting = new Map<string, string>();
// connectionId -> display metadata for meeting participants
const meetingParticipants = new Map<string, { id?: string; name?: string; avatar?: string | null; clientKind?: string }>();
const meetingMediaStates = new Map<string, { isMuted: boolean; isCameraOff: boolean; isScreenSharing: boolean }>();
const meetingEmptyTimers = new Map<string, NodeJS.Timeout>();
// Host-set per-meeting permissions (e.g. participants may share without asking).
const meetingPolicies = new Map<string, { allowScreenShare: boolean }>();
// meetingId -> host connectionId (the meeting creator, who admits guests).
const meetingHosts = new Map<string, string>();
// Everything needed to complete a join once the host admits the guest.
type MeetingLobbyEntry = {
  meeting: any;
  decodedUserId: string | null;
  participantUser: { id: string; name: string; avatar: string | null; clientKind?: string };
  participantUserId: string;
  participantName: string;
  mediaState: { isMuted: boolean; isCameraOff: boolean; isScreenSharing: boolean };
};
// meetingId -> (connectionId -> lobby entry) for guests awaiting host approval.
const meetingLobbies = new Map<string, Map<string, MeetingLobbyEntry>>();
// Pending connections waiting for host approval
const pendingJoins = new Map<string, {
  sessionId: string;
  viewerClientId?: string;
  viewerUserId?: string | null;
  viewerName?: string;
  viewerDeviceId?: string | null;
  remoteSessionId?: string | null;
  expiresAt?: Date | null;
  /** Device is configured for control without a consent prompt (see host). */
  unattended?: boolean;
  /** e.g. 'mobile-viewer' — the host exempts phones from the consent flow. */
  clientKind?: string;
  /** Per-file transfer cap from the viewer's billing plan (-1 = unlimited); the host enforces it. */
  viewerFileTransferMaxBytes?: number;
  timeout: NodeJS.Timeout;
}>();

// Chat connections: userId -> Set of connectionIds
const userConnections = new Map<string, Set<string>>();
// connectionId -> userId (for quick cleanup)
const connectionToUser = new Map<string, string>();
const lastSeenUpdates = new Map<string, number>();
const typingParticipantCache = new Map<string, { userIds: string[]; expiresAt: number }>();
const TYPING_PARTICIPANT_CACHE_MS = 30_000;

function sendToUserConnections(userId: string, payload: any) {
  const conns = userConnections.get(userId);
  if (!conns) return;
  const encoded = JSON.stringify(payload);
  conns.forEach(connId => {
    const clientWs = localClients.get(connId);
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(encoded);
    }
  });
}

// Mirror of the API's publishAccountSync: tells every signed-in client of the
// meeting's creator and collaborators that its state changed, so their Recent
// Meetings lists refresh. Meetings start and end on this service (join, host
// end, empty-room timer) without going through the API, so those lists used
// to sit stale until a manual refresh.
async function publishMeetingSync(meeting: any, action: string) {
  const targetUserIds = Array.from(new Set([
    meeting?.createdById,
    ...((meeting?.collaborators || []).map((c: any) => c?.userId))
  ].filter(Boolean))) as string[];
  if (targetUserIds.length === 0) return;
  try {
    await redisPublisher.publish('account:sync', JSON.stringify({
      type: 'account-sync',
      scope: 'meetings',
      action,
      entityId: meeting.id,
      targetUserIds,
      changedAt: new Date().toISOString()
    }));
  } catch (err) {
    console.warn(`[Meeting] Failed to publish ${action} sync for ${meeting?.sessionCode}:`, err);
  }
}

// --- Chat presence (real online/offline) -----------------------------------
// A user is "online" while they hold at least one authenticated chat socket.
// Online state lives in Redis (so it works across instances and survives the
// pub/sub delivery model); presence changes are fanned out to the user's chat
// contacts over the `chat:presence` channel.
const CHAT_ONLINE_PREFIX = 'chat:online:';
// Online keys expire on their own (and are refreshed while connected) so a
// signaling restart cannot leave people showing "Online" forever.
const CHAT_ONLINE_TTL_SECONDS = 90;
// A reload or route change reconnects within a second or two; contacts only
// hear "offline" if the user is still gone after this.
const CHAT_OFFLINE_GRACE_MS = 8_000;
const CHAT_LASTSEEN_PREFIX = 'chat:lastseen:';
const CHAT_LASTSEEN_TTL_SECONDS = 60 * 60 * 24 * 30; // keep last-seen for 30 days

async function getChatContactIds(userId: string): Promise<string[]> {
  try {
    const myParts = await (prisma as any).conversationParticipant.findMany({
      where: { userId }, select: { conversationId: true },
    });
    const convIds = myParts.map((p: any) => p.conversationId);
    if (convIds.length === 0) return [];
    const others = await (prisma as any).conversationParticipant.findMany({
      where: { conversationId: { in: convIds }, userId: { not: userId } },
      select: { userId: true },
    });
    return Array.from(new Set(others.map((o: any) => o.userId as string)));
  } catch (err) {
    console.warn('[Signaling] getChatContactIds failed:', err);
    return [];
  }
}

async function broadcastChatPresence(userId: string, online: boolean) {
  try {
    const lastSeen = new Date().toISOString();
    if (online) {
      await redisPublisher.set(`${CHAT_ONLINE_PREFIX}${userId}`, '1', 'EX', CHAT_ONLINE_TTL_SECONDS);
    } else {
      await redisPublisher.del(`${CHAT_ONLINE_PREFIX}${userId}`);
      await redisPublisher.set(`${CHAT_LASTSEEN_PREFIX}${userId}`, lastSeen, 'EX', CHAT_LASTSEEN_TTL_SECONDS);
    }
    const targetUserIds = await getChatContactIds(userId);
    if (targetUserIds.length === 0) return;
    await redisPublisher.publish('chat:presence', JSON.stringify({
      type: 'chat-presence', userId, online, lastSeen, targetUserIds,
    }));
  } catch (err) {
    console.warn('[Signaling] broadcastChatPresence failed:', err);
  }
}

// Send an Expo push to message recipients who are currently offline.
async function sendChatPush(
  targetUserIds: string[],
  senderId: string,
  title: string,
  body: string,
  conversationId: string,
  /**
   * Extra fields for the client's tap handler. The mobile listener used to read only
   * `conversationId`, so a pushed invite had nowhere to route to; `kind` and
   * `sessionCode` let it open the meeting/session instead of a chat thread.
   */
  extraData: Record<string, any> = {},
) {
  try {
    const messages: any[] = [];
    for (const userId of targetUserIds) {
      if (userId === senderId) continue;
      const online = await redisPublisher.exists(`${CHAT_ONLINE_PREFIX}${userId}`);
      if (online === 1) continue; // they'll get it live over the socket
      const tokens = await redisPublisher.smembers(`chat:pushtokens:${userId}`);
      for (const to of tokens) {
        messages.push({
          to,
          sound: 'default',
          title,
          body,
          // Invites go to their own Android channel so they can be given a different
          // importance from ordinary chatter.
          channelId: extraData.kind && extraData.kind !== 'message' ? 'invites' : 'messages',
          priority: 'high',
          data: { conversationId, ...extraData },
        });
      }
    }
    if (messages.length === 0) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.warn('[Signaling] sendChatPush failed:', err);
  }
}

// On connect, tell the joining user which of their contacts are currently online.
async function sendChatPresenceSnapshot(ws: WebSocket, userId: string) {
  try {
    const contactIds = await getChatContactIds(userId);
    if (contactIds.length === 0) return;
    const online: Record<string, boolean> = {};
    const lastSeen: Record<string, string> = {};
    for (const cid of contactIds) {
      const isOnline = await redisPublisher.exists(`${CHAT_ONLINE_PREFIX}${cid}`);
      online[cid] = isOnline === 1;
      if (!online[cid]) {
        const ls = await redisPublisher.get(`${CHAT_LASTSEEN_PREFIX}${cid}`);
        if (ls) lastSeen[cid] = ls;
      }
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat-presence-snapshot', online, lastSeen }));
    }
  } catch (err) {
    console.warn('[Signaling] sendChatPresenceSnapshot failed:', err);
  }
}

// Keep the online keys of everyone still connected alive.
setInterval(() => {
  for (const [userId, conns] of userConnections) {
    if (conns.size === 0) continue;
    void redisPublisher.set(`${CHAT_ONLINE_PREFIX}${userId}`, '1', 'EX', CHAT_ONLINE_TTL_SECONDS).catch(() => {});
  }
}, 30_000).unref?.();

function updateClientMeta(connectionId: string, patch: Partial<{
  kind: string;
  userId?: string;
  sessionId?: string;
  meetingId?: string;
  appVersion?: string;
  platform?: string;
  lastMessageAt: number;
  lastPongAt: number;
}>) {
  const current = clientMeta.get(connectionId) || {
    kind: 'unknown',
    lastMessageAt: Date.now(),
    lastPongAt: Date.now(),
    connectedAt: Date.now()
  };
  clientMeta.set(connectionId, { ...current, ...patch });
}

function describeClient(connectionId: string) {
  const meta = clientMeta.get(connectionId);
  if (!meta) return `id=${connectionId} kind=unknown`;
  const ageSec = Math.round((Date.now() - meta.connectedAt) / 1000);
  const idleSec = Math.round((Date.now() - meta.lastMessageAt) / 1000);
  const pongAgeSec = Math.round((Date.now() - meta.lastPongAt) / 1000);
  return [
    `id=${connectionId}`,
    `kind=${meta.kind}`,
    meta.userId ? `user=${meta.userId}` : null,
    meta.sessionId ? `session=${meta.sessionId}` : null,
    meta.meetingId ? `meeting=${meta.meetingId}` : null,
    meta.appVersion ? `version=${meta.appVersion}` : null,
    meta.platform ? `platform=${meta.platform}` : null,
    `age=${ageSec}s`,
    `idle=${idleSec}s`,
    `lastPong=${pongAgeSec}s`
  ].filter(Boolean).join(' ');
}

async function publishStructuredChatMessage(conversationId: string, senderId: string, payload: any) {
  const message = await (prisma as any).message.create({
    data: { conversationId, senderId, content: `${SESSION_INVITE_PREFIX}${JSON.stringify(payload)}` },
    include: { sender: { select: { id: true, name: true, email: true, avatar: true } } }
  });
  await (prisma as any).conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  const participants = await (prisma as any).conversationParticipant.findMany({
    where: { conversationId }, select: { userId: true }
  });
  await redisPublisher.publish('chat:new-message', JSON.stringify({
    type: 'chat-message-received', message, conversationId,
    targetUserIds: participants.map((participant: any) => participant.userId)
  }));
  return message;
}

function clearViewerExpiryTimers(connectionId: string) {
  (viewerExpiryTimers.get(connectionId) || []).forEach(clearTimeout);
  viewerExpiryTimers.delete(connectionId);
}

async function expireRemoteGrantById(grantId: string) {
  const grant = await (prisma as any).remoteSession.findUnique({ where: { id: grantId } });
  if (grant?.status === 'ACTIVE') {
    const updated = await (prisma as any).remoteSession.updateMany({
      where: { id: grantId, status: 'ACTIVE' }, data: { status: 'EXPIRED', endedAt: new Date() }
    });
    if (updated.count > 0 && grant.conversationId && grant.createdById) {
      await publishStructuredChatMessage(grant.conversationId, grant.createdById, {
        kind: 'remote-session-status', remoteSessionId: grant.id, status: 'ENDED',
        reason: 'TIME_LIMIT', text: 'Remote session ended - time limit reached.',
        createdAt: new Date().toISOString()
      }).catch((err) => console.warn('[Signaling] Failed to publish remote expiry message:', err));
    }
  }
  for (const [connectionId, activeGrantId] of viewerGrantIds.entries()) {
    if (activeGrantId !== grantId) continue;
    const viewerWs = localClients.get(connectionId);
    if (viewerWs?.readyState === WebSocket.OPEN) {
      viewerWs.send(JSON.stringify({ type: 'remote-session-expired', remoteSessionId: grantId }));
      viewerWs.close(4001, 'Remote access time limit reached');
    }
  }
}

async function expireRemoteGrant(_connectionId: string, grantId: string) {
  await expireRemoteGrantById(grantId);
}

function scheduleRemoteGrantExpiry(connectionId: string, grantId: string, expiresAt: Date) {
  clearViewerExpiryTimers(connectionId);
  const remaining = expiresAt.getTime() - Date.now();
  if (remaining <= 0) {
    void expireRemoteGrant(connectionId, grantId);
    return;
  }
  const timers: NodeJS.Timeout[] = [];
  if (remaining > 60_000) {
    timers.push(setTimeout(() => {
      const viewerWs = localClients.get(connectionId);
      if (viewerWs?.readyState === WebSocket.OPEN) {
        viewerWs.send(JSON.stringify({ type: 'remote-session-expiring', remoteSessionId: grantId, secondsRemaining: 60 }));
      }
    }, remaining - 60_000));
  }
  timers.push(setTimeout(() => void expireRemoteGrant(connectionId, grantId), remaining));
  viewerExpiryTimers.set(connectionId, timers);
}

// --- STARTUP CLEANUP ---
// Clear all stale presence keys on service restart to prevent ghost online status
async function clearStalePresence() {
  try {
    const keys = await redisPublisher.keys('presence:*');
    if (keys.length > 0) {
      await redisPublisher.del(...keys);
      console.log(`[Signaling] Cleared ${keys.length} stale presence keys on startup.`);
    }
    // Chat online markers can also go stale after a crash — clear them too.
    const chatKeys = await redisPublisher.keys(`${CHAT_ONLINE_PREFIX}*`);
    if (chatKeys.length > 0) {
      await redisPublisher.del(...chatKeys);
      console.log(`[Signaling] Cleared ${chatKeys.length} stale chat-online keys on startup.`);
    }
  } catch (err) {
    console.warn('[Signaling] Failed to clear stale presence keys:', err);
  }
}

// Map connectionId -> Set of accessKeys they are monitoring
const presenceSubscriptions = new Map<string, Set<string>>();
// Map connectionId -> organizationId they are monitoring
const orgSubscriptions = new Map<string, string>();

// Helper to broadcast status to all subscribers
async function broadcastPresence(sessionId: string, status: 'online' | 'offline') {
  const update = JSON.stringify({ type: 'presence-update', sessionId, status });
  const normalizedId = String(sessionId).toLowerCase();
  for (const [connId, keys] of presenceSubscriptions.entries()) {
    // Graceful match against both exact and normalized cases
    if (keys.has(sessionId) || keys.has(normalizedId)) {
      const clientWs = localClients.get(connId);
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(update);
      }
    }
  }
}

// --- Exclusive "in session" lock ------------------------------------------------
// A device may only be controlled by one viewer at a time. While a viewer is
// connected we hold `session:active:<sessionId>` in Redis so that auth-service can
// refuse new connections (from any account) until the session ends. The key carries
// a TTL as a safety net and is refreshed by the viewer heartbeat.
const SESSION_BUSY_TTL_SECONDS = 120;
const sessionBusyKey = (sessionId: string) => `session:active:${sessionId}`;

function broadcastSessionStatus(sessionId: string, inSession: boolean) {
  const update = JSON.stringify({ type: 'session-status', sessionId, inSession });
  const normalizedId = String(sessionId).toLowerCase();
  for (const [connId, keys] of presenceSubscriptions.entries()) {
    if (keys.has(sessionId) || keys.has(normalizedId)) {
      const clientWs = localClients.get(connId);
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(update);
      }
    }
  }
}

async function acquireDeviceSession(sessionId: string, viewerConnectionId: string) {
  await redisPublisher.set(sessionBusyKey(sessionId), viewerConnectionId, 'EX', SESSION_BUSY_TTL_SECONDS).catch(() => { });
  broadcastSessionStatus(sessionId, true);
}

async function releaseDeviceSession(sessionId: string, viewerConnectionId: string) {
  // Only the holder clears it, and only when no other viewer is still attached.
  const holder = await redisPublisher.get(sessionBusyKey(sessionId)).catch(() => null);
  const stillAttached = Array.from(viewerRegistry.entries())
    .some(([connId, sid]) => sid === sessionId && connId !== viewerConnectionId);
  if (stillAttached) return;
  if (!holder || holder === viewerConnectionId) {
    await redisPublisher.del(sessionBusyKey(sessionId)).catch(() => { });
    broadcastSessionStatus(sessionId, false);
  }
}

// Durable per-device presence history (capped, 2-week TTL) so "why did this
// device go offline?" is answerable after the fact:
//   redis-cli LRANGE presence-log:<accessKey> 0 30
// Events: online (register, with app version), offline (socket closed, with
// close code + how long the client had been silent), terminated-unresponsive
// (server killed a zombie that stopped answering pings).
function recordPresenceEvent(sessionId: string, event: string, detail: Record<string, any> = {}) {
  try {
    const entry = JSON.stringify({ t: new Date().toISOString(), event, ...detail });
    const key = `presence-log:${sessionId}`;
    void redisPublisher.lpush(key, entry)
      .then(() => redisPublisher.ltrim(key, 0, 199))
      .then(() => redisPublisher.expire(key, 60 * 60 * 24 * 14))
      .catch(() => { /* history is best-effort */ });
  } catch { /* never let telemetry break signaling */ }
}

async function markHostPresent(sessionId: string) {
  await redisPublisher.set(`presence:${sessionId}`, 'online', 'EX', PRESENCE_TTL_SECONDS);

  const now = Date.now();
  const lastUpdate = lastSeenUpdates.get(sessionId) || 0;
  if (now - lastUpdate < LAST_SEEN_UPDATE_INTERVAL_MS) return;

  lastSeenUpdates.set(sessionId, now);
  await (prisma as any).device.update({
    where: { accessKey: sessionId },
    data: { lastSeenAt: new Date(now) }
  }).catch((err: any) => {
    console.warn(`[Signaling] Failed to update lastSeenAt for ${sessionId}:`, err?.message || err);
  });
}

async function canRegisterHost(accessKey: string, token?: string, hostSecret?: string): Promise<{ ok: boolean; error?: string }> {
  const device = await (prisma as any).device.findUnique({
    where: { accessKey },
    select: {
      id: true, ownerId: true, organizationId: true, deviceType: true, hostSecretHash: true, status: true,
      organization: { select: { status: true } },
      owner: { select: { status: true } },
    }
  });

  if (!device) {
    return { ok: false, error: 'Device is not registered' };
  }

  // Platform enforcement — the super admin's "Block Device", "Suspend
  // Organization" and "Suspend User" actions. Refusing here keeps a blocked or
  // suspended host off the fleet even when it presents a valid token or
  // machine credential, which is why it runs before every auth shortcut below.
  if (String(device.status || '').toUpperCase() === 'BLOCKED') {
    return { ok: false, error: 'This device has been disabled by the platform administrator' };
  }
  const orgStatus = String(device.organization?.status || 'ACTIVE').toUpperCase();
  if (orgStatus === 'SUSPENDED' || orgStatus === 'DELETED') {
    return { ok: false, error: 'This organization is suspended' };
  }
  const ownerStatus = String(device.owner?.status || 'ACTIVE').toUpperCase();
  if (ownerStatus === 'SUSPENDED' || ownerStatus === 'DELETED') {
    return { ok: false, error: 'The owner of this device is suspended' };
  }

  // A machine-scoped host credential stands in for the user token. Android
  // hosts have always used it; desktop hosts use it for UNATTENDED
  // registration — the pre-logon instance the Windows service starts after a
  // reboot has no signed-in user, so no access token exists to register with.
  // Issued only by POST /api/devices/host-credential (authenticated +
  // ownership-checked) and stored outside any Windows profile.
  if (hostSecretMatches(hostSecret, device.hostSecretHash)) {
    return { ok: true };
  }

  if (!device.ownerId) {
    return { ok: true };
  }

  if (!token) {
    console.warn(`[Signaling] Legacy host registration without token for owned device: ${accessKey}`);
    return { ok: true };
  }

  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return { ok: false, error: 'Invalid host token' };
  }

  if (decoded.userId === device.ownerId) {
    return { ok: true };
  }

  const user = await (prisma as any).user.findUnique({
    where: { id: decoded.userId },
    select: { role: true, organizationId: true, permissionOverrides: true }
  });

  // Effective per-user check so owner grants/revokes of devices:configure apply.
  const canAdminDevice = user?.organizationId === device.organizationId && userHasPermission(user, 'devices:configure');

  return canAdminDevice
    ? { ok: true }
    : { ok: false, error: 'Not authorized to host this device' };
}

function canForwardRemoteSignal(senderId: string, targetId: string, messageType: string): boolean {
  const senderSessionId = reverseRegistry.get(senderId);
  const senderViewerSession = viewerRegistry.get(senderId);

  if (senderSessionId) {
    if (messageType === 'answer') return false;
    return viewerRegistry.get(targetId) === senderSessionId;
  }

  if (senderViewerSession) {
    const hostId = sessionRegistry.get(senderViewerSession);
    if (targetId !== hostId) return false;
    return ['request-offer', 'answer', 'ice-candidate'].includes(messageType);
  }

  return false;
}

const normalizeMeetingId = (meetingId: string) => String(meetingId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const base64Url = (payload: Buffer | string) =>
  Buffer.from(payload).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function createLiveKitJoinConfig(room: string, userId: string, name: string) {
  const livekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!livekitUrl || !apiKey || !apiSecret) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims = {
    iss: apiKey,
    sub: userId,
    name,
    nbf: now - 10,
    exp: now + 60 * 60,
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = createHmac('sha256', apiSecret).update(unsigned).digest();

  return {
    provider: 'livekit',
    url: livekitUrl,
    room,
    token: `${unsigned}.${base64Url(signature)}`
  };
}

// ICE servers handed to a peer that signaling has already authorized to be in
// a session (meeting participants, and the viewer/host pair of a remote
// session). This is what a SIGNED-OUT desktop client relies on for TURN: the
// account route (/api/auth/ice-servers) needs a user token or a machine
// credential, and a fresh guest-mode install has neither, so without this list
// both ends of a guest session were STUN-only and failed on any pair of
// networks that can't connect directly.
//
// Credentials: when TURN_REST_SECRET is set, mint TURN REST API credentials
// (coturn --use-auth-secret): "expiry:identity" + HMAC-SHA1, valid for
// TURN_TTL_SECONDS, exactly as auth-service does. A leaked credential then dies
// with the session instead of being a permanent relay password. Otherwise the
// static TURN_USER/TURN_PASSWORD pair is used (coturn --user), as before.
function createMeetingIceServers(identity: string = 'session') {
  const serverIP = process.env.TURN_HOST || process.env.SERVER_IP || '159.65.84.190';
  const turnSecret = process.env.TURN_REST_SECRET;
  const turnUser = process.env.TURN_USER;
  const turnPass = process.env.TURN_PASSWORD;

  const iceServers: Array<Record<string, any>> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  const urls = [`turn:${serverIP}:3478?transport=udp`, `turn:${serverIP}:3478?transport=tcp`];
  if (turnSecret) {
    const ttl = Number(process.env.TURN_TTL_SECONDS || 3600);
    const expiresAt = Math.floor(Date.now() / 1000) + Math.max(300, Math.min(ttl, 86400));
    const username = `${expiresAt}:${identity}`;
    const credential = createHmac('sha1', turnSecret).update(username).digest('base64');
    iceServers.push({ urls, username, credential, credentialType: 'password' });
  } else if (turnUser && turnPass) {
    iceServers.push({ urls, username: turnUser, credential: turnPass, credentialType: 'password' });
  }

  // Cloudflare anycast TURN FIRST so ICE prefers a nearby relay over the London
  // coturn (which stays as fallback). Web viewers/meetings get their ICE servers
  // from here — before this, they were pinned to London even after the desktop
  // clients got Cloudflare via /api/auth/ice-servers. Synchronous by design:
  // the cache is warmed at boot (startCloudflareTurnRefresh below) so joins
  // never wait on a Cloudflare HTTPS round-trip.
  const cfEntry = peekCloudflareTurnEntry();
  if (cfEntry) iceServers.unshift(cfEntry);

  return iceServers;
}

// Remove a guest from whatever meeting lobby they're waiting in. Returns the
// meetingId if they were waiting (so the caller can stop), otherwise null.
const removeFromMeetingLobby = (connectionId: string, notifyHost = true) => {
  for (const [meetingId, lobby] of meetingLobbies) {
    if (!lobby.has(connectionId)) continue;
    lobby.delete(connectionId);
    if (lobby.size === 0) meetingLobbies.delete(meetingId);
    if (notifyHost) {
      const hostConnId = meetingHosts.get(meetingId);
      const hostWs = hostConnId ? localClients.get(hostConnId) : null;
      if (hostWs && hostWs.readyState === WebSocket.OPEN) {
        hostWs.send(JSON.stringify({ type: 'meeting-knock-cancelled', meetingId, guestId: connectionId }));
      }
    }
    return meetingId;
  }
  return null;
};

// Place a participant into the live meeting room: register them, tell existing
// participants, run the DB/status bookkeeping, and reply with meeting-joined.
// Shared by the host (immediate) and guest (post-admit) paths.
async function finalizeMeetingJoin(connectionId: string, meetingId: string, entry: MeetingLobbyEntry) {
  const ws = localClients.get(connectionId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const { meeting, decodedUserId, participantUser, participantUserId, participantName, mediaState } = entry;

  const emptyTimer = meetingEmptyTimers.get(meetingId);
  if (emptyTimer) {
    clearTimeout(emptyTimer);
    meetingEmptyTimers.delete(meetingId);
  }

  if (!meetingRooms.has(meetingId)) {
    meetingRooms.set(meetingId, new Set());
  }
  const room = meetingRooms.get(meetingId)!;

  const creatorWasPresent = Boolean(meeting?.createdById && Array.from(room).some(participantId => (
    meetingParticipants.get(participantId)?.id === meeting.createdById
  )));

  meetingParticipants.set(connectionId, participantUser);
  meetingMediaStates.set(connectionId, mediaState);
  updateClientMeta(connectionId, { kind: 'meeting', userId: participantUserId, meetingId });

  const joinNotification = JSON.stringify({
    type: 'meeting-participant-joined',
    meetingId,
    participant: { connectionId, user: participantUser, mediaState }
  });
  for (const participantId of room) {
    const pWs = localClients.get(participantId);
    if (pWs && pWs.readyState === WebSocket.OPEN) {
      pWs.send(joinNotification);
    }
  }

  room.add(connectionId);
  connectionToMeeting.set(connectionId, meetingId);

  if (meeting && decodedUserId) {
    const collaborator = meeting.collaborators?.find((item: any) => item.userId === participantUserId);
    const isCreator = participantUserId === meeting.createdById;
    const isFirstRecordedJoin = isCreator
      ? meeting.status === 'ACTIVE'
      : Boolean(collaborator && !collaborator.joinedAt);

    if (isCreator) {
      await (prisma as any).remoteSession.update({
        where: { id: meeting.id },
        data: { status: 'IN_PROGRESS', startedAt: meeting.startedAt || new Date() }
      });
      if (meeting.status !== 'IN_PROGRESS') void publishMeetingSync(meeting, 'started');
    } else if (collaborator) {
      await (prisma as any).remoteSessionCollaborator.update({
        where: { id: collaborator.id },
        data: { status: 'JOINED', joinedAt: collaborator.joinedAt || new Date() }
      });
      await (prisma as any).remoteSession.update({
        where: { id: meeting.id },
        data: { status: 'IN_PROGRESS', startedAt: meeting.startedAt || new Date() }
      });
      if (meeting.status !== 'IN_PROGRESS') void publishMeetingSync(meeting, 'started');
    }

    if (isFirstRecordedJoin && meeting.conversationId) {
      await publishStructuredChatMessage(meeting.conversationId, participantUserId, {
        kind: 'meeting-status',
        remoteSessionId: meeting.id,
        sessionCode: meeting.sessionCode,
        status: 'IN_PROGRESS',
        event: 'JOINED',
        participantName,
        text: `${participantName} has joined the meeting.`,
        createdAt: new Date().toISOString()
      });
      if (!isCreator && !creatorWasPresent) {
        await publishStructuredChatMessage(meeting.conversationId, participantUserId, {
          kind: 'meeting-status',
          remoteSessionId: meeting.id,
          sessionCode: meeting.sessionCode,
          status: 'WAITING',
          event: 'WAITING',
          participantName,
          text: "I've joined, waiting for you.",
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  const participants = [];
  for (const pId of room) {
    if (pId !== connectionId) {
      participants.push({
        connectionId: pId,
        user: meetingParticipants.get(pId),
        mediaState: meetingMediaStates.get(pId)
      });
    }
  }

  ws.send(JSON.stringify({
    type: 'meeting-joined',
    meetingId,
    participants,
    isHost: meetingHosts.get(meetingId) === connectionId,
    policy: meetingPolicies.get(meetingId) || { allowScreenShare: false },
    recording: meetingRecordings.get(meetingId) ? { byName: meetingRecordings.get(meetingId)!.byName, at: meetingRecordings.get(meetingId)!.at } : null,
    meeting: meeting || { id: meetingId, name: `Meeting ${meetingId.toUpperCase()}`, sessionCode: meetingId },
    iceServers: createMeetingIceServers(),
    sfu: createLiveKitJoinConfig(meetingId, participantUserId, participantUser.name)
  }));
}

// Who is recording each meeting. Authoritative here (single signaling node);
// mirrored to Redis so a restart can recover it. Per product decision this is
// in-memory + Redis, not a DB row.
const meetingRecordings = new Map<string, { byConnectionId: string; byName: string; at: number }>();

const broadcastMeetingRecording = (meetingId: string, on: boolean, byName: string, reason?: string) => {
  const room = meetingRooms.get(meetingId);
  if (!room) return;
  const payload = JSON.stringify({ type: 'meeting-recording', meetingId, on, byName, reason: reason || null, at: Date.now() });
  for (const participantId of room) {
    const pWs = localClients.get(participantId);
    if (pWs && pWs.readyState === WebSocket.OPEN) pWs.send(payload);
  }
};

const leaveMeetingRoom = (connectionId: string) => {
  for (const [mid, rec] of meetingRecordings) {
    if (rec.byConnectionId === connectionId) {
      meetingRecordings.delete(mid);
      void redisPublisher.del(`meeting:recording:${mid}`).catch(() => {});
      broadcastMeetingRecording(mid, false, rec.byName, 'recorder-left');
    }
  }
  // Guests still in the waiting room never entered the live room — clean up
  // their lobby slot (and let the host know) without the room-leave broadcast.
  if (removeFromMeetingLobby(connectionId)) {
    connectionToMeeting.delete(connectionId);
    return;
  }

  const meetingId = connectionToMeeting.get(connectionId);
  if (!meetingId) return;

  // If the host leaves, drop the pointer so the creator reclaims it on rejoin.
  if (meetingHosts.get(meetingId) === connectionId) meetingHosts.delete(meetingId);

  const room = meetingRooms.get(meetingId);
  if (room) {
    room.delete(connectionId);
    if (room.size === 0) {
      if (!meetingEmptyTimers.has(meetingId)) {
        const timer = setTimeout(async () => {
          const latestRoom = meetingRooms.get(meetingId);
          if (latestRoom && latestRoom.size > 0) return;
          meetingRooms.delete(meetingId);
          meetingEmptyTimers.delete(meetingId);
          meetingHosts.delete(meetingId);
          meetingPolicies.delete(meetingId);
          // Release anyone still waiting in the lobby — the meeting is over.
          const lobby = meetingLobbies.get(meetingId);
          if (lobby) {
            for (const guestId of lobby.keys()) {
              const gWs = localClients.get(guestId);
              if (gWs && gWs.readyState === WebSocket.OPEN) {
                gWs.send(JSON.stringify({ type: 'meeting-denied', meetingId, error: 'This meeting has ended.' }));
              }
              connectionToMeeting.delete(guestId);
            }
            meetingLobbies.delete(meetingId);
          }
          try {
            const meeting = await (prisma as any).remoteSession.findFirst({
              where: {
                sessionCode: meetingId,
                type: 'VIDEO_MEETING',
                status: { in: ['ACTIVE', 'IN_PROGRESS'] }
              },
              orderBy: { createdAt: 'desc' },
              include: { collaborators: { select: { userId: true } } }
            });
            if (!meeting) return;
            // An empty room only ends the meeting once its link has expired. While
            // the link is still valid (an unused instant link, or a "for later" link
            // that lives for days) the meeting goes back to ACTIVE so the same code
            // keeps working. Ending it here made every 7-day link single-use: the
            // first visit that emptied the room killed it.
            const linkStillValid = meeting.expiresAt
              ? new Date(meeting.expiresAt).getTime() > Date.now()
              : new Date(meeting.createdAt).getTime() + MEETING_LINK_TTL_MS > Date.now();
            if (linkStillValid) {
              if (meeting.status !== 'ACTIVE') {
                await (prisma as any).remoteSession.update({
                  where: { id: meeting.id },
                  data: { status: 'ACTIVE' }
                });
                void publishMeetingSync(meeting, 'idle');
              }
              console.log(`[Meeting] Empty meeting ${meetingId} is idle; its link is still valid.`);
              return;
            }
            await (prisma as any).remoteSession.update({
              where: { id: meeting.id },
              data: {
                status: 'ENDED',
                endedAt: new Date()
              }
            });
            void publishMeetingSync(meeting, 'ended');
            if (meeting.conversationId && meeting.createdById) {
              await publishStructuredChatMessage(meeting.conversationId, meeting.createdById, {
                kind: 'meeting-status',
                remoteSessionId: meeting.id,
                sessionCode: meeting.sessionCode,
                status: 'ENDED',
                event: 'ENDED',
                text: 'Meeting ended.',
                createdAt: new Date().toISOString()
              });
            }
            console.log(`[Meeting] Empty meeting ${meetingId} ended after ${Math.round(MEETING_EMPTY_END_DELAY_MS / 1000)}s.`);
          } catch (err) {
            console.warn(`[Meeting] Failed to end empty meeting ${meetingId}:`, err);
          }
        }, MEETING_EMPTY_END_DELAY_MS);
        meetingEmptyTimers.set(meetingId, timer);
      }
    } else {
      const leaveNotification = JSON.stringify({
        type: 'meeting-participant-left',
        meetingId,
        participantConnectionId: connectionId
      });
      for (const pId of room) {
        const pWs = localClients.get(pId);
        if (pWs && pWs.readyState === WebSocket.OPEN) {
          pWs.send(leaveNotification);
        }
      }
    }
  }

  connectionToMeeting.delete(connectionId);
  meetingParticipants.delete(connectionId);
  meetingMediaStates.delete(connectionId);
};

// Broadcast total active viewer sessions to all connected clients
function broadcastGlobalStats() {
  const activeSessions = new Set(viewerRegistry.values()).size;
  const statsUpdate = JSON.stringify({ type: 'global-stats', activeSessions });

  for (const ws of localClients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(statsUpdate);
    }
  }
}

async function startServer() {
  const grantExpirySweep = setInterval(async () => {
    try {
      const expiredGrants = await (prisma as any).remoteSession.findMany({
        where: { type: 'REMOTE_CONTROL', status: 'ACTIVE', expiresAt: { lte: new Date() } },
        select: { id: true }
      });
      await Promise.all(expiredGrants.map((grant: any) => expireRemoteGrantById(grant.id)));
    } catch (err) {
      console.warn('[Signaling] Remote grant expiry sweep failed:', err);
    }
  }, 15_000);
  grantExpirySweep.unref();

  console.log('[Signaling] Starting services...');

  // 1. Run Redis cleanup in background (don't block server start if Redis is slow/down)
  clearStalePresence().then(() => {
    console.log('[Signaling] Background cleanup finished.');
  }).catch(err => {
    console.warn('[Signaling] Background cleanup failed:', err);
  });

  // 2. Start WebSocket Server
  const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });
  console.log(`[Signaling] WebSocket server listening on ws://0.0.0.0:${PORT}`);
  // Warm + keep-warm the Cloudflare TURN credential cache so join/joined
  // replies can include it synchronously (no-op unless the CF env vars are set).
  startCloudflareTurnRefresh(console);

  wss.on('connection', (ws: WebSocket) => {
    const connectionId = uuidv4();
    localClients.set(connectionId, ws);
    updateClientMeta(connectionId, { kind: 'connected' });
    let pingsMissed = 0;

    console.log(`[Signaling] Client connected: ${connectionId}`);

    ws.on('pong', () => {
      pingsMissed = 0;
      updateClientMeta(connectionId, { lastPongAt: Date.now() });
    });

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        updateClientMeta(connectionId, { lastMessageAt: Date.now() });
        // Reset liveness in the same parse/dispatch pass. This used to live in
        // a second `message` listener, making every WebSocket payload pay for
        // JSON.parse twice solely to notice pong/heartbeat frames.
        if (data.type === 'pong' || data.type === 'heartbeat') {
          pingsMissed = 0;
        }
        if (data.clientKind || data.appVersion || data.platform) {
          const metaPatch: any = {};
          if (data.clientKind) metaPatch.kind = data.clientKind;
          if (data.appVersion) metaPatch.appVersion = data.appVersion;
          if (data.platform) metaPatch.platform = data.platform;
          updateClientMeta(connectionId, metaPatch);
        }

        switch (data.type) {
          case 'subscribe-presence':
            const keysToWatch = Array.isArray(data.accessKeys)
              ? data.accessKeys.map((k: any) => String(k).toLowerCase())
              : [];
            presenceSubscriptions.set(connectionId, new Set(keysToWatch));
            updateClientMeta(connectionId, {
              kind: data.clientKind || 'presence-monitor',
              appVersion: data.appVersion,
              platform: data.platform
            });
            console.log(`[Signaling] Client ${connectionId} subscribed to ${keysToWatch.length} keys.`);
            break;

          case 'subscribe-org':
            const orgId = data.organizationId;
            if (orgId) {
              orgSubscriptions.set(connectionId, orgId);
              updateClientMeta(connectionId, {
                kind: data.clientKind || 'presence-monitor',
                appVersion: data.appVersion,
                platform: data.platform
              });
              console.log(`[Signaling] Client ${connectionId} subscribed to org: ${orgId}`);
              ws.send(JSON.stringify({ type: 'subscribed-org', organizationId: orgId }));
            }
            break;

          case 'authenticate-chat': {
            const token = data.token;
            if (!token) break;
            const decoded = verifyToken(token);
            if (decoded && decoded.userId) {
              const userId = decoded.userId;
              connectionToUser.set(connectionId, userId);
              updateClientMeta(connectionId, {
                kind: data.clientKind || 'chat',
                userId,
                appVersion: data.appVersion,
                platform: data.platform
              });
              
              if (!userConnections.has(userId)) {
                userConnections.set(userId, new Set());
              }
              const wasAlreadyOnline = userConnections.get(userId)!.size > 0;
              userConnections.get(userId)!.add(connectionId);
              console.log(`[Signaling] Chat authenticated for user: ${userId}`);
              ws.send(JSON.stringify({ type: 'chat-authenticated', userId }));
              // First socket for this user → they just came online; announce it.
              if (!wasAlreadyOnline) {
                broadcastChatPresence(userId, true).catch(() => {});
              }
              // Tell this client which contacts are already online.
              sendChatPresenceSnapshot(ws, userId).catch(() => {});
            } else {
              ws.send(JSON.stringify({ type: 'chat-error', error: 'Authentication failed' }));
            }
            break;
          }

          case 'send-chat-message': {
            const senderId = connectionToUser.get(connectionId);
            if (!senderId) {
              ws.send(JSON.stringify({ type: 'chat-error', error: 'Unauthenticated' }));
              break;
            }

            const { conversationId, content, clientMessageId, replyToId, attachment } = data;
            if (!conversationId || (!content && !attachment)) break;

            try {
              // 0. Verify sender membership and accepted state before any DB write.
              const conv = await (prisma as any).conversation.findFirst({
                where: {
                  id: conversationId,
                  status: 'ACCEPTED',
                  participants: { some: { userId: senderId } }
                }
              });
              if (!conv) {
                ws.send(JSON.stringify({ type: 'chat-error', error: 'Conversation is not available for messaging' }));
                break;
              }

              // 1. Save to DB
              const messageData: any = { conversationId, senderId, content: content || '', clientMessageId: clientMessageId || null };
              if (replyToId) messageData.replyToId = String(replyToId);
              if (attachment?.url) {
                messageData.attachmentUrl = String(attachment.url);
                messageData.attachmentName = attachment.name ? String(attachment.name).slice(0, 255) : null;
                messageData.attachmentType = attachment.type ? String(attachment.type).slice(0, 100) : null;
                messageData.attachmentSize = Number(attachment.size) || null;
              }
              const messageInclude = {
                sender: { select: { id: true, name: true, email: true, avatar: true } },
                replyTo: { select: { id: true, content: true, senderId: true, attachmentName: true, sender: { select: { name: true, email: true } } } }
              };
              const message = clientMessageId
                ? await (prisma as any).message.upsert({
                    where: { clientMessageId },
                    update: {},
                    create: messageData,
                    include: messageInclude
                  })
                : await (prisma as any).message.create({
                    data: messageData,
                    include: messageInclude
                  });

              // Update the conversation updatedAt
              await (prisma as any).conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
              });

              // 2. Fetch participants to broadcast
              const participants = await (prisma as any).conversationParticipant.findMany({
                where: { conversationId },
                select: { userId: true, muted: true }
              });

              // Cards addressed to specific people (a remote-access request in a
              // group) only reach them and the sender; the rest of the group never
              // receives the payload. Before, everyone got it and the client hid it.
              let targetUserIds: string[] = participants.map((p: any) => p.userId);
              if (String(content || '').startsWith(SESSION_INVITE_PREFIX)) {
                try {
                  const payload = JSON.parse(String(content).slice(SESSION_INVITE_PREFIX.length));
                  const targets: string[] = Array.isArray(payload?.targetUserIds) ? payload.targetUserIds.map(String) : [];
                  if (targets.length > 0) targetUserIds = targetUserIds.filter((uid: string) => uid === senderId || targets.includes(uid));
                } catch { /* not a structured card */ }
              }
              const pushTargetUserIds = participants
                .filter((p: any) => !p.muted && targetUserIds.includes(p.userId))
                .map((p: any) => p.userId);

              // 3. Publish to Redis cluster
              await redisPublisher.publish('chat:new-message', JSON.stringify({
                type: 'chat-message-received',
                message,
                conversationId,
                targetUserIds
              }));

              // 3b. Push-notify any recipients who are currently offline.
              const pushSender = message.sender?.name || message.sender?.email || 'New message';
              const pushBody = String(content || '').startsWith(SESSION_INVITE_PREFIX)
                ? 'Sent an invite'
                : (content || (attachment?.url ? '📎 Photo' : 'New message'));
              sendChatPush(pushTargetUserIds, senderId, pushSender, pushBody, conversationId).catch(() => {});

              ws.send(JSON.stringify({
                type: 'chat-message-ack',
                clientMessageId,
                messageId: message.id,
                conversationId,
                createdAt: message.createdAt
              }));

            } catch (err) {
              console.error('[Signaling] Failed to process send-chat-message', err);
              ws.send(JSON.stringify({ type: 'chat-error', clientMessageId, error: 'Message could not be sent' }));
            }
            break;
          }

          case 'chat-typing': {
            // Lightweight typing indicator: relay to the other participants only.
            const typerId = connectionToUser.get(connectionId);
            const { conversationId } = data;
            if (!typerId || !conversationId) break;
            try {
              const cacheKey = String(conversationId);
              const cached = typingParticipantCache.get(cacheKey);
              let participantUserIds: string[];
              if (cached && cached.expiresAt > Date.now()) {
                participantUserIds = cached.userIds;
              } else {
                const participants = await (prisma as any).conversationParticipant.findMany({
                  where: { conversationId },
                  select: { userId: true }
                });
                participantUserIds = participants.map((p: any) => String(p.userId));
                typingParticipantCache.set(cacheKey, {
                  userIds: participantUserIds,
                  expiresAt: Date.now() + TYPING_PARTICIPANT_CACHE_MS
                });
              }
              if (!participantUserIds.includes(typerId)) break;
              const payload = {
                type: 'chat-typing',
                conversationId,
                userId: typerId,
                userName: data.userName || null,
                isTyping: data.isTyping !== false
              };
              participantUserIds
                .filter((uid: string) => uid !== typerId)
                .forEach((uid: string) => sendToUserConnections(uid, payload));
            } catch (err) {
              console.warn('[Signaling] chat-typing relay failed:', err);
            }
            break;
          }

          case 'chat-read': {
            const readerId = connectionToUser.get(connectionId);
            const conversationId = data.conversationId;
            if (!readerId || !conversationId) break;

            try {
              const participants = await (prisma as any).conversationParticipant.findMany({
                where: {
                  conversationId,
                  conversation: {
                    status: 'ACCEPTED',
                    participants: { some: { userId: readerId } }
                  }
                },
                select: { userId: true }
              });
              if (!participants.length) break;

              // Persist the read marker so unread counts and "seen" ticks survive
              // restarts and follow the person across devices (only ever forward).
              const parsedReadAt = new Date(data.readAt || Date.now());
              const readAtDate = Number.isNaN(parsedReadAt.getTime()) ? new Date() : parsedReadAt;
              await (prisma as any).conversationParticipant.updateMany({
                where: { conversationId, userId: readerId, OR: [{ lastReadAt: null }, { lastReadAt: { lt: readAtDate } }] },
                data: { lastReadAt: readAtDate }
              });

              await redisPublisher.publish('chat:read-receipt', JSON.stringify({
                type: 'chat-read-receipt',
                conversationId,
                userId: readerId,
                readAt: data.readAt || new Date().toISOString(),
                targetUserIds: participants.map((p: any) => p.userId)
              }));
            } catch (err) {
              console.error('[Signaling] Failed to process chat-read', err);
            }
            break;
          }

          case 'register':
            let sessionId = data.accessKey;
            // Standardize and ensure case-insensitivity at the perimeter
            if (sessionId) sessionId = String(sessionId).replace(/\s/g, '').toLowerCase();

            if (!sessionId || sessionId.trim() === '') {
              ws.send(JSON.stringify({ type: 'registration-error', error: 'Access key required' }));
              break;
            }

            const authResult = await canRegisterHost(sessionId, data.token, data.hostSecret);
            if (!authResult.ok) {
              ws.send(JSON.stringify({ type: 'registration-error', error: authResult.error || 'Host registration denied' }));
              break;
            }

            sessionRegistry.set(sessionId, connectionId);
            reverseRegistry.set(connectionId, sessionId);
            updateClientMeta(connectionId, {
              kind: data.clientKind || 'host',
              sessionId,
              appVersion: data.appVersion,
              platform: data.platform
            });

            await markHostPresent(sessionId);

            console.log(`[Signaling] Registered Host session: ${sessionId} (version=${data.appVersion || 'unknown'} platform=${data.platform || 'unknown'})`);
            recordPresenceEvent(sessionId, 'online', {
              version: data.appVersion || null,
              platform: data.platform || null,
              kind: data.clientKind || 'host',
            });
            ws.send(JSON.stringify({ type: 'registered', sessionId, connectionId }));

            // Broadcast "Online" to all subscribers
            broadcastPresence(sessionId, 'online');
            break;

          case 'heartbeat':
            const heartbeatSessionId = reverseRegistry.get(connectionId);
            if (heartbeatSessionId) {
              updateClientMeta(connectionId, {
                kind: data.clientKind || 'host',
                sessionId: heartbeatSessionId,
                appVersion: data.appVersion,
                platform: data.platform,
                lastPongAt: Date.now()
              });
              await markHostPresent(heartbeatSessionId);
              // console.log(`[Signaling] Pulse ACK: ${heartbeatSessionId}`);
            }
            break;

          case 'pong':
            // Explicit response to server-side ping
            // console.log(`[Signaling] Pong from ${connectionId}`);
            updateClientMeta(connectionId, { lastPongAt: Date.now() });
            {
              const pongSessionId = reverseRegistry.get(connectionId);
              if (pongSessionId && sessionRegistry.get(pongSessionId) === connectionId) {
                await markHostPresent(pongSessionId).catch(() => { });
              }
            }
            break;

          case 'join': {
            let targetSessionId = data.sessionId;
            if (targetSessionId) targetSessionId = String(targetSessionId).replace(/\s/g, '').toLowerCase();
            const token = data.token;

            console.log(`[Signaling] Join attempt for session: ${targetSessionId}`);

            if (!token) {
              ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Authentication token required' }));
              break;
            }

            const decoded = verifyToken(token);
            if (!decoded || decoded.type !== 'remote-access') {
              ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Invalid or expired access token' }));
              break;
            }

            let grantExpiresAt: Date | null = null;
            if (decoded.remoteSessionId) {
              const grantWhere: any = {
                  id: decoded.remoteSessionId,
                  type: 'REMOTE_CONTROL',
                  status: 'ACTIVE',
                  sessionCode: targetSessionId
              };
              if (decoded.viewerUserId) {
                // The viewer is authorized if they either created the grant (e.g. the
                // device owner connecting to their own device — verify-access does NOT
                // add the creator as a collaborator) or are a recorded collaborator.
                // Requiring collaborator-only membership rejected owners with a
                // misleading "grant has expired" and broke self-connect.
                grantWhere.OR = [
                  { createdById: decoded.viewerUserId },
                  { collaborators: { some: { userId: decoded.viewerUserId } } }
                ];
              }
              const grant = await (prisma as any).remoteSession.findFirst({ where: grantWhere });
              grantExpiresAt = grant?.expiresAt ? new Date(grant.expiresAt) : null;
              if (!grant || !grantExpiresAt || grantExpiresAt.getTime() <= Date.now()) {
                ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Remote access grant has expired' }));
                break;
              }
              viewerGrantIds.set(connectionId, grant.id);
            }

            const hostId = sessionRegistry.get(targetSessionId);
            if (!hostId) {
              ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Session not found' }));
              break;
            }

            // Fail fast on zombie hosts. A host whose socket died silently (old
            // client after sleep/network loss) can linger in sessionRegistry for
            // up to 15 minutes — approving a join then would leave the viewer
            // stuck on "Making connection" waiting for an offer that never
            // comes. If the host socket isn't OPEN or its presence key lapsed
            // (no heartbeat for 5+ min), tell the viewer the truth instead.
            const hostSocket = localClients.get(hostId);
            const hostPresent = await redisPublisher.exists(`presence:${targetSessionId}`).catch(() => 1);
            if (!hostSocket || hostSocket.readyState !== WebSocket.OPEN || !hostPresent) {
              console.log(`[Signaling] Join rejected — host ${targetSessionId} looks dead (socketOpen=${hostSocket?.readyState === WebSocket.OPEN}, present=${!!hostPresent}).`);
              ws.send(JSON.stringify({ type: 'joined', success: false, error: 'The remote device appears to be offline. Restart Remote 365 on it or try again shortly.' }));
              break;
            }

            // Resolve the connecting account's display name so the host can show
            // WHO is asking ("test cloud is requesting to connect") instead of a
            // generic message. The remote-access JWT carries viewerUserId; the
            // name lookup mirrors the meeting-join pattern below.
            let viewerName = '';
            const viewerUserIdClaim = decoded.viewerUserId || decoded.userId || null;
            if (viewerUserIdClaim) {
              try {
                const viewerUser = await (prisma as any).user.findUnique({
                  where: { id: viewerUserIdClaim },
                  select: { name: true, email: true }
                });
                viewerName = String(viewerUser?.name || viewerUser?.email || '').trim();
              } catch (err) {
                console.warn('[Signaling] Could not resolve viewer display name:', err);
              }
            }
            // The viewer's OWN device id (their PC's Remote 365 id, self-reported
            // by the desktop app) — shown on the host's dock next to the account
            // name. Sanitized to digits; browsers/mobiles simply omit it.
            const viewerDeviceId = String(data.viewerDeviceId || '').replace(/\D/g, '').slice(0, 12) || null;
            // Per-file transfer cap from the VIEWER's billing plan, stamped on
            // the join so the host enforces it — the number the viewer app
            // sends with a transfer is client-trusted and can be tampered with.
            // No account (temporary code) → the tightest (Trial) cap.
            let viewerFileTransferMaxBytes = fileTransferMaxBytesForPlan(null);
            if (viewerUserIdClaim) {
              try {
                const planInfo = await getPlanLimits(viewerUserIdClaim);
                viewerFileTransferMaxBytes = fileTransferMaxBytesForPlan(planInfo?.plan);
              } catch (err) {
                console.warn('[Signaling] Could not resolve the viewer transfer cap:', err);
              }
            }
            console.log(`[Signaling] Viewer identity for ${targetSessionId}: user=${viewerUserIdClaim || 'anonymous'} name=${viewerName || '(unresolved)'} device=${viewerDeviceId || 'n/a'} trusted=${!!decoded.isTrusted} pw=${!!decoded.passwordVerified} fileCap=${viewerFileTransferMaxBytes}`);

            // Devices allow multiple concurrent viewers. The busy key is still
            // maintained below so the Devices page can show an "In session"
            // activity badge, but it no longer blocks additional connections.
            const approveJoin = (viewerId: string, viewerClientId?: string) => {
              viewerRegistry.set(viewerId, targetSessionId);
              void acquireDeviceSession(targetSessionId, viewerId);
              ws.send(JSON.stringify({
                type: 'joined', success: true, iceServers: createMeetingIceServers(`viewer:${viewerId}`),
                remoteSessionId: decoded.remoteSessionId,
                expiresAt: grantExpiresAt?.toISOString()
              }));
              const hostWs = localClients.get(hostId);
              if (hostWs && hostWs.readyState === WebSocket.OPEN) {
                hostWs.send(JSON.stringify({
                  type: 'viewer-joined',
                  viewerId,
                  viewerClientId: viewerClientId || viewerId,
                  viewerName,
                  viewerDeviceId,
                  viewerFileTransferMaxBytes,
                  // Relayed verbatim from the access token; the host decides
                  // whether the session opens in control or view-only.
                  unattended: Boolean(decoded.unattended),
                  viewerClientKind: String(data.clientKind || ''),
                  iceServers: createMeetingIceServers(`host:${targetSessionId}`),
                  remoteSessionId: decoded.remoteSessionId,
                  expiresAt: grantExpiresAt?.toISOString()
                }));
              }
              if (decoded.remoteSessionId && grantExpiresAt) {
                scheduleRemoteGrantExpiry(viewerId, decoded.remoteSessionId, grantExpiresAt);
                void (prisma as any).remoteSession.updateMany({
                  where: { id: decoded.remoteSessionId, startedAt: null }, data: { startedAt: new Date() }
                });
              }
              broadcastGlobalStats();
            };

            if (decoded.isTrusted || decoded.passwordVerified) {
              approveJoin(connectionId, data.viewerClientId);
              updateClientMeta(connectionId, {
                kind: data.clientKind || 'viewer',
                sessionId: targetSessionId,
                appVersion: data.appVersion,
                platform: data.platform
              });
              break;
            }

            // Hold the join — ask the host to approve first.
            // Auto-deny after 30 s if the host doesn't respond.
            const requestTimeout = setTimeout(() => {
              if (!pendingJoins.has(connectionId)) return;
              pendingJoins.delete(connectionId);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'joined', success: false, error: 'The host did not respond. Try again.' }));
              }
            }, 30000);

            pendingJoins.set(connectionId, {
              sessionId: targetSessionId,
              viewerClientId: data.viewerClientId,
              viewerUserId: decoded.viewerUserId || null,
              viewerName,
              viewerDeviceId,
              viewerFileTransferMaxBytes,
              remoteSessionId: decoded.remoteSessionId || null,
              expiresAt: grantExpiresAt,
              unattended: Boolean(decoded.unattended),
              clientKind: String(data.clientKind || ''),
              timeout: requestTimeout,
            });

            const hostWs = localClients.get(hostId);
            if (hostWs && hostWs.readyState === WebSocket.OPEN) {
              hostWs.send(JSON.stringify({
                type: 'viewer-request',
                viewerId: connectionId,
                viewerClientId: data.viewerClientId || connectionId,
                viewerName,
                viewerDeviceId,
              }));
            }
            break;
          }

          case 'join-approve': {
            const pendingViewerId = data.viewerId;
            const pending = pendingJoins.get(pendingViewerId);
            if (!pending) break;

            clearTimeout(pending.timeout);
            pendingJoins.delete(pendingViewerId);

            if (data.trustDevice && pending.viewerUserId) {
              try {
                const device = await (prisma as any).device.findUnique({
                  where: { accessKey: pending.sessionId },
                  select: { id: true }
                });
                if (device?.id) {
                  await (prisma as any).trustedDevice.upsert({
                    where: { viewerUserId_hostDeviceId: { viewerUserId: pending.viewerUserId, hostDeviceId: device.id } },
                    update: {},
                    create: { viewerUserId: pending.viewerUserId, hostDeviceId: device.id }
                  });
                }
              } catch (err) {
                console.warn('[Signaling] Failed to persist trusted viewer approval:', err);
              }
            }

            const viewerWs = localClients.get(pendingViewerId);
            if (viewerWs && viewerWs.readyState === WebSocket.OPEN) {
              viewerRegistry.set(pendingViewerId, pending.sessionId);
              void acquireDeviceSession(pending.sessionId, pendingViewerId);
              updateClientMeta(pendingViewerId, { kind: 'viewer', sessionId: pending.sessionId });
              if (pending.remoteSessionId) viewerGrantIds.set(pendingViewerId, pending.remoteSessionId);
              viewerWs.send(JSON.stringify({
                type: 'joined',
                success: true,
                iceServers: createMeetingIceServers(),
                remoteSessionId: pending.remoteSessionId,
                expiresAt: pending.expiresAt?.toISOString()
              }));
              // Now tell the host to kick off WebRTC
              ws.send(JSON.stringify({
                type: 'viewer-joined',
                viewerId: pendingViewerId,
                viewerClientId: pending.viewerClientId || pendingViewerId,
                viewerName: pending.viewerName || '',
                viewerDeviceId: pending.viewerDeviceId || null,
                viewerFileTransferMaxBytes: pending.viewerFileTransferMaxBytes ?? -1,
                unattended: Boolean(pending.unattended),
                viewerClientKind: pending.clientKind || '',
                iceServers: createMeetingIceServers(),
                remoteSessionId: pending.remoteSessionId,
                expiresAt: pending.expiresAt?.toISOString()
              }));
              if (pending.remoteSessionId && pending.expiresAt) {
                scheduleRemoteGrantExpiry(pendingViewerId, pending.remoteSessionId, pending.expiresAt);
                void (prisma as any).remoteSession.updateMany({
                  where: { id: pending.remoteSessionId, startedAt: null }, data: { startedAt: new Date() }
                });
              }
              broadcastGlobalStats();
            }
            break;
          }

          case 'join-deny': {
            const pendingViewerId = data.viewerId;
            const pending = pendingJoins.get(pendingViewerId);
            if (!pending) break;

            clearTimeout(pending.timeout);
            pendingJoins.delete(pendingViewerId);

            const viewerWs = localClients.get(pendingViewerId);
            if (viewerWs && viewerWs.readyState === WebSocket.OPEN) {
              viewerWs.send(JSON.stringify({ type: 'joined', success: false, error: 'Connection request was denied by the host.' }));
            }
            break;
          }

          case 'unregister':
            const unregSessionId = reverseRegistry.get(connectionId);
            if (unregSessionId) {
              console.log(`[Signaling] Unregistering Session: ${unregSessionId}`);
              if (sessionRegistry.get(unregSessionId) === connectionId) {
                sessionRegistry.delete(unregSessionId);
                await redisPublisher.del(`presence:${unregSessionId}`);
                lastSeenUpdates.delete(unregSessionId);
                broadcastPresence(unregSessionId, 'offline');
              }
              reverseRegistry.delete(connectionId);
            }
            break;

          case 'request-offer':
          case 'offer':
          case 'answer':
          case 'ice-candidate':
          case 'host-stopped':
            let targetId = data.targetId;
            if (targetId && /^\d{9}$/.test(targetId)) {
              const resolvedId = sessionRegistry.get(targetId);
              if (resolvedId) targetId = resolvedId;
            }

            if (!targetId || !canForwardRemoteSignal(connectionId, targetId, data.type)) {
              ws.send(JSON.stringify({ type: 'signal-error', error: 'Signal target is not authorized for this session' }));
              break;
            }

            const targetWs = localClients.get(targetId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: data.type,
                senderId: connectionId,
                ...data
              }));
            }
            break;

          case 'meeting-join': {
            const meetingId = normalizeMeetingId(data.meetingId);
            const { user, token } = data;
            if (!meetingId) break;

            const decoded = token ? verifyToken(token) : null;
            const participantUserId = decoded?.userId || user?.id || `guest-${connectionId}`;
            let resolvedUser: any = null;
            if (decoded?.userId && (!user?.name || !user?.avatar)) {
              resolvedUser = await (prisma as any).user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, name: true, email: true, avatar: true }
              }).catch(() => null);
            }
            const participantName = String(user?.name || resolvedUser?.name || resolvedUser?.email || '').trim() || (decoded?.userId ? 'Remote 365 user' : 'Guest');

            let meeting: any = null;
            try {
              // Newest row for this code regardless of state. Filtering expired rows
              // out here made an expired code look UNREGISTERED, which fell through
              // to the ad-hoc room below and let anyone reopen it.
              meeting = await (prisma as any).remoteSession.findFirst({
                where: {
                  sessionCode: meetingId,
                  type: 'VIDEO_MEETING'
                },
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  name: true,
                  sessionCode: true,
                  createdAt: true,
                  createdById: true,
                  conversationId: true,
                  status: true,
                  startedAt: true,
                  expiresAt: true,
                  collaborators: {
                    select: { id: true, userId: true, status: true, joinedAt: true }
                  }
                }
              });
            } catch (err) {
              console.warn('[Signaling] Meeting lookup failed:', err);
            }

            // Ended meetings stay ended. An unused (ACTIVE) link expires by its
            // expiresAt, or by the instant-link window for legacy rows without one.
            // A meeting that is IN_PROGRESS is live no matter how old its link is:
            // the TTL bounds joining an unused link, not the call's length.
            const linkExpired = Boolean(meeting) && meeting.status === 'ACTIVE' && (
              meeting.expiresAt
                ? new Date(meeting.expiresAt).getTime() <= Date.now()
                : new Date(meeting.createdAt).getTime() + MEETING_LINK_TTL_MS <= Date.now()
            );
            if (meeting && (!['ACTIVE', 'IN_PROGRESS'].includes(meeting.status) || linkExpired)) {
              ws.send(JSON.stringify({ type: 'meeting-error', error: 'This meeting has ended or expired.' }));
              break;
            }

            // Guests (no token) and any client joining an unregistered code get an
            // ephemeral meeting room. Authenticated users still get the DB-backed
            // meeting object when one exists for their code.

            console.log(`[Signaling] User ${participantName || connectionId} joining meeting: ${meetingId}`);

            leaveMeetingRoom(connectionId);

            const participantUser = {
              id: participantUserId,
              name: participantName,
              avatar: user?.avatar || resolvedUser?.avatar || null,
              clientKind: String(data.clientKind || '').trim() || 'desktop'
            };
            const mediaState = {
              isMuted: Boolean(data.mediaState?.isMuted),
              isCameraOff: Boolean(data.mediaState?.isCameraOff),
              isScreenSharing: Boolean(data.mediaState?.isScreenSharing)
            };
            const joinEntry: MeetingLobbyEntry = {
              meeting,
              decodedUserId: decoded?.userId || null,
              participantUser,
              participantUserId,
              participantName,
              mediaState
            };

            // Work out who the host is. The meeting creator is always the host;
            // for an ephemeral (unregistered) code the first person in becomes
            // host so someone can admit the rest. Everyone else waits.
            let hostConnId = meetingHosts.get(meetingId);
            if (hostConnId && localClients.get(hostConnId)?.readyState !== WebSocket.OPEN) {
              meetingHosts.delete(meetingId);
              hostConnId = undefined;
            }
            const roomEmpty = (meetingRooms.get(meetingId)?.size || 0) === 0;
            const isCreator = Boolean(meeting && decoded?.userId && decoded.userId === meeting.createdById);
            // First-in-becomes-host only applies to SIGNED-IN users. An anonymous
            // guest opening a link before the host arrives must wait in the lobby
            // (they used to be promoted to host of an empty room and sat there
            // alone); their knock surfaces the moment the real host joins.
            // The one exception is the person who CREATED the room from the
            // signed-out landing page (claimHost): there is no other host, so
            // they used to wait forever for themselves.
            // (a meeting the landing created server-side while signed out has no creator either)
            const claimsHost = Boolean(data.claimHost) && (!meeting || !meeting.createdById) && !hostConnId && roomEmpty;
            const isHost = isCreator || (!meeting && !hostConnId && roomEmpty && Boolean(decoded?.userId)) || claimsHost;

            if (isHost) {
              meetingHosts.set(meetingId, connectionId);
              await finalizeMeetingJoin(connectionId, meetingId, joinEntry);
              // Surface anyone who was already waiting before the host arrived.
              const lobby = meetingLobbies.get(meetingId);
              if (lobby) {
                for (const [guestId, guestEntry] of lobby) {
                  ws.send(JSON.stringify({
                    type: 'meeting-knock',
                    meetingId,
                    guestId,
                    guestName: guestEntry.participantName
                  }));
                }
              }
              break;
            }

            // Not the host — hold in the waiting room until admitted.
            let lobby = meetingLobbies.get(meetingId);
            if (!lobby) {
              lobby = new Map();
              meetingLobbies.set(meetingId, lobby);
            }
            lobby.set(connectionId, joinEntry);
            connectionToMeeting.set(connectionId, meetingId);
            updateClientMeta(connectionId, { kind: 'meeting', userId: participantUserId, meetingId });

            ws.send(JSON.stringify({
              type: 'meeting-waiting',
              meetingId,
              meeting: meeting
                ? { id: meeting.id, name: meeting.name, sessionCode: meeting.sessionCode }
                : { id: meetingId, name: `Meeting ${meetingId.toUpperCase()}`, sessionCode: meetingId }
            }));

            if (hostConnId) {
              const hostWs = localClients.get(hostConnId);
              if (hostWs && hostWs.readyState === WebSocket.OPEN) {
                hostWs.send(JSON.stringify({
                  type: 'meeting-knock',
                  meetingId,
                  guestId: connectionId,
                  guestName: participantName
                }));
              }
            }
            break;
          }

          case 'meeting-admit': {
            const meetingId = normalizeMeetingId(data.meetingId);
            const guestId = String(data.guestId || '');
            // Only the current host may admit, and only for their own meeting.
            if (!meetingId || meetingHosts.get(meetingId) !== connectionId) break;
            const lobby = meetingLobbies.get(meetingId);
            const entry = lobby?.get(guestId);
            if (!entry) break;
            lobby!.delete(guestId);
            if (lobby!.size === 0) meetingLobbies.delete(meetingId);
            const guestWs = localClients.get(guestId);
            if (!guestWs || guestWs.readyState !== WebSocket.OPEN) break;
            await finalizeMeetingJoin(guestId, meetingId, entry);
            break;
          }

          case 'meeting-deny': {
            const meetingId = normalizeMeetingId(data.meetingId);
            const guestId = String(data.guestId || '');
            if (!meetingId || meetingHosts.get(meetingId) !== connectionId) break;
            const lobby = meetingLobbies.get(meetingId);
            if (lobby?.has(guestId)) {
              lobby.delete(guestId);
              if (lobby.size === 0) meetingLobbies.delete(meetingId);
            }
            connectionToMeeting.delete(guestId);
            const guestWs = localClients.get(guestId);
            if (guestWs && guestWs.readyState === WebSocket.OPEN) {
              guestWs.send(JSON.stringify({
                type: 'meeting-denied',
                meetingId,
                error: 'The host declined your request to join.'
              }));
            }
            break;
          }

          case 'meeting-media-state': {
            const currentMeetingId = connectionToMeeting.get(connectionId);
            const meetingId = normalizeMeetingId(data.meetingId);
            if (!currentMeetingId || meetingId !== currentMeetingId) break;

            const mediaState = {
              isMuted: Boolean(data.mediaState?.isMuted),
              isCameraOff: Boolean(data.mediaState?.isCameraOff),
              isScreenSharing: Boolean(data.mediaState?.isScreenSharing)
            };
            meetingMediaStates.set(connectionId, mediaState);

            const room = meetingRooms.get(currentMeetingId);
            if (!room) break;

            const update = JSON.stringify({
              type: 'meeting-media-state',
              meetingId: currentMeetingId,
              participantConnectionId: connectionId,
              mediaState
            });

            for (const participantId of room) {
              if (participantId === connectionId) continue;
              const pWs = localClients.get(participantId);
              if (pWs && pWs.readyState === WebSocket.OPEN) {
                pWs.send(update);
              }
            }
            break;
          }

          case 'meeting-recording': {
            const currentMeetingId = connectionToMeeting.get(connectionId);
            const meetingId = normalizeMeetingId(data.meetingId);
            if (!currentMeetingId || meetingId !== currentMeetingId) break;
            if (!meetingRooms.get(currentMeetingId)?.has(connectionId)) break;
            const byName = meetingParticipants.get(connectionId)?.name || 'A participant';
            const existing = meetingRecordings.get(currentMeetingId);
            if (data.on) {
              // Dedupe: a re-send (reconnect, double click) must not re-notify.
              if (existing) break;
              meetingRecordings.set(currentMeetingId, { byConnectionId: connectionId, byName, at: Date.now() });
              void redisPublisher.set(`meeting:recording:${currentMeetingId}`, byName, 'EX', 86400).catch(() => {});
              broadcastMeetingRecording(currentMeetingId, true, byName);
            } else {
              if (!existing) break;
              // Only the initiator stops their own recording notice.
              if (existing.byConnectionId !== connectionId) break;
              meetingRecordings.delete(currentMeetingId);
              void redisPublisher.del(`meeting:recording:${currentMeetingId}`).catch(() => {});
              broadcastMeetingRecording(currentMeetingId, false, byName);
            }
            break;
          }

          case 'meeting-chat': {
            const currentMeetingId = connectionToMeeting.get(connectionId);
            const meetingId = normalizeMeetingId(data.meetingId);
            const message = String(data.message || '').trim();
            if (!currentMeetingId || meetingId !== currentMeetingId || !message) break;

            const room = meetingRooms.get(currentMeetingId);
            if (!room) break;

            const payload = JSON.stringify({
              type: 'meeting-chat',
              meetingId: currentMeetingId,
              message: {
                id: data.id || uuidv4(),
                senderConnectionId: connectionId,
                senderName: meetingParticipants.get(connectionId)?.name || 'Participant',
                text: message.slice(0, 2000),
                createdAt: Date.now()
              }
            });

            for (const participantId of room) {
              const pWs = localClients.get(participantId);
              if (pWs && pWs.readyState === WebSocket.OPEN) {
                pWs.send(payload);
              }
            }
            break;
          }

          case 'meeting-typing': {
            const currentMeetingId = connectionToMeeting.get(connectionId);
            const meetingId = normalizeMeetingId(data.meetingId);
            if (!currentMeetingId || meetingId !== currentMeetingId) break;

            const room = meetingRooms.get(currentMeetingId);
            if (!room) break;

            const payload = JSON.stringify({
              type: 'meeting-typing',
              meetingId: currentMeetingId,
              senderConnectionId: connectionId,
              senderName: meetingParticipants.get(connectionId)?.name || 'Participant',
              isTyping: Boolean(data.isTyping)
            });

            // Relay to everyone else in the room (never echo to the sender).
            for (const participantId of room) {
              if (participantId === connectionId) continue;
              const pWs = localClients.get(participantId);
              if (pWs && pWs.readyState === WebSocket.OPEN) {
                pWs.send(payload);
              }
            }
            break;
          }

          case 'meeting-control-request': {
            const currentMeetingId = connectionToMeeting.get(connectionId);
            const meetingId = normalizeMeetingId(data.meetingId);
            const targetConnectionId = data.targetConnectionId;
            if (!currentMeetingId || meetingId !== currentMeetingId || !targetConnectionId) break;

            const room = meetingRooms.get(currentMeetingId);
            if (!room?.has(targetConnectionId)) break;

            const targetWs = localClients.get(targetConnectionId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'meeting-control-request',
                meetingId: currentMeetingId,
                requestId: data.requestId || uuidv4(),
                requesterConnectionId: connectionId,
                requesterName: meetingParticipants.get(connectionId)?.name || 'Participant'
              }));
            }
            break;
          }

          case 'meeting-control-response': {
            const currentMeetingId = connectionToMeeting.get(connectionId);
            const meetingId = normalizeMeetingId(data.meetingId);
            const targetConnectionId = data.targetConnectionId;
            if (!currentMeetingId || meetingId !== currentMeetingId || !targetConnectionId) break;

            const room = meetingRooms.get(currentMeetingId);
            if (!room?.has(targetConnectionId)) break;

            const targetWs = localClients.get(targetConnectionId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'meeting-control-response',
                meetingId: currentMeetingId,
                requestId: data.requestId,
                approverConnectionId: connectionId,
                approverName: meetingParticipants.get(connectionId)?.name || 'Participant',
                approved: Boolean(data.approved),
                accessKey: data.approved ? data.accessKey : undefined,
                password: data.approved ? data.password : undefined,
                deviceName: data.approved ? data.deviceName : undefined
              }));
            }
            break;
          }

          case 'meeting-end': {
            // Host ends the meeting for everyone: notify the room, clear the
            // lobby, drop all live state, and mark the DB session ENDED.
            const meetingId = normalizeMeetingId(data.meetingId);
            if (!meetingId || meetingHosts.get(meetingId) !== connectionId) break;

            const endedNotification = JSON.stringify({ type: 'meeting-ended', meetingId });
            const room = meetingRooms.get(meetingId);
            if (room) {
              for (const pId of room) {
                if (pId !== connectionId) {
                  const pWs = localClients.get(pId);
                  if (pWs && pWs.readyState === WebSocket.OPEN) pWs.send(endedNotification);
                }
                connectionToMeeting.delete(pId);
                meetingParticipants.delete(pId);
                meetingMediaStates.delete(pId);
              }
              meetingRooms.delete(meetingId);
            }
            const lobby = meetingLobbies.get(meetingId);
            if (lobby) {
              for (const guestId of lobby.keys()) {
                const gWs = localClients.get(guestId);
                if (gWs && gWs.readyState === WebSocket.OPEN) {
                  gWs.send(JSON.stringify({ type: 'meeting-denied', meetingId, error: 'This meeting has ended.' }));
                }
                connectionToMeeting.delete(guestId);
              }
              meetingLobbies.delete(meetingId);
            }
            meetingHosts.delete(meetingId);
            meetingPolicies.delete(meetingId);
            const emptyTimer = meetingEmptyTimers.get(meetingId);
            if (emptyTimer) {
              clearTimeout(emptyTimer);
              meetingEmptyTimers.delete(meetingId);
            }

            try {
              const meeting = await (prisma as any).remoteSession.findFirst({
                where: {
                  sessionCode: meetingId,
                  type: 'VIDEO_MEETING',
                  status: { in: ['ACTIVE', 'IN_PROGRESS'] }
                },
                orderBy: { createdAt: 'desc' },
                include: { collaborators: { select: { userId: true } } }
              });
              if (meeting) {
                await (prisma as any).remoteSession.update({
                  where: { id: meeting.id },
                  data: { status: 'ENDED', endedAt: new Date() }
                });
                void publishMeetingSync(meeting, 'ended');
                if (meeting.conversationId && meeting.createdById) {
                  await publishStructuredChatMessage(meeting.conversationId, meeting.createdById, {
                    kind: 'meeting-status',
                    remoteSessionId: meeting.id,
                    sessionCode: meeting.sessionCode,
                    status: 'ENDED',
                    event: 'ENDED',
                    text: 'Meeting ended.',
                    createdAt: new Date().toISOString()
                  });
                }
              }
            } catch (err) {
              console.warn(`[Meeting] Failed to end meeting ${meetingId}:`, err);
            }
            console.log(`[Meeting] Host ended meeting ${meetingId} for everyone.`);
            break;
          }

          case 'meeting-mute-all': {
            // Host asks every other participant to mute their microphone.
            const meetingId = normalizeMeetingId(data.meetingId);
            if (!meetingId || meetingHosts.get(meetingId) !== connectionId) break;
            const room = meetingRooms.get(meetingId);
            if (!room) break;
            const muteNotification = JSON.stringify({ type: 'meeting-mute-all', meetingId });
            for (const pId of room) {
              if (pId === connectionId) continue;
              const pWs = localClients.get(pId);
              if (pWs && pWs.readyState === WebSocket.OPEN) pWs.send(muteNotification);
            }
            break;
          }

          case 'meeting-mute-request': {
            // Host asks one participant to mute or unmute.
            const meetingId = normalizeMeetingId(data.meetingId);
            const targetConnectionId = String(data.targetConnectionId || '');
            if (!meetingId || meetingHosts.get(meetingId) !== connectionId) break;
            if (!meetingRooms.get(meetingId)?.has(targetConnectionId)) break;
            const targetWs = localClients.get(targetConnectionId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'meeting-mute-request',
                meetingId,
                muted: Boolean(data.muted)
              }));
            }
            break;
          }

          case 'meeting-policy': {
            // Host updates meeting permissions; broadcast to the whole room.
            const meetingId = normalizeMeetingId(data.meetingId);
            if (!meetingId || meetingHosts.get(meetingId) !== connectionId) break;
            const policy = { allowScreenShare: Boolean(data.policy?.allowScreenShare) };
            meetingPolicies.set(meetingId, policy);
            const room = meetingRooms.get(meetingId);
            if (!room) break;
            const policyNotification = JSON.stringify({ type: 'meeting-policy', meetingId, policy });
            for (const pId of room) {
              if (pId === connectionId) continue;
              const pWs = localClients.get(pId);
              if (pWs && pWs.readyState === WebSocket.OPEN) pWs.send(policyNotification);
            }
            break;
          }

          case 'meeting-share-request': {
            // A participant asks the meeting host for permission to share their screen.
            const currentMeetingId = connectionToMeeting.get(connectionId);
            const meetingId = normalizeMeetingId(data.meetingId);
            if (!currentMeetingId || meetingId !== currentMeetingId) break;

            const hostConnId = meetingHosts.get(currentMeetingId);
            if (!hostConnId || hostConnId === connectionId) break;

            const hostWs = localClients.get(hostConnId);
            if (hostWs && hostWs.readyState === WebSocket.OPEN) {
              hostWs.send(JSON.stringify({
                type: 'meeting-share-request',
                meetingId: currentMeetingId,
                requesterConnectionId: connectionId,
                requesterName: meetingParticipants.get(connectionId)?.name || 'Participant'
              }));
            }
            break;
          }

          case 'meeting-share-response': {
            // Only the host can grant or deny screen sharing.
            const currentMeetingId = connectionToMeeting.get(connectionId);
            const meetingId = normalizeMeetingId(data.meetingId);
            const targetConnectionId = String(data.targetConnectionId || '');
            if (!currentMeetingId || meetingId !== currentMeetingId) break;
            if (meetingHosts.get(currentMeetingId) !== connectionId) break;

            const room = meetingRooms.get(currentMeetingId);
            if (!room?.has(targetConnectionId)) break;

            const targetWs = localClients.get(targetConnectionId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'meeting-share-response',
                meetingId: currentMeetingId,
                allowed: Boolean(data.allowed)
              }));
            }
            break;
          }

          case 'meeting-signal': {
            const { targetConnectionId, signal, meetingId } = data;
            if (!targetConnectionId || !signal) break;

            const currentMeetingId = connectionToMeeting.get(connectionId);
            if (!currentMeetingId || normalizeMeetingId(meetingId) !== currentMeetingId) break;

            const room = meetingRooms.get(currentMeetingId);
            if (!room?.has(targetConnectionId)) break;

            const tWs = localClients.get(targetConnectionId);
            if (tWs && tWs.readyState === WebSocket.OPEN) {
              tWs.send(JSON.stringify({
                type: 'meeting-signal',
                senderConnectionId: connectionId,
                signal,
                meetingId
              }));
            }
            break;
          }

          case 'meeting-leave': {
            leaveMeetingRoom(connectionId);
            break;
          }
        }
      } catch (err) {
        console.error('[Signaling] Failed to process message', err);
      }
    });

    ws.on('close', async (code: number, reason: Buffer) => {
      const closeInfo = describeClient(connectionId);
      const closingMeta = clientMeta.get(connectionId);
      localClients.delete(connectionId);
      clientMeta.delete(connectionId);
      const reasonText = reason?.length ? reason.toString() : '';
      console.log(`[Signaling] Client disconnected: ${closeInfo} code=${code || 0}${reasonText ? ` reason=${reasonText}` : ''}`);
      presenceSubscriptions.delete(connectionId);
      orgSubscriptions.delete(connectionId);

      const chatUserId = connectionToUser.get(connectionId);
      if (chatUserId) {
        const set = userConnections.get(chatUserId);
        if (set) {
          set.delete(connectionId);
          if (set.size === 0) {
            userConnections.delete(chatUserId);
            // Last socket for this user closed. Give a reload / navigation time
            // to reconnect before telling contacts they went offline.
            setTimeout(() => {
              if ((userConnections.get(chatUserId)?.size || 0) === 0) {
                broadcastChatPresence(chatUserId, false).catch(() => {});
              }
            }, CHAT_OFFLINE_GRACE_MS).unref?.();
          }
        }
        connectionToUser.delete(connectionId);
      }

      // If this viewer disconnected while still pending approval, cancel the request
      if (pendingJoins.has(connectionId)) {
        const pending = pendingJoins.get(connectionId)!;
        clearTimeout(pending.timeout);
        pendingJoins.delete(connectionId);
        const hostId = sessionRegistry.get(pending.sessionId);
        if (hostId) {
          const hostWs = localClients.get(hostId);
          if (hostWs && hostWs.readyState === WebSocket.OPEN) {
            hostWs.send(JSON.stringify({ type: 'viewer-request-cancelled', viewerId: connectionId }));
          }
        }
      }

      const sessionId = reverseRegistry.get(connectionId);
      if (sessionId) {
        if (sessionRegistry.get(sessionId) === connectionId) {
          sessionRegistry.delete(sessionId);
          await redisPublisher.del(`presence:${sessionId}`).catch(() => { });
          lastSeenUpdates.delete(sessionId);
          broadcastPresence(sessionId, 'offline');
          const now = Date.now();
          recordPresenceEvent(sessionId, 'offline', {
            code: code || 0,
            version: closingMeta?.appVersion || null,
            ageSec: closingMeta ? Math.round((now - closingMeta.connectedAt) / 1000) : null,
            // How long the client had been SILENT before the socket died — a
            // large value with code 1006 means zombie/hang/network-cut, a small
            // one means a clean app exit or restart.
            silentSec: closingMeta ? Math.round((now - closingMeta.lastMessageAt) / 1000) : null,
          });
        }
        reverseRegistry.delete(connectionId);
      }

      if (viewerRegistry.has(connectionId)) {
        const sessionId = viewerRegistry.get(connectionId);
        if (sessionId) {
          const hostId = sessionRegistry.get(sessionId);
          if (hostId) {
            const hostWs = localClients.get(hostId);
            if (hostWs && hostWs.readyState === WebSocket.OPEN) {
              hostWs.send(JSON.stringify({
                type: 'viewer-left',
                viewerId: connectionId
              }));
            }
          }
        }
        viewerRegistry.delete(connectionId);
        viewerGrantIds.delete(connectionId);
        clearViewerExpiryTimers(connectionId);
        if (sessionId) void releaseDeviceSession(sessionId, connectionId);
        broadcastGlobalStats();
      }

      // Meeting cleanup
      leaveMeetingRoom(connectionId);
    });

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (pingsMissed > HEARTBEAT_MAX_MISSED) {
          console.log(`[Signaling] Terminating unresponsive client: ${describeClient(connectionId)} missed=${pingsMissed}`);
          const zombieSession = reverseRegistry.get(connectionId);
          if (zombieSession && sessionRegistry.get(zombieSession) === connectionId) {
            recordPresenceEvent(zombieSession, 'terminated-unresponsive', {
              missedPings: pingsMissed,
              version: clientMeta.get(connectionId)?.appVersion || null,
            });
          }
          ws.terminate();
          clearInterval(heartbeat);
          return;
        }
        pingsMissed++;
        try { ws.ping(); } catch { }
        ws.send(JSON.stringify({ type: 'ping' }));
        // Keep the exclusive "in session" lock alive while this viewer stays connected.
        const activeViewerSession = viewerRegistry.get(connectionId);
        if (activeViewerSession) {
          redisPublisher.expire(sessionBusyKey(activeViewerSession), SESSION_BUSY_TTL_SECONDS).catch(() => { });
        }
      } else {
        clearInterval(heartbeat);
      }
    }, HEARTBEAT_INTERVAL_MS);

  });

  // Redis Messaging for Clustering
  redisSubscriber.subscribe('signaling:forward', (err: any) => {
    if (err) console.error('[Signaling] Redis cluster subscribe failed', err);
  });

  redisSubscriber.on('message', (channel: string, message: string) => {
    if (channel === 'signaling:forward') {
      const data = JSON.parse(message);
      const targetWs = localClients.get(data.targetConnectionId);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify(data.payload));
      }
    }
  });

  redisPublisher.on('error', (err) => console.error('[Signaling] Redis Publisher Error:', err));
  redisSubscriber.on('error', (err) => console.error('[Signaling] Redis Subscriber Error:', err));

  // Listen for Chat Messages across the cluster
  redisSubscriber.subscribe('chat:new-message', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:new-message', err);
  });

  redisSubscriber.subscribe('chat:new-conversation', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:new-conversation', err);
  });

  redisSubscriber.subscribe('chat:conversation-updated', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:conversation-updated', err);
  });

  redisSubscriber.subscribe('chat:session-invite', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:session-invite', err);
  });

  redisSubscriber.subscribe('chat:read-receipt', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:read-receipt', err);
  });

  redisSubscriber.subscribe('chat:presence', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:presence', err);
  });

  redisSubscriber.subscribe('account:sync', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to account:sync', err);
  });

  redisSubscriber.subscribe('device:report', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to device:report', err);
  });

  redisSubscriber.subscribe('host:command', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to host:command', err);
  });

  // Listen for Organization Updates
  redisSubscriber.subscribe(EventChannel.ORG_UPDATES, (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to ORG_UPDATES', err);
  });

  redisSubscriber.on('message', (channel, message) => {
    if (channel === EventChannel.ORG_UPDATES) {
      try {
        const payload = JSON.parse(message);
        const { organizationId, type } = payload;
        console.log(`[Signaling] Received Org Update: ${type} for ${organizationId}`);
        // Broadcast to all clients subscribed to this organization
        const updateMsg = JSON.stringify({ type: 'team-update', payload });
        for (const [connId, subOrgId] of orgSubscriptions.entries()) {
          if (subOrgId === organizationId) {
            const clientWs = localClients.get(connId);
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(updateMsg);
            }
          }
        }
      } catch (err) {
        console.error('[Signaling] Failed to process Org Update:', err);
      }
    } else if (channel === 'chat:new-message') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        // Broadcast to all active connections for the target users
        targetUserIds.forEach((userId: string) => {
          sendToUserConnections(userId, payload);
        });
      } catch (err) {
        console.error('[Signaling] Failed to process chat:new-message:', err);
      }
    } else if (channel === 'chat:new-conversation') {
      try {
        const payload = JSON.parse(message);
        const { targetUserId, conversation } = payload;
        const conns = userConnections.get(targetUserId);
        if (conns) {
          conns.forEach(connId => {
            const clientWs = localClients.get(connId);
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'chat-invite',
                conversation
              }));
            }
          });
        }
      } catch (err) {
        console.error('[Signaling] Failed to process chat:new-conversation:', err);
      }
    } else if (channel === 'chat:read-receipt') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        targetUserIds.forEach((userId: string) => {
          sendToUserConnections(userId, payload);
        });
      } catch (err) {
        console.error('[Signaling] Failed to process chat:read-receipt:', err);
      }
    } else if (channel === 'chat:conversation-updated') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        targetUserIds.forEach((userId: string) => {
          sendToUserConnections(userId, payload);
        });
      } catch (err) {
        console.error('[Signaling] Failed to process chat:conversation-updated:', err);
      }
    } else if (channel === 'chat:presence') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        if (Array.isArray(targetUserIds)) {
          targetUserIds.forEach((userId: string) => {
            sendToUserConnections(userId, payload);
          });
        }
      } catch (err) {
        console.error('[Signaling] Failed to process chat:presence:', err);
      }
    } else if (channel === 'chat:session-invite') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        targetUserIds.forEach((userId: string) => {
          sendToUserConnections(userId, payload);
        });
        // Also push it. Until now sendChatPush was called from exactly one place — the
        // inline send-chat-message handler — so an invite reached a user with the app
        // CLOSED only by email. The socket fan-out above covers the app-open case; this
        // covers the app-closed one, and sendChatPush already skips anyone online.
        const invite = payload?.invite || {};
        const inviteCode = String(invite.sessionCode || invite.code || invite.displayCode || '');
        const inviter = String(invite.fromName || invite.sessionName || 'Someone');
        const isMeeting = String(invite.type || '') === 'meeting' || !!invite.meetingId;
        void sendChatPush(
          Array.isArray(targetUserIds) ? targetUserIds : [],
          String(payload?.actorUserId || invite.fromId || ''),
          isMeeting ? 'Meeting invitation' : 'Session invitation',
          inviteCode ? `${inviter} · ${inviteCode}` : inviter,
          String(invite.conversationId || ''),
          { kind: isMeeting ? 'meeting-invite' : 'session-invite', sessionCode: inviteCode },
        ).catch(() => {});
      } catch (err) {
        console.error('[Signaling] Failed to process chat:session-invite:', err);
      }
    } else if (channel === 'account:sync') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        if (!Array.isArray(targetUserIds)) return;
        targetUserIds.forEach((userId: string) => {
          sendToUserConnections(userId, {
            type: 'account-sync',
            scope: payload.scope,
            action: payload.action,
            entityId: payload.entityId,
            // Shown on the login screen after a forced sign-out (scope 'account').
            message: payload.message,
            changedAt: payload.changedAt || new Date().toISOString()
          });
        });
      } catch (err) {
        console.error('[Signaling] Failed to process account:sync:', err);
      }
    } else if (channel === 'device:report') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        if (!Array.isArray(targetUserIds)) return;
        targetUserIds.forEach((userId: string) => {
          sendToUserConnections(userId, { ...payload, targetUserIds: undefined });
        });
      } catch (err) {
        console.error('[Signaling] Failed to process device:report:', err);
      }
    } else if (channel === 'host:command') {
      try {
        const payload = JSON.parse(message);
        const accessKey = String(payload.accessKey || '').replace(/\s/g, '').toLowerCase();
        if (!accessKey) return;
        const hostConnId = sessionRegistry.get(accessKey);
        if (!hostConnId) return; // Host offline — nothing to update in real time.
        const hostWs = localClients.get(hostConnId);
        if (hostWs && hostWs.readyState === WebSocket.OPEN) {
          if (payload.command === 'password-updated') {
            hostWs.send(JSON.stringify({
              type: 'host-password-updated',
              password: payload.password,
              passwordRequired: payload.passwordRequired,
            }));
          }
          if (payload.command === 'platform-disconnect') {
            // The super admin blocked this device or suspended its org/owner.
            // Tell the host why, then drop the socket: the close handler clears
            // presence and tells viewers, and canRegisterHost refuses the
            // reconnect for as long as the block/suspension stands.
            hostWs.send(JSON.stringify({
              type: 'registration-error',
              error: payload.reason === 'blocked'
                ? 'This device has been disabled by the platform administrator'
                : 'This organization or account is suspended',
            }));
            hostWs.close(4003, 'platform-disconnect');
          }
        }
      } catch (err) {
        console.error('[Signaling] Failed to process host:command:', err);
      }
    }
  });
}

startServer().catch(err => {
  console.error('[Signaling] CRITICAL: Server failed to start:', err);
  process.exit(1);
});
