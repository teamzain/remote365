import { createHmac } from 'crypto';
import { FastifyRequest } from 'fastify';
import { redisPublisher } from '@remotelink/shared';

/**
 * Redis-backed auth sessions (one per signed-in client). Shared by the
 * password/2FA login routes (auth.ts) and the Google OAuth callback
 * (oauth.ts). Concurrent logins per account are capped at the org plan's
 * maxConcurrentSessions (see enforceMaxSessions): when a fresh sign-in
 * pushes the count above the cap, the OLDEST sessions are revoked so /me
 * and /refresh reject them on their next check. Owner and each member get
 * this cap independently.
 */

export const AUTH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const authSessionKey = (userId: string, sessionId: string) => `auth:sessions:${userId}:${sessionId}`;
export const authSessionIndexKey = (userId: string) => `auth:sessions:${userId}`;
export const authSessionRevokedKey = (userId: string, sessionId: string) => `auth:sessions:revoked:${userId}:${sessionId}`;

export const legacySessionIdFromToken = (token: string) =>
  `legacy-${createHmac('sha256', process.env.JWT_SECRET || 'remote365-session').update(token).digest('hex').slice(0, 24)}`;

export const requestIp = (request: FastifyRequest) => {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return request.ip || 'unknown';
};

export async function saveAuthSession(user: any, sessionId: string, request: FastifyRequest) {
  const revoked = await redisPublisher.exists(authSessionRevokedKey(user.id, sessionId));
  if (revoked) throw new Error('Session revoked');

  const key = authSessionKey(user.id, sessionId);
  const existingRaw = await redisPublisher.get(key);
  const existing = existingRaw ? JSON.parse(existingRaw) : {};
  const now = new Date().toISOString();
  const session = {
    id: sessionId,
    userId: user.id,
    ip: requestIp(request),
    userAgent: request.headers['user-agent'] || 'Unknown',
    createdAt: existing.createdAt || now,
    lastSeen: now
  };

  await redisPublisher.set(key, JSON.stringify(session), 'EX', AUTH_SESSION_TTL_SECONDS);
  await redisPublisher.sadd(authSessionIndexKey(user.id), sessionId);
  await redisPublisher.expire(authSessionIndexKey(user.id), AUTH_SESSION_TTL_SECONDS);
  return session;
}

// How often one session's lastSeen is refreshed by ordinary API traffic.
const AUTH_SESSION_TOUCH_INTERVAL_SECONDS = 120;

/**
 * Refresh a session's lastSeen (and IP) from any authenticated request, at
 * most once per touch interval, so Settings → Active Sign-Ins shows when a
 * device was really last used rather than when it signed in. A session that
 * is not in Redis (legacy token) is left alone: /sessions and /refresh create it.
 */
export async function touchAuthSession(userId: string, sessionId: string, request: FastifyRequest) {
  const fresh = await redisPublisher.set(`auth:sessions:seen:${userId}:${sessionId}`, '1', 'EX', AUTH_SESSION_TOUCH_INTERVAL_SECONDS, 'NX');
  if (fresh !== 'OK') return;
  const key = authSessionKey(userId, sessionId);
  const raw = await redisPublisher.get(key);
  if (!raw) return;
  const session = JSON.parse(raw);
  session.lastSeen = new Date().toISOString();
  session.ip = requestIp(request);
  await redisPublisher.set(key, JSON.stringify(session), 'EX', AUTH_SESSION_TTL_SECONDS);
}

/** Revoke every session for the account (deactivation / permanent deletion):
 * the user's next /me or token refresh fails everywhere, forcing a re-login. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const sessionIds: string[] = await redisPublisher.smembers(authSessionIndexKey(userId));
  for (const sid of sessionIds) {
    await redisPublisher.del(authSessionKey(userId, sid));
    await redisPublisher.set(authSessionRevokedKey(userId, sid), '1', 'EX', AUTH_SESSION_TTL_SECONDS);
  }
  await redisPublisher.del(authSessionIndexKey(userId));
  return sessionIds.length;
}

/** Revoke every session except `keepSessionId`. Returns how many were kicked. */
export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const sessionIds: string[] = await redisPublisher.smembers(authSessionIndexKey(userId));
  const others = sessionIds.filter((sid) => sid && sid !== keepSessionId);
  for (const sid of others) {
    await redisPublisher.del(authSessionKey(userId, sid));
    await redisPublisher.srem(authSessionIndexKey(userId), sid);
    await redisPublisher.set(authSessionRevokedKey(userId, sid), '1', 'EX', AUTH_SESSION_TTL_SECONDS);
  }
  if (others.length > 0) {
    console.log(`[Auth] Single-session policy: revoked ${others.length} other session(s) for user ${userId}`);
  }
  return others.length;
}

/**
 * Cap concurrent logins for a user at `maxSessions` (from the effective plan's
 * maxConcurrentSessions). The just-issued `keepSessionId` is always retained;
 * of the rest, the OLDEST are revoked until the total is <= maxSessions.
 * maxSessions of -1, 0, or a non-finite value means unlimited (no-op).
 * Returns how many extra sessions were kicked.
 */
export async function enforceMaxSessions(userId: string, keepSessionId: string, maxSessions: number): Promise<number> {
  if (!Number.isFinite(maxSessions) || maxSessions <= 0) return 0;

  const sessionIds: string[] = await redisPublisher.smembers(authSessionIndexKey(userId));
  if (sessionIds.length <= maxSessions) return 0;

  const keys = sessionIds.map((sid) => authSessionKey(userId, sid));
  const rows = keys.length > 0 ? await redisPublisher.mget(...keys) : [];

  type Entry = { sid: string; lastSeen: number; alive: boolean };
  const entries: Entry[] = sessionIds.map((sid, i) => {
    const raw = rows[i];
    if (!raw) return { sid, lastSeen: 0, alive: false };
    try {
      const parsed = JSON.parse(raw);
      const ts = Date.parse(parsed?.lastSeen || parsed?.createdAt || '') || 0;
      return { sid, lastSeen: ts, alive: true };
    } catch {
      return { sid, lastSeen: 0, alive: false };
    }
  });

  const staleSids = entries.filter((e) => !e.alive).map((e) => e.sid);
  if (staleSids.length > 0) {
    await redisPublisher.srem(authSessionIndexKey(userId), ...staleSids);
  }

  const alive = entries.filter((e) => e.alive);
  if (alive.length <= maxSessions) return 0;

  // Keep the just-issued session first, then the newest others; kick the rest (oldest first).
  const sortable = alive.filter((e) => e.sid !== keepSessionId).sort((a, b) => b.lastSeen - a.lastSeen);
  const keepOthers = sortable.slice(0, Math.max(0, maxSessions - 1));
  const keepSet = new Set<string>([keepSessionId, ...keepOthers.map((e) => e.sid)]);
  const toKick = alive.filter((e) => !keepSet.has(e.sid));

  for (const entry of toKick) {
    await redisPublisher.del(authSessionKey(userId, entry.sid));
    await redisPublisher.srem(authSessionIndexKey(userId), entry.sid);
    await redisPublisher.set(authSessionRevokedKey(userId, entry.sid), '1', 'EX', AUTH_SESSION_TTL_SECONDS);
  }

  if (toKick.length > 0) {
    console.log(`[Auth] Concurrent-session cap (${maxSessions}): kicked ${toKick.length} older session(s) for user ${userId}`);
  }
  return toKick.length;
}
