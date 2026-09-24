import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasPermission, prisma, verifyToken, recordActivity, redisPublisher, type Permission,
  closeStaleSessionsByCode, closeStaleSessionsById,
} from '@remotelink/shared';

/**
 * Super Admin → Device Management.
 * Platform-wide list of every device, plus block / remove actions.
 * Gated by the platform `devices:*` permissions.
 */
export default async function adminDeviceRoutes(fastify: FastifyInstance) {
  const requirePlatformPermission = async (request: FastifyRequest, reply: FastifyReply, permission: Permission) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) { reply.code(401).send({ error: 'Unauthorized' }); return false; }
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded) { reply.code(401).send({ error: 'Invalid token' }); return false; }
    if (!hasPermission(decoded.role, permission)) { reply.code(403).send({ error: 'Platform management access required' }); return false; }
    return decoded;
  };

  const actorFromDecoded = async (decoded: any) => {
    const u = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, name: true, email: true } });
    return { id: u?.id ?? decoded.userId, name: u?.name || u?.email || 'Super Admin' };
  };

  // List every device on the platform.
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'devices:viewAll');
    if (!decoded) return;

    const devices = await prisma.device.findMany({
      select: {
        id: true,
        name: true,
        accessKey: true,
        deviceType: true,
        status: true,
        ownerId: true,
        lastSeenAt: true,
        createdAt: true,
        organization: { select: { name: true } },
        owner: { select: { name: true, email: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    // Active sessions per device — live REMOTE_CONTROL RemoteSessions matched by
    // sessionCode == device.accessKey (the legacy Session table is never written).
    const keys = devices.map((d: any) => d.accessKey).filter(Boolean);
    const rs = keys.length
      ? await (prisma as any).remoteSession.groupBy({
          by: ['sessionCode'],
          where: { sessionCode: { in: keys }, type: 'REMOTE_CONTROL', status: 'ACTIVE', startedAt: { not: null }, endedAt: null, expiresAt: { gt: new Date() } },
          _count: { _all: true },
        })
      : [];
    const sessByKey = new Map<string, number>(rs.map((r: any) => [r.sessionCode, r._count?._all || 0]));

    // DB rows can stay ACTIVE forever after an unclean disconnect (crash,
    // dropped link) — the "idle device shows In session" bug. The signaling
    // service keeps the live truth in Redis (`session:active:<accessKey>`,
    // 120s TTL refreshed by the viewer heartbeat): only count a session when
    // that key exists, and close the stale DB rows in passing so history and
    // every other query stop seeing phantom active sessions.
    const dbActiveKeys = Array.from(sessByKey.keys()).filter((k) => (sessByKey.get(k) || 0) > 0);
    if (dbActiveKeys.length) {
      let busy: (string | null)[];
      try {
        busy = await redisPublisher.mget(...dbActiveKeys.map((k) => `session:active:${k}`));
      } catch {
        busy = dbActiveKeys.map(() => '1'); // Redis down — trust the DB rather than flap everything to Online
      }
      const staleKeys = dbActiveKeys.filter((_, i) => busy[i] == null);
      for (const k of staleKeys) sessByKey.set(k, 0);
      // Closing waits for a second sighting (see closeStaleSessionsByCode) so
      // a Redis flush can't end every live session from one page view.
      closeStaleSessionsByCode(staleKeys, dbActiveKeys.filter((k) => !staleKeys.includes(k)))
        .catch(() => { /* self-heal is best-effort; the Redis check already fixed the response */ });
    }

    // Live presence is the source of truth for online/offline — the signaling
    // service stores it in Redis (`presence:<accessKey>`), not on the device row.
    let onlineKeys: (string | null)[] = [];
    try {
      // The signaling service lowercases the access key before writing the
      // presence flag (`presence:<accessKey>`), so match that casing here.
      onlineKeys = devices.length
        ? await redisPublisher.mget(...devices.map((d: any) => `presence:${String(d.accessKey || '').toLowerCase()}`))
        : [];
    } catch { onlineKeys = []; }

    const deriveStatus = (d: any, sessions: number, online: boolean): string => {
      if (String(d.status || '').toUpperCase() === 'BLOCKED') return 'Disabled';
      if (sessions > 0) return 'In session';
      if (online) return 'Online';
      if (!d.ownerId) return 'Unregistered';
      return 'Offline';
    };

    const result = devices.map((d: any, i: number) => {
      const sessions = sessByKey.get(d.accessKey) || 0;
      const online = onlineKeys[i] != null;
      return {
        id: d.id,
        name: d.name || 'Unnamed device',
        deviceId: `#${(d.accessKey || '').slice(-6).toUpperCase()}`,
        type: d.deviceType,
        org: d.organization?.name ?? null,
        userName: d.owner?.name ?? null,
        userEmail: d.owner?.email ?? null,
        status: deriveStatus(d, sessions, online),
        sessions,
        lastSeenAt: d.lastSeenAt,
        createdAt: d.createdAt,
      };
    });

    return reply.send(result);
  });

  // Single device detail — profile + recent session history.
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'devices:viewAll');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const device = await prisma.device.findUnique({
      where: { id },
      select: {
        id: true, name: true, accessKey: true, deviceType: true, status: true,
        ownerId: true, createdAt: true, lastSeenAt: true,
        organization: { select: { name: true } },
        owner: { select: { name: true, email: true } },
      },
    });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    // Remote-access history for a device lives in RemoteSession (REMOTE_CONTROL),
    // matched by sessionCode == device.accessKey. A grant only becomes a real
    // session once a viewer connects (startedAt set); otherwise it just expires
    // after its link TTL — so duration is only meaningful when startedAt exists.
    const nowMs = Date.now();
    const sessions = await (prisma as any).remoteSession.findMany({
      where: { sessionCode: device.accessKey, type: 'REMOTE_CONTROL' },
      select: { id: true, status: true, createdAt: true, startedAt: true, endedAt: true, expiresAt: true, createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const sessStatus = (s: any): string => {
      const st = String(s.status || '').toUpperCase();
      const expired = s.expiresAt && new Date(s.expiresAt).getTime() <= nowMs;
      if (s.startedAt && !s.endedAt && st === 'ACTIVE' && !expired) return 'Active';
      if (s.startedAt && s.endedAt) return 'Ended';
      if (!s.startedAt) return st === 'ACTIVE' && !expired && !s.endedAt ? 'Pending' : 'Expired';
      return 'Ended';
    };
    // Same live-truth guard as the list endpoint: a DB row can stay ACTIVE
    // after an unclean disconnect, so "Active" only counts while the signaling
    // service's `session:active:<accessKey>` heartbeat key exists.
    let dbActive = sessions.filter((s: any) => sessStatus(s) === 'Active');
    if (dbActive.length && device.accessKey) {
      let live = true;
      try { live = (await redisPublisher.get(`session:active:${device.accessKey}`)) != null; } catch { live = true; }
      const activeIds = dbActive.map((s: any) => s.id);
      closeStaleSessionsById(live ? [] : activeIds, live ? activeIds : []).catch(() => { /* best-effort cleanup */ });
      if (!live) {
        for (const s of dbActive) { s.status = 'ENDED'; s.endedAt = new Date(); }
        dbActive = [];
      }
    }
    const activeCount = dbActive.length;

    let online = false;
    try { online = (await redisPublisher.get(`presence:${String(device.accessKey || '').toLowerCase()}`)) != null; } catch { online = false; }
    const status = String(device.status || '').toUpperCase() === 'BLOCKED' ? 'Disabled'
      : activeCount > 0 ? 'In session'
      : online ? 'Online'
      : !device.ownerId ? 'Unregistered'
      : 'Offline';

    return reply.send({
      id: device.id,
      name: device.name || 'Unnamed device',
      deviceId: `#${(device.accessKey || '').slice(-6).toUpperCase()}`,
      type: device.deviceType,
      org: device.organization?.name ?? null,
      ownerName: device.owner?.name ?? null,
      ownerEmail: device.owner?.email ?? null,
      status,
      activeSessions: activeCount,
      registeredAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      sessions: sessions.map((s: any) => ({
        id: s.id,
        viewerName: s.createdBy?.name ?? null,
        viewerEmail: s.createdBy?.email ?? null,
        requestedAt: s.createdAt,
        startTime: s.startedAt,
        endTime: s.endedAt,
        status: sessStatus(s),
      })),
    });
  });

  // Block / unblock a device.
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { status } = request.body as { status?: string };
    if (!status || !['BLOCKED', 'OFFLINE'].includes(status)) {
      return reply.code(400).send({ error: 'Status must be BLOCKED or OFFLINE' });
    }
    const decoded = await requirePlatformPermission(request, reply, 'devices:block');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const device = await prisma.device.findUnique({ where: { id }, select: { id: true, name: true, organizationId: true, accessKey: true } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    await prisma.device.update({ where: { id }, data: { status } });

    if (status === 'BLOCKED') {
      // Enforcement, not just a badge: verify-access and signaling now refuse
      // a BLOCKED device, and a host that is online right now is kicked so it
      // stops being reachable the moment the admin clicks. Its presence key
      // goes too, so the fleet views flip to Disabled immediately.
      const key = String(device.accessKey || '').replace(/\s/g, '').toLowerCase();
      if (key) {
        await redisPublisher.publish('host:command', JSON.stringify({ command: 'platform-disconnect', accessKey: key, reason: 'blocked' })).catch(() => { /* best-effort */ });
        await redisPublisher.del(`presence:${key}`).catch(() => { /* best-effort */ });
      }
    }

    const actor = await actorFromDecoded(decoded);
    await recordActivity(device.organizationId, status === 'BLOCKED' ? 'DEVICE_BLOCKED' : 'DEVICE_UNBLOCKED', `Device "${device.name || 'device'}" ${status === 'BLOCKED' ? 'blocked' : 'unblocked'} by ${actor.name}`, actor);
    return reply.send({ success: true });
  });

  // Remove a device (and its dependent records). Guarded by the platform-only
  // `devices:block` permission — `devices:remove` is also granted to org
  // OWNER/ADMIN roles, which let any org admin hard-delete ANY tenant's device
  // through this unscoped endpoint.
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'devices:block');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const device = await prisma.device.findUnique({ where: { id }, select: { id: true, name: true, organizationId: true } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    try {
      await prisma.$transaction(async (tx: any) => {
        await tx.trustedDevice.deleteMany({ where: { hostDeviceId: id } });
        await tx.savedDevice.deleteMany({ where: { deviceId: id } });
        await tx.session.deleteMany({ where: { hostId: id } });
        await tx.device.delete({ where: { id } });
      });
    } catch (err: any) {
      const server = (fastify as any).log || console;
      server.error(`[Auth-Service] Failed to remove device ${id}:`, err);
      return reply.code(500).send({ error: 'Failed to remove device' });
    }

    const actor = await actorFromDecoded(decoded);
    await recordActivity(device.organizationId, 'DEVICE_REMOVED', `Device "${device.name || 'device'}" removed by ${actor.name}`, actor);
    return reply.send({ success: true });
  });
}
