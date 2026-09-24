import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, prisma, verifyToken, recordActivity, redisPublisher, effectivePlanId, findMergedPlan, type Permission } from '@remotelink/shared';
import { revokeAllSessions } from '../utils/authSessions';
import { cancelBillingForUser } from '../utils/billingAdmin';

/**
 * Super Admin → User Management.
 * Platform-wide list of every user across all organizations (super admins are
 * never listed), plus suspend / activate / soft-delete actions.
 * Gated by the platform `users:*` permissions.
 */
export default async function userRoutes(fastify: FastifyInstance) {
  const requirePlatformPermission = async (request: FastifyRequest, reply: FastifyReply, permission: Permission) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded) {
      reply.code(401).send({ error: 'Invalid token' });
      return false;
    }
    if (!hasPermission(decoded.role, permission)) {
      reply.code(403).send({ error: 'Platform management access required' });
      return false;
    }
    return decoded;
  };

  const actorFromDecoded = async (decoded: any) => {
    const u = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, name: true, email: true } });
    return { id: u?.id ?? decoded.userId, name: u?.name || u?.email || 'Super Admin' };
  };

  // Suspending or deleting a user must actually lock them out, not just flip a
  // column: their auth sessions are revoked (so /me and token refresh fail
  // everywhere within seconds), their signed-in apps are told to sign out right
  // now, and the hosts they own are kicked off signaling — which also refuses
  // to re-register a device whose owner is suspended.
  const lockOutUser = async (userId: string, action: 'suspended' | 'deleted') => {
    await revokeAllSessions(userId).catch(() => { /* best-effort */ });
    await redisPublisher.publish('account:sync', JSON.stringify({
      type: 'account-sync',
      scope: 'account',
      action,
      entityId: userId,
      targetUserIds: [userId],
      message: action === 'deleted'
        ? 'Your account has been removed by the platform administrator.'
        : 'Your account has been suspended. Please contact support.',
      changedAt: new Date().toISOString(),
    })).catch(() => { /* best-effort */ });
    const devices = await prisma.device.findMany({ where: { ownerId: userId }, select: { accessKey: true } });
    for (const device of devices) {
      const key = String(device.accessKey || '').replace(/\s/g, '').toLowerCase();
      if (!key) continue;
      await redisPublisher.publish('host:command', JSON.stringify({ command: 'platform-disconnect', accessKey: key, reason: `owner-${action}` })).catch(() => { /* best-effort */ });
      await redisPublisher.del(`presence:${key}`).catch(() => { /* best-effort */ });
    }
  };

  // List every (non super-admin, non-deleted) user on the platform.
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'users:viewAll');
    if (!decoded) return;

    const users = await prisma.user.findMany({
      where: { role: { not: 'SUPER_ADMIN' }, status: { not: 'DELETED' } as any },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        password: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Real last-login per user (latest successful login event). `updatedAt`
    // moves on any edit — suspend, plan change — which made dormant accounts
    // read as "logged in today" the moment an admin touched them.
    const userIds = users.map((u: any) => u.id);
    const lastLogins = userIds.length
      ? await prisma.loginEvent.groupBy({ by: ['userId'], where: { userId: { in: userIds }, result: 'SUCCESS' }, _max: { createdAt: true } })
      : [];
    const lastLoginByUser = new Map(lastLogins.map((l: any) => [l.userId, l._max?.createdAt ?? null]));

    const result = users.map((u: any) => {
      const userStatus = String(u.status || 'ACTIVE').toUpperCase();
      const orgStatus = String(u.organization?.status || 'ACTIVE').toUpperCase();
      const blocked = userStatus === 'SUSPENDED' || orgStatus === 'SUSPENDED' || orgStatus === 'DELETED';
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        organization: u.organization?.name ?? null,
        organizationId: u.organization?.id ?? null,
        status: blocked ? 'SUSPENDED' : 'ACTIVE',
        // Why the account is blocked: a suspended organization overrides the
        // user's own flag, so "Activate User" cannot help — the console needs
        // to say so instead of reporting a no-op as success.
        orgSuspended: orgStatus === 'SUSPENDED' || orgStatus === 'DELETED',
        userSuspended: userStatus === 'SUSPENDED',
        provider: u.password ? 'local' : 'google',
        createdAt: u.createdAt,
        lastActive: lastLoginByUser.get(u.id) ?? null,
      };
    });

    return reply.send(result);
  });

  // Full profile for the user details page.
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'users:viewAll');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        password: true,
        is2FAEnabled: true,
        language: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true, status: true } },
        department: { select: { name: true } },
        subscription: { select: { plan: true, customPlanKey: true, status: true, currentPeriodEnd: true } },
        _count: { select: { devices: true } },
      },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const u: any = user;
    const userStatus = String(u.status || 'ACTIVE').toUpperCase();
    const orgStatus = String(u.organization?.status || 'ACTIVE').toUpperCase();
    const blocked = userStatus === 'SUSPENDED' || userStatus === 'DELETED' || orgStatus === 'SUSPENDED' || orgStatus === 'DELETED';
    // Same resolver as the org pages (custom plan key wins over the enum).
    const planId = u.subscription ? effectivePlanId(u.subscription) : null;
    const planName = planId ? (await findMergedPlan(planId))?.name ?? null : null;
    const lastLogin = await prisma.loginEvent.findFirst({
      where: { userId: id, result: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return reply.send({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: blocked ? 'SUSPENDED' : 'ACTIVE',
      orgSuspended: orgStatus === 'SUSPENDED' || orgStatus === 'DELETED',
      userSuspended: userStatus === 'SUSPENDED' || userStatus === 'DELETED',
      organization: u.organization?.name ?? null,
      organizationId: u.organization?.id ?? null,
      department: u.department?.name ?? null,
      plan: planId,
      planName,
      planStatus: u.subscription?.status ?? null,
      planRenews: u.subscription?.currentPeriodEnd ?? null,
      is2FAEnabled: !!u.is2FAEnabled,
      provider: u.password ? 'Email & password' : 'Google',
      language: u.language ?? 'en',
      deviceCount: u._count?.devices ?? 0,
      createdAt: u.createdAt,
      lastActive: lastLogin?.createdAt ?? null,
    });
  });

  // A user's login history (success + failed attempts) for the details page.
  fastify.get('/:id/login-details', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'users:viewLoginHistory');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const events = await prisma.loginEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send(events);
  });

  // Suspend / activate a user.
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { status } = request.body as { status?: string };
    if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return reply.code(400).send({ error: 'Status must be ACTIVE or SUSPENDED' });
    }
    const decoded = await requirePlatformPermission(request, reply, status === 'ACTIVE' ? 'users:activate' : 'users:deactivate');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, organizationId: true } });
    if (!target) return reply.code(404).send({ error: 'User not found' });
    if (target.role === 'SUPER_ADMIN') return reply.code(403).send({ error: 'Cannot modify a platform admin' });

    await prisma.user.update({ where: { id }, data: { status } as any });
    if (status === 'SUSPENDED') await lockOutUser(id, 'suspended');

    const actor = await actorFromDecoded(decoded);
    const who = target.name || target.email;
    await recordActivity(
      target.organizationId,
      status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      `${who} ${status === 'SUSPENDED' ? 'suspended' : 'activated'} by ${actor.name}`,
      actor,
    );
    return reply.send({ success: true });
  });

  // Soft-delete a user (status DELETED; removed from the list, blocked from signing in).
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'users:deactivate');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, organizationId: true } });
    if (!target) return reply.code(404).send({ error: 'User not found' });
    if (target.role === 'SUPER_ADMIN') return reply.code(403).send({ error: 'Cannot delete a platform admin' });

    await prisma.user.update({ where: { id }, data: { status: 'DELETED' } as any });
    await lockOutUser(id, 'deleted');
    // A deleted OWNER is the payer — their subscription must stop billing.
    if (target.role === 'OWNER') await cancelBillingForUser(id, request.headers.authorization, 'owner deleted');

    const actor = await actorFromDecoded(decoded);
    await recordActivity(target.organizationId, 'USER_DELETED', `${target.name || target.email} deleted by ${actor.name}`, actor);
    return reply.send({ success: true });
  });

  // Force logout: revoke all of the user's auth sessions so their next token
  // refresh fails and they must sign in again.
  fastify.post('/:id/force-logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'users:forceLogout');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, organizationId: true } });
    if (!target) return reply.code(404).send({ error: 'User not found' });

    try {
      await revokeAllSessions(id);
    } catch (err: any) {
      request.log?.warn(`[Users] force-logout redis error: ${err?.message || err}`);
    }

    const actor = await actorFromDecoded(decoded);
    await recordActivity(target.organizationId, 'USER_FORCE_LOGOUT', `${target.name || target.email} was force logged out by ${actor.name}`, actor);
    return reply.send({ success: true });
  });
}
