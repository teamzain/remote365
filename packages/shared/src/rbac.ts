export const ROLES = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'VIEWER'] as const;

export type Role = (typeof ROLES)[number];

export type Permission =
  | 'org:settings'
  | 'org:delete'
  | 'billing:view'
  | 'billing:manage'
  | 'billing:viewRevenue'
  | 'billing:viewInvoices'
  | 'billing:viewFailedPayments'
  | 'billing:viewTrialConversions'
  | 'platform:manage'
  | 'plan:manage'
  | 'audit:viewPlatform'
  | 'organizations:viewAll'
  | 'organizations:create'
  | 'organizations:update'
  | 'organizations:suspend'
  | 'organizations:delete'
  | 'organizations:viewActivity'
  | 'users:viewAll'
  | 'users:search'
  | 'users:activate'
  | 'users:deactivate'
  | 'users:resetAccess'
  | 'users:viewLoginHistory'
  | 'users:forceLogout'
  | 'members:view'
  | 'members:invite'
  | 'members:edit'
  | 'members:remove'
  | 'members:assignRole'
  | 'devices:view'
  | 'devices:viewAll'
  | 'devices:register'
  | 'devices:remove'
  | 'devices:assign'
  | 'devices:configure'
  | 'devices:block'
  | 'devices:viewActivity'
  | 'devices:viewOwnership'
  | 'devices:reportIssue'
  | 'devices:groups:create'
  | 'devices:groups:delete'
  | 'support:viewAll'
  | 'support:viewAssigned'
  | 'support:create'
  | 'support:assign'
  | 'support:updateStatus'
  | 'support:close'
  | 'support:escalate'
  | 'support:viewPerformance'
  | 'support:viewHistory'
  | 'sessions:start'
  | 'sessions:join'
  | 'sessions:monitorAll'
  | 'sessions:terminateAny'
  | 'sessions:viewHistoryAll'
  | 'sessions:recordings:view'
  | 'sessions:viewLogs'
  | 'audit:viewOrg'
  | 'security:manage'
  | 'security:enforcePolicies'
  | 'settings:branding'
  | 'settings:trial'
  | 'settings:emailTemplates'
  | 'settings:notifications'
  | 'settings:storage'
  | 'settings:recording'
  | 'settings:paymentGateway';

export const ALL_PERMISSIONS: readonly Permission[] = [
  'org:settings',
  'org:delete',
  'billing:view',
  'billing:manage',
  'billing:viewRevenue',
  'billing:viewInvoices',
  'billing:viewFailedPayments',
  'billing:viewTrialConversions',
  'platform:manage',
  'plan:manage',
  'audit:viewPlatform',
  'organizations:viewAll',
  'organizations:create',
  'organizations:update',
  'organizations:suspend',
  'organizations:delete',
  'organizations:viewActivity',
  'users:viewAll',
  'users:search',
  'users:activate',
  'users:deactivate',
  'users:resetAccess',
  'users:viewLoginHistory',
  'users:forceLogout',
  'members:view',
  'members:invite',
  'members:edit',
  'members:remove',
  'members:assignRole',
  'devices:view',
  'devices:viewAll',
  'devices:register',
  'devices:remove',
  'devices:assign',
  'devices:configure',
  'devices:block',
  'devices:viewActivity',
  'devices:viewOwnership',
  'devices:reportIssue',
  'devices:groups:create',
  'devices:groups:delete',
  'support:viewAll',
  'support:viewAssigned',
  'support:create',
  'support:assign',
  'support:updateStatus',
  'support:close',
  'support:escalate',
  'support:viewPerformance',
  'support:viewHistory',
  'sessions:start',
  'sessions:join',
  'sessions:monitorAll',
  'sessions:terminateAny',
  'sessions:viewHistoryAll',
  'sessions:recordings:view',
  'sessions:viewLogs',
  'audit:viewOrg',
  'security:manage',
  'security:enforcePolicies',
  'settings:branding',
  'settings:trial',
  'settings:emailTemplates',
  'settings:notifications',
  'settings:storage',
  'settings:recording',
  'settings:paymentGateway',
] as const;

export const ROLE_RANK: Record<Role, number> = {
  SUPER_ADMIN: 100,
  OWNER: 80,
  ADMIN: 60,
  VIEWER: 20,
};

export const PLATFORM_ONLY_PERMISSIONS: readonly Permission[] = [
  'platform:manage',
  'plan:manage',
  'audit:viewPlatform',
  'billing:viewRevenue',
  'billing:viewInvoices',
  'billing:viewFailedPayments',
  'billing:viewTrialConversions',
  'organizations:viewAll',
  'organizations:create',
  'organizations:update',
  'organizations:suspend',
  'organizations:delete',
  'organizations:viewActivity',
  'users:viewAll',
  'users:search',
  'users:activate',
  'users:deactivate',
  'users:resetAccess',
  'users:viewLoginHistory',
  'users:forceLogout',
  'devices:viewAll',
  'devices:block',
  'devices:viewActivity',
  'devices:viewOwnership',
  'support:escalate',
  'support:viewPerformance',
  'support:viewHistory',
  'sessions:viewLogs',
  'security:manage',
  'security:enforcePolicies',
  'settings:branding',
  'settings:trial',
  'settings:emailTemplates',
  'settings:notifications',
  'settings:storage',
  'settings:recording',
  'settings:paymentGateway',
] as const;

export const OWNER_PERMISSIONS: readonly Permission[] = [
  'org:settings',
  'org:delete',
  'audit:viewOrg',
  'billing:view',
  'billing:manage',
  'members:view',
  'members:invite',
  'members:edit',
  'members:remove',
  'members:assignRole',
  'devices:view',
  'devices:register',
  'devices:remove',
  'devices:assign',
  'devices:configure',
  'devices:groups:create',
  'devices:groups:delete',
  'support:create',
  'support:viewAll',
  'support:assign',
  'support:updateStatus',
  'support:close',
  'sessions:start',
  'sessions:join',
  'sessions:monitorAll',
  'sessions:terminateAny',
  'sessions:viewHistoryAll',
  'sessions:recordings:view',
] as const;

export const ADMIN_PERMISSIONS: readonly Permission[] = [
  'org:settings',
  'audit:viewOrg',
  // Admins share the owner's plan visibility (read-only) so the license/plan
  // is fully visible to them; owner controls exposure via role features.
  'billing:view',
  'members:view',
  'members:invite',
  'members:edit',
  'members:remove',
  'members:assignRole',
  'devices:view',
  'devices:register',
  'devices:remove',
  'devices:assign',
  'devices:configure',
  'devices:groups:create',
  'devices:groups:delete',
  'support:create',
  'support:viewAll',
  'support:assign',
  'support:updateStatus',
  'support:close',
  'sessions:start',
  'sessions:join',
  'sessions:monitorAll',
  'sessions:terminateAny',
  'sessions:viewHistoryAll',
  'sessions:recordings:view',
] as const;

// Viewers are strictly view-only: they can see the devices granted to them and
// report a problem to the owner/admins, and see the shared plan — but cannot
// start or join a remote-control session, register devices, or request help.
export const VIEWER_PERMISSIONS: readonly Permission[] = [
  'devices:view',
  'devices:reportIssue',
  'billing:view',
] as const;

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  SUPER_ADMIN: new Set(ALL_PERMISSIONS),
  OWNER: new Set(OWNER_PERMISSIONS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  VIEWER: new Set(VIEWER_PERMISSIONS),
};

const ROLE_SET = new Set<string>(ROLES);

const normalizeRole = (role: unknown): Role | null => {
  const normalized = String(role || '').trim().toUpperCase();
  return ROLE_SET.has(normalized) ? normalized as Role : null;
};

export function hasPermission(role: Role | string | null | undefined, perm: Permission): boolean {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  return ROLE_PERMISSIONS[normalizedRole].has(perm);
}

export function rankOf(role: Role | string | null | undefined): number {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? ROLE_RANK[normalizedRole] : 0;
}

export function canAssignRole(actorRole: Role | string | null | undefined, targetRole: Role | string | null | undefined): boolean {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);
  if (!actor || !target) return false;
  if (target === 'SUPER_ADMIN' || target === 'OWNER') return false;
  if (actor === 'OWNER') return target === 'ADMIN' || target === 'VIEWER';
  if (actor === 'ADMIN') return target === 'VIEWER';
  return false;
}
