import { prisma } from './db';
import { redisPublisher } from './redis';

/**
 * Phantom-session guard for the admin read paths.
 *
 * A RemoteSession row can stay ACTIVE forever after an unclean disconnect, so
 * the admin views treat the signaling heartbeat key (`session:active:<code>`,
 * refreshed by the viewer, short TTL) as the truth and close rows whose key is
 * gone. One missing key is not proof, though: after a Redis restart or flush
 * EVERY key is gone until the next heartbeat lands, and a single admin page
 * view in that window used to end every genuinely live session on the
 * platform.
 *
 * So a row is only closed once its key has been seen missing on two checks at
 * least STALE_CONFIRM_MS apart. The first sighting leaves a marker; a key that
 * is present again clears its marker. Callers still report the session as not
 * live on the first sighting (the response stays truthful) — only the database
 * write waits for confirmation.
 */
export const STALE_CONFIRM_MS = 60_000;
const MARKER_TTL_SECONDS = 15 * 60;

const markerKey = (namespace: string, handle: string) => `session:stale-seen:${namespace}:${handle}`;

/**
 * Handles (session ids or codes) whose heartbeat key has now been missing on
 * two spaced checks. `present` handles get their marker cleared.
 */
export async function confirmStaleSessions(missing: string[], present: string[] = [], namespace = 'id'): Promise<string[]> {
  const stale = Array.from(new Set(missing.filter(Boolean)));
  const live = Array.from(new Set(present.filter(Boolean)));
  if (!stale.length && !live.length) return [];
  try {
    const seen: (string | null)[] = stale.length
      ? await redisPublisher.mget(...stale.map((h) => markerKey(namespace, h)))
      : [];
    const now = Date.now();
    const confirmed: string[] = [];
    const pipeline = redisPublisher.pipeline();
    stale.forEach((handle, i) => {
      const firstSeen = Number(seen[i]);
      if (seen[i] && Number.isFinite(firstSeen) && now - firstSeen >= STALE_CONFIRM_MS) {
        confirmed.push(handle);
        pipeline.del(markerKey(namespace, handle));
      } else if (!seen[i]) {
        pipeline.set(markerKey(namespace, handle), String(now), 'EX', MARKER_TTL_SECONDS);
      }
    });
    for (const handle of live) pipeline.del(markerKey(namespace, handle));
    await pipeline.exec();
    return confirmed;
  } catch {
    return []; // Redis trouble — never close anything on a guess.
  }
}

/** Close REMOTE_CONTROL rows (by id) once their missing heartbeat is confirmed. */
export async function closeStaleSessionsById(missingIds: string[], liveIds: string[] = []): Promise<number> {
  const confirmed = await confirmStaleSessions(missingIds, liveIds, 'id');
  if (!confirmed.length) return 0;
  const res = await (prisma as any).remoteSession.updateMany({
    where: { id: { in: confirmed }, status: 'ACTIVE', endedAt: null },
    data: { status: 'ENDED', endedAt: new Date() },
  });
  return res?.count ?? 0;
}

/** Same, keyed by session code (the device access key) for the per-device views. */
export async function closeStaleSessionsByCode(missingCodes: string[], liveCodes: string[] = []): Promise<number> {
  const confirmed = await confirmStaleSessions(missingCodes, liveCodes, 'code');
  if (!confirmed.length) return 0;
  const res = await (prisma as any).remoteSession.updateMany({
    where: { sessionCode: { in: confirmed }, type: 'REMOTE_CONTROL', status: 'ACTIVE', startedAt: { not: null }, endedAt: null },
    data: { status: 'ENDED', endedAt: new Date() },
  });
  return res?.count ?? 0;
}
