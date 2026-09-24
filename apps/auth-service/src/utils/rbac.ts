import { prisma, rankOf, userHasPermission } from '@remotelink/shared';

export const normalizeOrgRole = (role?: string | null) => {
  return String(role || '').toUpperCase();
};

export const roleRank = (role?: string | null) => rankOf(role);

// A user record (or {role, permissionOverrides}) whose effective permissions
// include the per-user overrides. Gates must take the user, not just the role,
// so owner-granted/revoked capabilities are honoured.
type Actor = { role?: string | null; permissionOverrides?: any } | null | undefined;

// Which org roles an actor may touch (assign to a member, remove, edit).
// Owners manage Admins and Viewers; everyone else — including a Viewer the
// owner granted members:* permissions to — can only touch Viewers. The
// members:* permission itself is checked separately by the caller; this is
// the ceiling that keeps non-owners from managing peers or higher roles.
export function canManageOrgRole(actorRole?: string | null, targetRole?: string | null) {
  const actor = normalizeOrgRole(actorRole);
  const target = normalizeOrgRole(targetRole);
  if (target === 'SUPER_ADMIN' || target === 'OWNER') return false;
  if (actor === 'SUPER_ADMIN' || actor === 'OWNER') return target === 'ADMIN' || target === 'VIEWER';
  // ADMIN, or a VIEWER the owner granted members:* to, may only touch Viewers.
  return target === 'VIEWER';
}

export function canInviteOrgRole(actorRole?: string | null, targetRole?: string | null) {
  return canManageOrgRole(actorRole, targetRole);
}

export function canStartMeeting(actor: Actor) {
  return userHasPermission(actor, 'sessions:start');
}

// Per-user: honours owner grants (Viewer given sessions:start) and revokes
// (Admin stripped of sessions:start) instead of the raw role default.
export function canRequestControl(actor: Actor) {
  return userHasPermission(actor, 'sessions:start');
}

export function canViewOnly(role?: string | null) {
  return normalizeOrgRole(role) === 'VIEWER';
}

export async function canAccessDevice(user: any, device: any, requireControl = true) {
  if (!user || !device) return false;
  if (device.ownerId === user.id) return true;
  if (user.organizationId && device.organizationId && user.organizationId !== device.organizationId) return false;
  if (user.organizationId && user.organizationId === device.organizationId) return true;
  if (Array.isArray(user.allowedDeviceIds) && user.allowedDeviceIds.includes('__all__') && user.organizationId === device.organizationId) return true;
  if (Array.isArray(user.allowedDeviceIds) && user.allowedDeviceIds.includes(device.id)) return true;
  const assignedGroups = await prisma.deviceGroup.count({
    where: {
      id: { in: (user.allowedGroups || []).map((group: any) => group.id) },
      devices: { some: { id: device.id } }
    }
  });
  return assignedGroups > 0;
}

export async function writeAuditLog(actorId: string | null | undefined, action: string, entityType: string, entityId: string, metadata: any = {}) {
  try {
    if (!(prisma as any).auditLog) return;
    await (prisma as any).auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  } catch (err) {
    console.warn('[RBAC] Failed to write audit log:', err);
  }
}
