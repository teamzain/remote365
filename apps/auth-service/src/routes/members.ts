import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  PLAN_ROLE_OPTIONS, normalizePlanId, prisma, verifyToken, recordActivity, redisPublisher,
  userHasPermission, sanitizeOverridesAgainstActor, findMergedPlan,
  PERMISSION_CATALOG, ALLOCATABLE_PERMISSIONS, ROLE_PERMISSIONS, ROLE_FEATURE_DEFAULTS,
} from '@remotelink/shared';
import { canInviteOrgRole, canManageOrgRole } from '../utils/rbac';
import { authSessionIndexKey, authSessionKey, revokeAllSessions } from '../utils/authSessions';
import crypto from 'crypto';
import { sendTemplatedEmail, smtpConfigured } from '../utils/emailTemplates';

export default async function memberRoutes(fastify: FastifyInstance) {
  const PLAN_MEMBER_LIMITS: Record<string, number> = {
    TRIAL: 1,
    SOLO: 2,
    PRO: 5,
    BUSINESS: 25,
    ENTERPRISE: Number.POSITIVE_INFINITY
  };

  const normalizeIds = (ids: unknown): string[] => {
    if (!Array.isArray(ids)) return [];
    return Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
  };

  const validateOrgDeviceIds = async (orgId: string, deviceIds: string[]) => {
    if (deviceIds.length === 0) return;
    const count = await prisma.device.count({ where: { id: { in: deviceIds }, organizationId: orgId } });
    if (count !== deviceIds.length) throw new Error('One or more devices do not belong to this organization');
  };

  const validateOrgGroupIds = async (orgId: string, groupIds: string[]) => {
    if (groupIds.length === 0) return;
    const count = await prisma.deviceGroup.count({ where: { id: { in: groupIds }, orgId } });
    if (count !== groupIds.length) throw new Error('One or more groups do not belong to this organization');
  };

  const resolveAccess = async (orgId: string, body: any) => {
    const accessType = body?.accessType || 'none';
    const deviceIds = normalizeIds(body?.deviceIds);
    const groupIds = normalizeIds(body?.groupIds);

    if (accessType === 'full') {
      return { allowedDeviceIds: ['__all__'], allowedGroupIds: [] };
    }

    if (accessType === 'groups') {
      await validateOrgGroupIds(orgId, groupIds);
      return { allowedDeviceIds: [], allowedGroupIds: groupIds };
    }

    if (accessType === 'specific') {
      await validateOrgDeviceIds(orgId, deviceIds);
      return { allowedDeviceIds: deviceIds, allowedGroupIds: [] };
    }

    if (accessType === 'none') {
      return { allowedDeviceIds: [], allowedGroupIds: [] };
    }

    throw new Error('Invalid accessType');
  };

  // The merged catalog is authoritative: built-in plans honor any super-admin
  // override, and custom plans read maxUsers from their PlanDef row
  // (null = unlimited). The hardcoded map is only a catalog-unreachable fallback.
  const getPlanLimit = async (plan?: string | null): Promise<number> => {
    const key = String(plan || 'TRIAL').toUpperCase();
    try {
      const def = await findMergedPlan(key);
      if (def) return def.maxUsers ?? Number.POSITIVE_INFINITY;
    } catch { /* catalog unavailable — fall through */ }
    return PLAN_MEMBER_LIMITS[key] ?? PLAN_MEMBER_LIMITS.TRIAL;
  };

  const getOrgPlan = async (decoded: any) => {
    const actor = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, organizationId: true }
    });

    if (actor?.role === 'OWNER') {
      const sub = await prisma.subscription.findUnique({ where: { userId: decoded.userId } });
      if (sub) return (sub as any).customPlanKey || sub.plan;
    }

    const orgId = decoded.orgId || actor?.organizationId;
    if (!orgId) return 'TRIAL';
    const orgOwner = await prisma.user.findFirst({
      where: {
        organizationId: orgId,
        role: 'OWNER'
      },
      include: { subscription: true },
      orderBy: { createdAt: 'asc' }
    });
    const ownerSub: any = orgOwner?.subscription;
    return ownerSub?.customPlanKey || ownerSub?.plan || 'TRIAL';
  };

  const enforceMemberLimit = async (decoded: any) => {
    if (!decoded.orgId) return;
    const plan = await getOrgPlan(decoded);
    const limit = await getPlanLimit(plan);
    if (!Number.isFinite(limit)) return;

    const [memberCount, inviteCount] = await Promise.all([
      prisma.user.count({ where: { organizationId: decoded.orgId } }),
      prisma.invitation.count({ where: { organizationId: decoded.orgId, expiresAt: { gt: new Date() } } })
    ]);

    if (memberCount + inviteCount >= limit) {
      throw new Error(`Your ${plan} plan allows ${limit} team member${limit === 1 ? '' : 's'}. Upgrade to invite more people.`);
    }
  };

  const enforcePlanRole = async (decoded: any, role: string) => {
    const plan = normalizePlanId(await getOrgPlan(decoded));
    const allowedRoles = PLAN_ROLE_OPTIONS[plan] || PLAN_ROLE_OPTIONS.TRIAL;
    if (!allowedRoles.includes(role)) {
      throw new Error(`The ${plan} plan does not include the ${role} role.`);
    }
  };

  // Helper to verify organization management access.
  const requireOrgAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({ error: 'Unauthorized' });
      return null;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      reply.code(401).send({ error: 'Invalid token' });
      return null;
    }

    // The JWT's orgId can be stale/missing (e.g. the token predates the user
    // joining an org). Every org-scoped query below keys off decoded.orgId, so
    // backfill it from the authoritative DB record — otherwise a member with a
    // stale token sees an empty org (0 members) even though they belong to one.
    if (!decoded.orgId && decoded.userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { organizationId: true },
      });
      if (dbUser?.organizationId) decoded.orgId = dbUser.organizationId;
    }

    return decoded;
  };

  // Load the acting user's role + per-user overrides so action gates honour
  // per-user grants/revokes, not just the role default.
  const loadActor = async (decoded: any) => {
    if (!decoded?.userId) return null;
    return prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, permissionOverrides: true, organizationId: true },
    });
  };

  // Push a live "features" account-sync so the affected members' sidebars and
  // action gates re-render without an app reload (App.tsx handles this scope by
  // re-pulling /auth/me). Mirrors the org role-features handler.
  const publishFeaturesSync = async (orgId: string | null | undefined, userIds: string[]) => {
    if (!orgId || userIds.length === 0) return;
    try {
      await redisPublisher.publish('account:sync', JSON.stringify({
        type: 'account-sync',
        scope: 'features',
        action: 'updated',
        entityId: orgId,
        targetUserIds: userIds,
      }));
      // Device-access grants changed what /devices/mine returns for these
      // members — refresh their device lists live too, not just the gates.
      await redisPublisher.publish('account:sync', JSON.stringify({
        type: 'account-sync',
        scope: 'devices',
        action: 'access-updated',
        entityId: orgId,
        targetUserIds: userIds,
      }));
    } catch { /* non-fatal */ }
  };

  // Instantly sign a member out everywhere: revoke every auth session (the
  // next /me or token refresh 401s on any client) and push an account-scope
  // sync so an open desktop app logs out on the spot instead of waiting for
  // its next periodic check.
  const forceLogoutEverywhere = async (userId: string, action: 'deactivated' | 'deleted', message: string) => {
    try { await revokeAllSessions(userId); } catch { /* redis down — login/me checks still block */ }
    try {
      await redisPublisher.publish('account:sync', JSON.stringify({
        type: 'account-sync',
        scope: 'account',
        action,
        message,
        targetUserIds: [userId],
      }));
    } catch { /* non-fatal */ }
  };

  // 0. Permission catalog + role defaults, served from the shared package so
  // the desktop's permission editor can't drift from what the backend enforces.
  fastify.get('/permission-catalog', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;

    const allocatable = new Set<string>(ALLOCATABLE_PERMISSIONS);
    const roleDefaults: Record<string, { features: Record<string, boolean>; permissions: string[] }> = {};
    for (const role of ['ADMIN', 'VIEWER'] as const) {
      roleDefaults[role] = {
        features: { ...ROLE_FEATURE_DEFAULTS[role] },
        permissions: Array.from(ROLE_PERMISSIONS[role]).filter((perm) => allocatable.has(perm)),
      };
    }

    return reply.send({ catalog: PERMISSION_CATALOG, roleDefaults });
  });

  // 1. Invite a Member
  fastify.post('/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;
    const inviteActor = await loadActor(decoded);
    if (!inviteActor) return reply.code(401).send({ error: 'Unauthorized' });
    // Inviting only needs members:invite — the role ceiling below already
    // bounds who a non-owner can invite (Viewers only), so requiring
    // members:assignRole here would make an "Invite members" grant useless.
    if (!userHasPermission(inviteActor, 'members:invite')) {
      return reply.code(403).send({ error: 'Member invite access required' });
    }

    const { email, role: requestedRole, departmentId, allowedTags } = request.body as any;
    if (!email) return reply.code(400).send({ error: 'Email is required' });
    // Fall back to the org's default member role (Policies) when none is given.
    let role = String(requestedRole || '').toUpperCase();
    if (!role && decoded.orgId) {
      const org = await prisma.organization.findUnique({ where: { id: decoded.orgId }, select: { defaultMemberRole: true } });
      role = String(org?.defaultMemberRole || 'VIEWER').toUpperCase();
    }
    if (!role) return reply.code(400).send({ error: 'Email and Role are required' });

    // Ensure the actor can invite this organization role.
    if (!canInviteOrgRole(decoded.role, role)) {
      return reply.code(403).send({ error: 'You do not have permission to invite this role' });
    }

    const orgId = decoded.orgId; // Taken from JWT
    if (!orgId) return reply.code(400).send({ error: 'Admin must belong to an organization to invite members' });

    // Check if the user is already registered (which means they are in an organization)
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: 'This user is already registered and belongs to an organization' });
    }

    // Check if there is already an active invitation for this email
    const existingInvite = await prisma.invitation.findFirst({
      where: { email, expiresAt: { gt: new Date() } }
    });
    if (existingInvite) {
      return reply.code(400).send({ error: 'An active invitation already exists for this email address' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      await enforceMemberLimit(decoded);
      await enforcePlanRole(decoded, role);
      const { allowedDeviceIds, allowedGroupIds } = await resolveAccess(orgId, request.body);
      const invitation = await prisma.invitation.create({
        data: {
          email,
          token,
          role: role as any,
          organizationId: orgId,
          departmentId,
          allowedTags: allowedTags || [],
          allowedDeviceIds,
          allowedGroupIds,
          expiresAt
        }
      });

      // Log the invite so adding a member shows in the org activity immediately.
      try {
        const inviter = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, name: true, email: true } });
        const inviterName = inviter?.name || inviter?.email || 'An admin';
        await recordActivity(orgId, 'MEMBER_INVITED', `${email} was invited as ${role} by ${inviterName}`, { id: inviter?.id, name: inviterName });
      } catch { /* non-fatal */ }

      // Send Invitation Email
      if (smtpConfigured()) {
        const serverHost = process.env.SERVER_IP
          ? `http://${process.env.SERVER_IP}`
          : 'http://localhost';
        // HTTP link for the web page that then launches the desktop app.
        // Plain-text URL is included as a fallback because Gmail auto-detects
        // and makes plain HTTP URLs clickable even if it strips the button href.
        const inviteLink = `${serverHost}/onboard?token=${token}`;

        await sendTemplatedEmail({
          to: email,
          key: 'org-invitation',
          vars: { role, inviteLink, email },
          fromName: 'Remote 365 Team',
        });
      }

      console.log(`[Auth] Invitation sent to ${email} with token: ${token}`);
      return reply.send({ success: true, invitationId: invitation.id });
    } catch (err: any) {
      console.error('[Auth] Failed to create invitation:', err);
      if (String(err.message || '').includes('plan allows')) {
        return reply.code(403).send({ error: err.message, planRestricted: true });
      }
      if (String(err.message || '').includes('plan does not include')) {
        return reply.code(403).send({ error: err.message, planRestricted: true });
      }
      return reply.code(500).send({ error: 'Failed to send invitation' });
    }
  });

  // 2. List all Members
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;
    const viewActor = await loadActor(decoded);
    if (!viewActor) return reply.code(401).send({ error: 'Unauthorized' });
    if (!userHasPermission(viewActor, 'members:view')) {
      return reply.code(403).send({ error: 'Member view access required' });
    }

    if (!decoded.orgId) {
      return reply.send({ members: [], pendingInvites: [] });
    }

    const members = await prisma.user.findMany({
      where: { organizationId: decoded.orgId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        allowedTags: true,
        allowedDeviceIds: true,
        allowedGroups: { select: { id: true, name: true, color: true } },
        department: { select: { name: true } },
        permissionOverrides: true,
        createdAt: true
      }
    });

    const pendingInvites = await prisma.invitation.findMany({
      where: { organizationId: decoded.orgId, expiresAt: { gt: new Date() } }
    });

    // Owners always have full device access; backfill display for accounts created before the default.
    const normalizedMembers = members.map((member) => (
      member.role === 'OWNER' && !member.allowedDeviceIds?.includes('__all__')
        ? { ...member, allowedDeviceIds: ['__all__'] }
        : member
    ));

    // Live signed-in state: a member counts as signed in while they hold at
    // least one unexpired auth session in Redis. Powers the "Signed-in
    // members" popup on the License usage → Concurrent Sessions card. Note
    // this is a per-member on/off flag; the numeric cap is per-user (each
    // account can be signed in at up to maxConcurrentSessions places).
    const membersWithPresence = await Promise.all(normalizedMembers.map(async (member) => {
      let signedIn = false;
      try {
        const sids: string[] = await redisPublisher.smembers(authSessionIndexKey(member.id));
        for (const sid of sids) {
          if (await redisPublisher.exists(authSessionKey(member.id, sid))) { signedIn = true; break; }
        }
      } catch { /* redis unavailable — show signed-out rather than fail the page */ }
      return { ...member, signedIn };
    }));
    const activeLoginCount = membersWithPresence.filter((member) => member.signedIn).length;

    return reply.send({ members: membersWithPresence, pendingInvites, activeLoginCount });
  });

  // 3. Permanently delete a Member: the account and everything attached to it
  // (auth sessions, chats, subscription, saved/trusted devices) is erased from
  // the database. The member is signed out everywhere instantly; if they sign
  // up again they start as a brand-new account. Devices they registered stay
  // with the organization, just with the owner link detached.
  fastify.delete('/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;
    const removeActor = await loadActor(decoded);
    if (!removeActor) return reply.code(401).send({ error: 'Unauthorized' });
    if (!userHasPermission(removeActor, 'members:remove')) {
      return reply.code(403).send({ error: 'Member removal access required' });
    }

    const { userId } = request.params as { userId: string };

    // Block self-deletion
    if (userId === decoded.userId) return reply.code(400).send({ error: 'Cannot remove yourself' });

    const target = await prisma.user.findFirst({
      where: { id: userId, organizationId: decoded.orgId },
      select: { role: true, name: true, email: true }
    });
    if (!target) return reply.code(404).send({ error: 'Member not found' });
    if (!canManageOrgRole(decoded.role, target.role)) {
      return reply.code(403).send({ error: 'You do not have permission to remove this member' });
    }

    // Kick them out before the row disappears so an in-flight token refresh
    // can't slip through while the delete runs.
    await forceLogoutEverywhere(userId, 'deleted', 'Your account has been removed by your organization.');

    try {
      // Their direct (1:1) chats vanish with them; deleting the conversation
      // cascades both sides' messages and participant rows. Group chats stay,
      // minus their membership and messages.
      const directConvos = await prisma.conversationParticipant.findMany({
        where: { userId, conversation: { isGroup: false } },
        select: { conversationId: true }
      });

      await prisma.$transaction([
        prisma.conversation.deleteMany({ where: { id: { in: directConvos.map((c) => c.conversationId) } } }),
        prisma.message.deleteMany({ where: { senderId: userId } }),
        prisma.conversationParticipant.deleteMany({ where: { userId } }),
        prisma.session.deleteMany({ where: { viewerId: userId } }),
        prisma.trustedDevice.deleteMany({ where: { viewerUserId: userId } }),
        prisma.savedDevice.deleteMany({ where: { userId } }),
        prisma.subscription.deleteMany({ where: { userId } }),
        prisma.supportTicket.deleteMany({ where: { userId } }),
        prisma.guideRequest.deleteMany({ where: { userId } }),
        prisma.remoteSessionCollaborator.updateMany({ where: { userId }, data: { userId: null } }),
        prisma.device.updateMany({ where: { ownerId: userId }, data: { ownerId: null } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);
    } catch (err: any) {
      console.error('[Auth] Failed to permanently delete member:', err);
      return reply.code(500).send({ error: 'Failed to delete member' });
    }

    try {
      const actor = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, name: true, email: true } });
      const actorName = actor?.name || actor?.email || 'An admin';
      await recordActivity(decoded.orgId, 'MEMBER_DELETED', `${target.name || target.email} was permanently deleted by ${actorName}`, { id: actor?.id, name: actorName });
    } catch { /* non-fatal */ }

    return reply.send({ success: true });
  });

  // 3b. Activate / deactivate a Member. Inactive is a temporary, reversible
  // lock: the member is signed out everywhere instantly and any login attempt
  // is rejected with a "temporarily restricted" message until an admin flips
  // them back to active — their account and data stay untouched.
  fastify.patch('/:userId/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;
    const statusActor = await loadActor(decoded);
    if (!statusActor) return reply.code(401).send({ error: 'Unauthorized' });
    if (!userHasPermission(statusActor, 'members:edit')) {
      return reply.code(403).send({ error: 'Member edit access required' });
    }

    const { userId } = request.params as { userId: string };
    if (userId === decoded.userId) return reply.code(400).send({ error: 'Cannot change your own status' });
    if (!decoded.orgId) return reply.code(400).send({ error: 'Admin must belong to an organization' });

    const active = Boolean((request.body as any)?.active);

    const target = await prisma.user.findFirst({
      where: { id: userId, organizationId: decoded.orgId },
      select: { role: true, status: true, name: true, email: true }
    });
    if (!target) return reply.code(404).send({ error: 'Member not found' });
    if (!canManageOrgRole(decoded.role, target.role)) {
      return reply.code(403).send({ error: 'You do not have permission to change this member' });
    }
    // The org toggle must not overwrite (or lift) a platform-level suspension.
    if (['SUSPENDED', 'DELETED'].includes(String(target.status || '').toUpperCase())) {
      return reply.code(400).send({ error: 'This account is suspended at the platform level' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: active ? 'ACTIVE' : 'INACTIVE' }
    });

    if (!active) {
      await forceLogoutEverywhere(userId, 'deactivated', 'Your account has been temporarily restricted by your organization. Please contact your administrator.');
    }

    try {
      const actor = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, name: true, email: true } });
      const actorName = actor?.name || actor?.email || 'An admin';
      await recordActivity(
        decoded.orgId,
        active ? 'MEMBER_ACTIVATED' : 'MEMBER_DEACTIVATED',
        `${target.name || target.email} was ${active ? 'activated' : 'deactivated'} by ${actorName}`,
        { id: actor?.id, name: actorName }
      );
    } catch { /* non-fatal */ }

    return reply.send({ success: true, status: active ? 'ACTIVE' : 'INACTIVE' });
  });

  // 4. Update Member Device Access
  fastify.patch('/:userId/access', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;
    const editActor = await loadActor(decoded);
    if (!editActor) return reply.code(401).send({ error: 'Unauthorized' });
    if (!userHasPermission(editActor, 'members:edit')) {
      return reply.code(403).send({ error: 'Member edit access required' });
    }

    const { userId } = request.params as { userId: string };
    if (!decoded.orgId) return reply.code(400).send({ error: 'Admin must belong to an organization' });

    const requestedRole = (request.body as { role?: string }).role;
    const role = requestedRole ? String(requestedRole).toUpperCase() : undefined;
    if (role && !userHasPermission(editActor, 'members:assignRole')) {
      return reply.code(403).send({ error: 'Role assignment access required' });
    }
    if (role && !canInviteOrgRole(decoded.role, role)) {
      return reply.code(403).send({ error: 'You do not have permission to assign this role' });
    }

    try {
      const target = await prisma.user.findFirst({
        where: { id: userId, organizationId: decoded.orgId },
        select: { role: true }
      });
      if (!target) return reply.code(404).send({ error: 'Member not found' });
      if (!canManageOrgRole(decoded.role, target.role)) {
        return reply.code(403).send({ error: 'You do not have permission to edit this member' });
      }
      if (role) await enforcePlanRole(decoded, role);

      const { allowedDeviceIds, allowedGroupIds } = await resolveAccess(decoded.orgId, request.body);
      await prisma.user.update({
        where: { id: userId, organizationId: decoded.orgId },
        data: {
          ...(role ? { role: role as any } : {}),
          allowedDeviceIds,
          allowedGroups: { set: allowedGroupIds.map((id) => ({ id })) }
        }
      });
      // Any access change (role, device ACL, groups) alters what the member
      // sees/can do — re-gate their app live, not only on role changes.
      await publishFeaturesSync(decoded.orgId, [userId]);
    } catch (err: any) {
      if (String(err.message || '').includes('plan does not include')) {
        return reply.code(403).send({ error: err.message, planRestricted: true });
      }
      return reply.code(400).send({ error: err.message || 'Failed to update member access' });
    }

    return reply.send({ success: true });
  });

  // 4b. Update per-user permission overrides (grant/revoke capabilities & nav
  // visibility beyond the role defaults). The actor can only grant what they
  // themselves hold; owners/super-admins can never be edited here.
  fastify.patch('/:userId/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;
    const permActor = await loadActor(decoded);
    if (!permActor) return reply.code(401).send({ error: 'Unauthorized' });
    if (!userHasPermission(permActor, 'members:edit')) {
      return reply.code(403).send({ error: 'Member edit access required' });
    }
    if (!decoded.orgId) return reply.code(400).send({ error: 'Admin must belong to an organization' });

    const { userId } = request.params as { userId: string };
    if (userId === decoded.userId) return reply.code(400).send({ error: 'Cannot change your own permissions' });

    const body = request.body as { role?: string; overrides?: any };
    const requestedRole = body.role ? String(body.role).toUpperCase() : undefined;
    if (requestedRole && !userHasPermission(permActor, 'members:assignRole')) {
      return reply.code(403).send({ error: 'Role assignment access required' });
    }
    if (requestedRole && !canInviteOrgRole(decoded.role, requestedRole)) {
      return reply.code(403).send({ error: 'You do not have permission to assign this role' });
    }

    try {
      const target = await prisma.user.findFirst({
        where: { id: userId, organizationId: decoded.orgId },
        select: { role: true }
      });
      if (!target) return reply.code(404).send({ error: 'Member not found' });
      // Owners/super-admins (and any peer the actor can't manage) are off-limits.
      if (!canManageOrgRole(decoded.role, target.role)) {
        return reply.code(403).send({ error: 'You do not have permission to edit this member' });
      }
      if (requestedRole) await enforcePlanRole(decoded, requestedRole);

      // Bound the desired overrides to what the actor is allowed to allocate.
      const cleanOverrides = sanitizeOverridesAgainstActor(permActor, body.overrides);

      await prisma.user.update({
        where: { id: userId, organizationId: decoded.orgId },
        data: {
          ...(requestedRole ? { role: requestedRole as any } : {}),
          permissionOverrides: cleanOverrides as any,
        }
      });

      await publishFeaturesSync(decoded.orgId, [userId]);
      return reply.send({ success: true, overrides: cleanOverrides });
    } catch (err: any) {
      if (String(err.message || '').includes('plan does not include')) {
        return reply.code(403).send({ error: err.message, planRestricted: true });
      }
      return reply.code(400).send({ error: err.message || 'Failed to update member permissions' });
    }
  });

  // 5. Cancel/Delete Invitation
  fastify.delete('/invitation/:invitationId', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;
    const cancelActor = await loadActor(decoded);
    if (!cancelActor) return reply.code(401).send({ error: 'Unauthorized' });
    if (!userHasPermission(cancelActor, 'members:invite')) {
      return reply.code(403).send({ error: 'Invitation management access required' });
    }

    const { invitationId } = request.params as { invitationId: string };

    await prisma.invitation.deleteMany({
      where: { id: invitationId, organizationId: decoded.orgId }
    });

    return reply.send({ success: true });
  });
}
