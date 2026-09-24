import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, prisma, verifyToken, recordActivity, redisPublisher, type Permission, resolveRoleFeatureMatrix, ROLE_FEATURE_KEYS, CONFIGURABLE_ROLES, userHasPermission, getMergedPlanCatalog, closeStaleSessionsByCode, effectivePlanId, findMergedPlan } from '@remotelink/shared';
import { revokeAllSessions } from '../utils/authSessions';
import { cancelBillingForUser } from '../utils/billingAdmin';

export default async function organizationRoutes(fastify: FastifyInstance) {
  // Load the acting user's role + per-user overrides so org-scoped gates
  // honour owner grants/revokes, not just the role default.
  const loadActor = async (userId?: string | null) => {
    if (!userId) return null;
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, permissionOverrides: true, organizationId: true },
    });
  };
  // Resolves the acting (super) admin's display name for activity log entries.
  const actorFromDecoded = async (decoded: any) => {
    const u = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, name: true, email: true } });
    return { id: u?.id ?? decoded.userId, name: u?.name || u?.email || 'Super Admin' };
  };

  // Helper to verify authenticated organization management access.
  const requirePlatformPermission = async (request: FastifyRequest, reply: FastifyReply, permission: Permission) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

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

  // Suspending or deleting an organization must actually lock it out, not just
  // flip a column: every member's auth sessions are revoked (so /me and token
  // refresh fail everywhere within seconds), their signed-in apps are told to
  // sign out right now, and the org's hosts are kicked off signaling — which
  // also refuses to re-register them while the org stays suspended.
  const lockOutOrganization = async (organizationId: string, action: 'suspended' | 'deleted') => {
    const [members, devices] = await Promise.all([
      prisma.user.findMany({ where: { organizationId }, select: { id: true } }),
      prisma.device.findMany({ where: { organizationId }, select: { accessKey: true } }),
    ]);
    for (const member of members) {
      await revokeAllSessions(member.id).catch(() => { /* best-effort */ });
    }
    if (members.length) {
      await redisPublisher.publish('account:sync', JSON.stringify({
        type: 'account-sync',
        scope: 'account',
        action,
        entityId: organizationId,
        targetUserIds: members.map((m) => m.id),
        message: action === 'deleted'
          ? 'Your organization has been removed from Remote365.'
          : 'Your organization has been suspended. Please contact support.',
        changedAt: new Date().toISOString(),
      })).catch(() => { /* best-effort */ });
    }
    for (const device of devices) {
      const key = String(device.accessKey || '').replace(/\s/g, '').toLowerCase();
      if (!key) continue;
      await redisPublisher.publish('host:command', JSON.stringify({ command: 'platform-disconnect', accessKey: key, reason: `organization-${action}` })).catch(() => { /* best-effort */ });
      await redisPublisher.del(`presence:${key}`).catch(() => { /* best-effort */ });
    }
  };

  // The owner's paid subscription must stop billing when the org is deleted.
  const cancelOwnerBilling = async (organizationId: string, authHeader: string | undefined) => {
    const owner = await prisma.user.findFirst({
      where: { organizationId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (owner) await cancelBillingForUser(owner.id, authHeader, 'organization deleted');
  };

  // 1. Create Organization (platform owner only)
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'organizations:create');
    if (!decoded) return;

    const { name, slug } = request.body as { name: string; slug: string };
    if (!name || !slug) {
      return reply.code(400).send({ error: 'Name and slug are required' });
    }

    try {
      const org = await prisma.organization.create({
        data: { name, slug }
      });

      return reply.code(201).send(org);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ error: 'Organization slug already exists' });
      }
      throw err;
    }
  });

  // 2. List all Organizations (platform owner only)
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'organizations:viewAll');
    if (!decoded) return;

    const [orgs, planCatalog] = await Promise.all([
      prisma.organization.findMany({
        include: {
          // Soft-deleted members must not consume "3/5 users" in the quota —
          // the overview and billing pages already exclude them.
          _count: {
            select: { users: { where: { status: { not: 'DELETED' } } }, devices: true }
          },
          // Pull the owning subscription user (if any) so the list can surface
          // the plan and the owner's name/email.
          users: {
            where: { subscription: { isNot: null } },
            take: 1,
            select: { name: true, email: true, subscription: { select: { plan: true, customPlanKey: true, status: true } } }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      getMergedPlanCatalog()
    ]);

    // Quota denominators (users/devices) come from the merged catalog, so
    // super-admin overrides and custom plans are reflected (null = unlimited).
    const limitByPlan = new Map(planCatalog.map((p) => [p.id.toUpperCase(), p]));

    // Real device count: devices actually owned by each org's members (a member's
    // device may have ownerId set but organizationId null, so counting via the
    // org->devices relation under-counts). Map devices by owner -> org.
    const orgIds = orgs.map((o: any) => o.id);
    const members = await prisma.user.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true, organizationId: true }
    });
    const ownerToOrg = new Map(members.map((m: any) => [m.id, m.organizationId]));
    const memberIds = members.map((m: any) => m.id);
    const devGroups = memberIds.length
      ? await prisma.device.groupBy({ by: ['ownerId'], where: { ownerId: { in: memberIds } }, _count: { _all: true } })
      : [];
    const deviceCountByOrg: Record<string, number> = {};
    devGroups.forEach((g: any) => {
      const orgId = g.ownerId ? ownerToOrg.get(g.ownerId) : null;
      if (orgId) deviceCountByOrg[orgId] = (deviceCountByOrg[orgId] || 0) + (g._count?._all || 0);
    });

    // Flatten the derived plan/status/owner/limits onto each org and drop the helper `users` array.
    const result = orgs.map((org: any) => {
      const ownerUser = org.users?.[0];
      const sub = ownerUser?.subscription;
      // One resolver everywhere (custom plan key wins over the enum, Play
      // expiry honoured) so list, detail and KPIs never disagree on a plan.
      const plan = effectivePlanId(sub);
      const limit = limitByPlan.get(String(plan).toUpperCase());
      const { users, ...rest } = org;
      return {
        ...rest,
        _count: { users: org._count?.users ?? 0, devices: deviceCountByOrg[org.id] || 0 },
        plan,
        planName: limit?.name ?? null,
        subscriptionStatus: sub?.status ?? null,
        owner: ownerUser ? { name: ownerUser.name ?? null, email: ownerUser.email ?? null } : null,
        limits: { users: limit?.maxUsers ?? null, devices: limit?.maxDevices ?? null }
      };
    });

    return reply.send(result);
  });

  // 3. Get single Org detail (platform owner only) — members, devices, plan
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'organizations:viewAll');
    if (!decoded) return;

    const { id } = request.params as { id: string };

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            subscription: { select: { plan: true, customPlanKey: true, status: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        devices: {
          select: {
            id: true,
            name: true,
            deviceType: true,
            status: true,
            ownerId: true,
            lastSeenAt: true,
            accessKey: true,
            tags: true,
            owner: { select: { name: true, email: true } }
          },
          orderBy: { lastSeenAt: 'desc' }
        },
        // Soft-deleted members must not count toward "Total Users".
        _count: { select: { users: { where: { status: { not: 'DELETED' } } }, devices: true } }
      }
    });

    if (!org) return reply.code(404).send({ error: 'Organization not found' });

    const owner = org.users.find((u: any) => u.subscription);
    // Same resolver as the list (custom plan key wins over the enum) — the
    // detail page used to read the enum only and showed "Trial" for custom plans.
    const plan = effectivePlanId((owner as any)?.subscription);
    const planName = (await findMergedPlan(plan))?.name ?? null;

    // Real last-login per member (latest successful login event).
    const memberIds = org.users.map((u: any) => u.id);
    const lastLogins = memberIds.length
      ? await prisma.loginEvent.groupBy({ by: ['userId'], where: { userId: { in: memberIds }, result: 'SUCCESS' }, _max: { createdAt: true } })
      : [];
    const lastByUser = new Map(lastLogins.map((l: any) => [l.userId, l._max?.createdAt ?? null]));
    const users = org.users.map((u: any) => ({ ...u, lastLoginAt: lastByUser.get(u.id) ?? null }));

    // Live device status (Redis presence + active sessions), mirroring admin-devices.
    // Active sessions = live REMOTE_CONTROL RemoteSessions keyed by sessionCode == accessKey.
    const deviceKeys = org.devices.map((d: any) => d.accessKey).filter(Boolean);
    const sess = deviceKeys.length
      ? await (prisma as any).remoteSession.groupBy({
          by: ['sessionCode'],
          where: { sessionCode: { in: deviceKeys }, type: 'REMOTE_CONTROL', status: 'ACTIVE', startedAt: { not: null }, endedAt: null, expiresAt: { gt: new Date() } },
          _count: { _all: true },
        })
      : [];
    const sessByKey = new Map<string, number>(sess.map((s: any) => [s.sessionCode, s._count?._all || 0]));
    // Same live-truth guard as admin-devices: a DB row that stayed ACTIVE
    // after an unclean disconnect must not mark an idle device "In session".
    // Redis `session:active:<accessKey>` (viewer-heartbeat TTL) decides, and
    // stale rows get closed in passing.
    const dbActiveKeys = Array.from(sessByKey.keys()).filter((k) => (sessByKey.get(k) || 0) > 0);
    if (dbActiveKeys.length) {
      let busy: (string | null)[];
      try {
        busy = await redisPublisher.mget(...dbActiveKeys.map((k) => `session:active:${k}`));
      } catch {
        busy = dbActiveKeys.map(() => '1');
      }
      const staleKeys = dbActiveKeys.filter((_, i) => busy[i] == null);
      for (const k of staleKeys) sessByKey.set(k, 0);
      // Closing waits for a second sighting (see closeStaleSessionsByCode) so
      // a Redis flush can't end every live session from one page view.
      closeStaleSessionsByCode(staleKeys, dbActiveKeys.filter((k) => !staleKeys.includes(k)))
        .catch(() => { /* best-effort cleanup */ });
    }
    let onlineKeys: (string | null)[] = [];
    try {
      onlineKeys = org.devices.length
        ? await redisPublisher.mget(...org.devices.map((d: any) => `presence:${String(d.accessKey || '').toLowerCase()}`))
        : [];
    } catch { onlineKeys = []; }
    const deriveStatus = (d: any, sessions: number, online: boolean): string => {
      if (String(d.status || '').toUpperCase() === 'BLOCKED') return 'Disabled';
      if (sessions > 0) return 'In session';
      if (online) return 'Online';
      if (!d.ownerId) return 'Unregistered';
      return 'Offline';
    };
    const devices = org.devices.map((d: any, i: number) => {
      const sessions = sessByKey.get(d.accessKey) || 0;
      return {
        id: d.id,
        name: d.name || 'Unnamed device',
        deviceId: `#${(d.accessKey || '').slice(-6).toUpperCase()}`,
        type: d.deviceType,
        ownerName: d.owner?.name ?? null,
        ownerEmail: d.owner?.email ?? null,
        status: deriveStatus(d, sessions, onlineKeys[i] != null),
        sessions,
        lastSeenAt: d.lastSeenAt,
      };
    });

    return reply.send({ ...org, users, devices, plan, planName });
  });

  // 3.1 Get an organization's activity log (platform owner only)
  fastify.get('/:id/activity', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'organizations:viewAll');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const logs = await prisma.activityLog.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return reply.send(logs);
  });

  // 6. Get my Org info
  fastify.get('/mine', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        organization: {
          include: {
            departments: true,
            _count: { select: { users: true, devices: true } }
          }
        }
      }
    });

    if (!user?.organization) {
      return reply.code(404).send({ error: 'No organization joined yet' });
    }

    return reply.send(user.organization);
  });

  // Security center aggregate for my org: counts only, no member/device details.
  fastify.get('/security-overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const securityActor = await loadActor(decoded.userId);
    if (!userHasPermission(securityActor, 'org:settings')) {
      return reply.code(403).send({ error: 'Organization settings access required' });
    }
    if (!decoded.orgId) return reply.code(404).send({ error: 'No organization joined yet' });

    const [org, membersTotal, membersWith2FA, devicesTotal, devicesProtected] = await Promise.all([
      prisma.organization.findUnique({ where: { id: decoded.orgId }, select: { require2FA: true, defaultMemberRole: true } }),
      prisma.user.count({ where: { organizationId: decoded.orgId } }),
      prisma.user.count({ where: { organizationId: decoded.orgId, is2FAEnabled: true } }),
      prisma.device.count({ where: { organizationId: decoded.orgId } }),
      prisma.device.count({ where: { organizationId: decoded.orgId, passwordRequired: true, accessPasswordHash: { not: null } } })
    ]);

    if (!org) return reply.code(404).send({ error: 'No organization joined yet' });

    return reply.send({
      require2FA: Boolean(org.require2FA),
      defaultMemberRole: org.defaultMemberRole,
      membersTotal,
      membersWith2FA,
      devicesTotal,
      devicesProtected
    });
  });

  // Broadcast a features change so affected members refresh /me live.
  const publishFeaturesSync = async (organizationId: string) => {
    try {
      const members = await prisma.user.findMany({
        where: { organizationId },
        select: { id: true }
      });
      await redisPublisher.publish('account:sync', JSON.stringify({
        type: 'account-sync',
        scope: 'features',
        action: 'updated',
        entityId: organizationId,
        targetUserIds: members.map((m) => m.id),
        changedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.error('[Organizations] Failed to publish features sync:', err);
    }
  };

  // GET /organizations/role-features — full editable matrix for the owner UI
  // (defaults merged with the org's stored overrides).
  fastify.get('/role-features', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });
    // Readable by anyone who can edit org settings OR member permissions: the
    // per-member permission editor needs this matrix as its feature baseline.
    const readActor = await loadActor(decoded.userId);
    if (!userHasPermission(readActor, 'org:settings') && !userHasPermission(readActor, 'members:edit')) {
      return reply.code(403).send({ error: 'Organization settings access required' });
    }
    if (!decoded.orgId) return reply.code(404).send({ error: 'No organization joined yet' });

    const org = await prisma.organization.findUnique({
      where: { id: decoded.orgId },
      select: { roleFeatures: true }
    });
    return reply.send({ roleFeatures: resolveRoleFeatureMatrix((org as any)?.roleFeatures || {}) });
  });

  // PATCH /organizations/role-features — owner sets what ADMIN/VIEWER can see.
  fastify.patch('/role-features', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });
    // Only the organization owner may reshape what other roles can see.
    if (decoded.role !== 'OWNER' || !hasPermission(decoded.role, 'org:settings')) {
      return reply.code(403).send({ error: 'Only the organization owner can change role permissions' });
    }
    if (!decoded.orgId) return reply.code(400).send({ error: 'Organization is required' });

    const body = (request.body || {}) as any;
    const incoming = body.roleFeatures || body;

    // Sanitize: only known roles and known boolean feature keys survive.
    const clean: Record<string, Record<string, boolean>> = {};
    for (const role of CONFIGURABLE_ROLES) {
      const src = incoming?.[role];
      if (src && typeof src === 'object') {
        const roleClean: Record<string, boolean> = {};
        for (const key of ROLE_FEATURE_KEYS) {
          if (typeof src[key] === 'boolean') roleClean[key] = src[key];
        }
        if (Object.keys(roleClean).length) clean[role] = roleClean;
      }
    }

    await prisma.organization.update({
      where: { id: decoded.orgId },
      data: { roleFeatures: clean as any }
    });

    await publishFeaturesSync(decoded.orgId);

    return reply.send({ roleFeatures: resolveRoleFeatureMatrix(clean) });
  });

  // 7. Update my Org settings (organization owner or platform owner)
  fastify.patch('/mine', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
    const settingsActor = await loadActor(decoded.userId);
    if (!userHasPermission(settingsActor, 'org:settings')) {
      return reply.code(403).send({ error: 'Organization settings access required' });
    }
    if (!decoded.orgId) return reply.code(400).send({ error: 'Organization is required' });

    const { name, defaultMemberRole, require2FA } = request.body as any;
    const updateData: any = {};
    if (typeof name === 'string') {
      const cleanName = name.trim();
      if (!cleanName) return reply.code(400).send({ error: 'Company name is required' });
      if (cleanName.length > 80) return reply.code(400).send({ error: 'Company name must be 80 characters or fewer' });
      updateData.name = cleanName;
    }
    if (defaultMemberRole) updateData.defaultMemberRole = defaultMemberRole;
    if (require2FA !== undefined) updateData.require2FA = require2FA;

    const org = await prisma.organization.update({
      where: { id: decoded.orgId },
      data: updateData
    });

    return reply.send(org);
  });

  // 4. Delete Organization (platform owner only)
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'organizations:delete');
    if (!decoded) return;

    const { id } = request.params as { id: string };

    try {
      // Soft delete: mark the organization DELETED (keeps the record so it stays
      // visible with a Deleted status and can be restored by activating it).
      // A DELETED org locks out its members the same way SUSPENDED does.
      const org = await prisma.organization.update({
        where: { id },
        data: { status: 'DELETED' } as any,
      });
      await lockOutOrganization(id, 'deleted');
      await cancelOwnerBilling(id, request.headers.authorization);
      const actor = await actorFromDecoded(decoded);
      await recordActivity(id, 'ORG_DELETED', `Organization deleted by ${actor.name}`, actor);
      return reply.send({ success: true, organization: org });
    } catch (err: any) {
      const server = (fastify as any).log || console;
      server.error(`[Auth-Service] Failed to delete organization ${id}:`, err);
      return reply.code(500).send({ error: 'Failed to delete organization' });
    }
  });

  // 5. Update Organization name/slug (platform owner only)
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlatformPermission(request, reply, 'organizations:update');
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const { name, slug, status } = request.body as any;

    if (status !== undefined && !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return reply.code(400).send({ error: 'Status must be ACTIVE or SUSPENDED' });
    }

    try {
      const org = await prisma.organization.update({
        where: { id },
        data: { ...(name && { name }), ...(slug && { slug }), ...(status && { status }) }
      });
      if (status) {
        if (status === 'SUSPENDED') await lockOutOrganization(id, 'suspended');
        const actor = await actorFromDecoded(decoded);
        await recordActivity(
          id,
          status === 'SUSPENDED' ? 'ORG_SUSPENDED' : 'ORG_ACTIVATED',
          `Organization ${status === 'SUSPENDED' ? 'suspended' : 'activated'} by ${actor.name}`,
          actor,
        );
      }
      return reply.send(org);
    } catch (err: any) {
      if (err.code === 'P2002') return reply.code(400).send({ error: 'Slug already taken' });
      return reply.code(500).send({ error: 'Failed to update organization' });
    }
  });

}
