import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, prisma, redisPublisher, verifyToken, closeStaleSessionsById, type Permission } from '@remotelink/shared';

/**
 * Super Admin → Remote Session Management.
 * Platform-wide list of remote sessions, plus delete.
 *
 * Guards MUST be platform-only permissions: `sessions:monitorAll` /
 * `sessions:terminateAny` are also granted to org OWNER/ADMIN roles, so using
 * them here exposed every tenant's sessions to any org admin token. The list
 * is gated by `audit:viewPlatform` and delete by `platform:manage` — both
 * SUPER_ADMIN-only.
 */
export default async function adminSessionRoutes(fastify: FastifyInstance) {
  const requirePlatformPermission = async (request: FastifyRequest, reply: FastifyReply, permission: Permission) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) { reply.code(401).send({ error: 'Unauthorized' }); return false; }
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded) { reply.code(401).send({ error: 'Invalid token' }); return false; }
    if (!hasPermission(decoded.role, permission)) { reply.code(403).send({ error: 'Platform management access required' }); return false; }
    return decoded;
  };

  // List every remote session on the platform.
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'audit:viewPlatform');
    if (!decoded) return;

    const sessions = await prisma.remoteSession.findMany({
      select: {
        id: true,
        sessionCode: true,
        name: true,
        type: true,
        status: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        expiresAt: true,
        createdBy: { select: { name: true, email: true, organization: { select: { name: true } } } },
        _count: { select: { collaborators: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Derive an honest display status instead of echoing the raw DB column —
    // rows left ACTIVE by unclean disconnects otherwise show "ACTIVE" forever
    // (same phantom-session bug as the device tables). For rows that still
    // look live, the Redis `session:active:<code>` heartbeat key is the truth.
    const now = Date.now();
    const looksLive = (s: any) =>
      String(s.status).toUpperCase() === 'ACTIVE' && s.startedAt && !s.endedAt &&
      (!s.expiresAt || new Date(s.expiresAt).getTime() > now);
    const liveCandidates = sessions.filter((s: any) => s.type === 'REMOTE_CONTROL' && looksLive(s) && s.sessionCode);
    const liveSet = new Set<string>();
    if (liveCandidates.length) {
      try {
        const busy = await redisPublisher.mget(...liveCandidates.map((s: any) => `session:active:${s.sessionCode}`));
        liveCandidates.forEach((s: any, i: number) => { if (busy[i] != null) liveSet.add(s.id); });
        const staleIds = liveCandidates.filter((s: any) => !liveSet.has(s.id)).map((s: any) => s.id);
        // Closing waits for a second sighting (see closeStaleSessionsById) so
        // a Redis flush can't end every live session from one page view.
        closeStaleSessionsById(staleIds, Array.from(liveSet)).catch(() => { /* best-effort cleanup */ });
      } catch {
        // Redis down — trust the DB rather than flag everything ended.
        liveCandidates.forEach((s: any) => liveSet.add(s.id));
      }
    }
    const deriveStatus = (s: any): string => {
      const st = String(s.status).toUpperCase();
      if (s.type === 'REMOTE_CONTROL' && looksLive(s)) return liveSet.has(s.id) ? 'ACTIVE' : 'ENDED';
      if (s.startedAt && s.endedAt) return 'ENDED';
      if (st === 'ACTIVE' && !s.startedAt) {
        return s.expiresAt && new Date(s.expiresAt).getTime() <= now ? 'EXPIRED' : 'PENDING';
      }
      if (st === 'ACTIVE' && s.expiresAt && new Date(s.expiresAt).getTime() <= now) return 'EXPIRED';
      return s.status;
    };

    const result = sessions.map((s: any) => ({
      id: s.id,
      code: s.sessionCode || s.name || s.id.slice(0, 8),
      name: s.name,
      type: s.type,
      host: s.createdBy?.name || s.createdBy?.email || null,
      hostEmail: s.createdBy?.email || null,
      org: s.createdBy?.organization?.name ?? null,
      participants: s._count?.collaborators ?? 0,
      status: deriveStatus(s),
      createdAt: s.createdAt,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));

    return reply.send(result);
  });

  // Delete a remote session (collaborators cascade).
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'platform:manage');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const session = await prisma.remoteSession.findUnique({ where: { id }, select: { id: true } });
    if (!session) return reply.code(404).send({ error: 'Session not found' });

    try {
      await prisma.remoteSession.delete({ where: { id } });
    } catch (err: any) {
      const server = (fastify as any).log || console;
      server.error(`[Auth-Service] Failed to delete remote session ${id}:`, err);
      return reply.code(500).send({ error: 'Failed to delete session' });
    }
    return reply.send({ success: true });
  });
}
