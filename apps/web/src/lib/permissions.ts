/**
 * Effective-permission helpers for the desktop shell.
 *
 * /auth/me returns the user's resolved `permissions` (RBAC actions) and
 * `features` (sidebar/nav visibility) — role default → org role features →
 * per-user overrides, resolved server-side by @remotelink/shared. Every UI
 * gate should read these instead of the raw role so owner grants/revokes
 * actually change what members see and can do.
 *
 * OWNER / SUPER_ADMIN always pass: overrides can never lock an owner out.
 *
 * Fallbacks (user object from an older cache, before /auth/me responds):
 * mirror the shared role defaults so nothing flickers or over-hides. Keep in
 * sync with packages/shared/src/rbac.ts and role-features.ts (the renderer
 * can't import that package).
 */

const FULL_ACCESS_ROLES = ['OWNER', 'SUPER_ADMIN'];

// Role-default RBAC permissions for the capabilities the UI gates on
// (allocatable subset of ADMIN_PERMISSIONS / VIEWER_PERMISSIONS in rbac.ts).
const ROLE_FALLBACK_PERMISSIONS: Record<string, readonly string[]> = {
  ADMIN: [
    'devices:register', 'devices:configure', 'devices:remove', 'devices:assign',
    'devices:groups:create', 'devices:groups:delete',
    'members:view', 'members:invite', 'members:edit', 'members:remove', 'members:assignRole',
    'sessions:start', 'sessions:join', 'sessions:viewHistoryAll', 'sessions:recordings:view',
    'billing:view', 'org:settings',
  ],
  VIEWER: ['devices:view', 'devices:reportIssue', 'billing:view'],
};

// Role-default feature visibility (mirror of ROLE_FEATURE_DEFAULTS).
const ROLE_FALLBACK_FEATURES: Record<string, Record<string, boolean>> = {
  ADMIN: { licenses: true, chat: true, remoteSupport: true, feedback: true, help: true, adminSettings: false },
  VIEWER: { licenses: true, chat: true, remoteSupport: false, feedback: true, help: true, adminSettings: false },
};

const roleOf = (user: any) => String(user?.role || '').toUpperCase();

/** Does this user hold an RBAC action permission (effective, per-user)? */
export function hasUserPermission(user: any, permission: string): boolean {
  const role = roleOf(user);
  if (FULL_ACCESS_ROLES.includes(role)) return true;
  if (Array.isArray(user?.permissions)) return user.permissions.includes(permission);
  return (ROLE_FALLBACK_PERMISSIONS[role] || []).includes(permission);
}

/** Is a nav/feature surface visible for this user (effective, per-user)? */
export function hasUserFeature(user: any, feature: string): boolean {
  const role = roleOf(user);
  if (FULL_ACCESS_ROLES.includes(role)) return true;
  const value = user?.features?.[feature];
  if (typeof value === 'boolean') return value;
  const fallback = ROLE_FALLBACK_FEATURES[role]?.[feature];
  // Unknown role/feature: default visible so a stale cache never hides the app.
  return fallback !== false;
}
