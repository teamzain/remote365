/**
 * Per-user permission overrides, layered on top of the role defaults and the
 * org's per-role feature toggles.
 *
 *   effective = role default  →  org roleFeatures (features only)  →  user override
 *
 * Each override entry is tri-state:
 *   absent      → inherit the role/org default
 *   true        → grant   (add a capability the role wouldn't normally have)
 *   false       → revoke  (take away a capability the role normally has)
 *
 * OWNER / SUPER_ADMIN are never governed by overrides — they always get
 * everything, so an override can never lock an owner out of their own org.
 *
 * Two namespaces are stored together on User.permissionOverrides:
 *   { features: { chat: false, ... }, permissions: { "devices:remove": true, ... } }
 * `features` drives sidebar/nav visibility (mirrors RoleFeatureKey); `permissions`
 * drives the RBAC action capabilities from rbac.ts.
 */

import {
  ALL_PERMISSIONS,
  Permission,
  Role,
  ROLE_PERMISSIONS,
} from './rbac';
import {
  RoleFeatureKey,
  RoleFeatures,
  ROLE_FEATURE_KEYS,
  resolveRoleFeatures,
} from './role-features';

export interface UserPermissionOverrides {
  features?: Partial<Record<RoleFeatureKey, boolean>>;
  permissions?: Partial<Record<Permission, boolean>>;
}

export type CapabilityKind = 'feature' | 'permission';

export interface CapabilityItem {
  key: string;
  label: string;
  description: string;
  kind: CapabilityKind;
}

export interface CapabilityCategory {
  category: string;
  description: string;
  items: CapabilityItem[];
}

/**
 * Single source of truth for what an admin can allocate per user. Drives the
 * UI matrix and bounds what overrides are accepted server-side. (Mirrored in
 * the desktop renderer, which can't import this package.)
 */
export const PERMISSION_CATALOG: readonly CapabilityCategory[] = [
  {
    category: 'Navigation',
    description: 'What this user sees in the sidebar and menus.',
    items: [
      { key: 'licenses', label: 'Licenses & plan', description: 'See the workspace plan, license usage, and upgrade options.', kind: 'feature' },
      { key: 'chat', label: 'Chat', description: 'Access the team chat.', kind: 'feature' },
      { key: 'remoteSupport', label: 'Remote support', description: 'See and start remote-support connections.', kind: 'feature' },
      { key: 'feedback', label: 'Feedback', description: 'Send product feedback.', kind: 'feature' },
      { key: 'help', label: 'Help', description: 'Open the help menu.', kind: 'feature' },
      { key: 'adminSettings', label: 'Admin settings', description: 'Open the organization admin settings (members, devices, policies, billing).', kind: 'feature' },
    ],
  },
  {
    category: 'Devices',
    description: 'What this user can do to devices they can access.',
    items: [
      { key: 'devices:register', label: 'Add / register devices', description: 'Enroll new devices into the organization.', kind: 'permission' },
      { key: 'devices:configure', label: 'Rename & configure devices', description: 'Edit a device name, tags, and settings.', kind: 'permission' },
      { key: 'devices:remove', label: 'Delete / remove devices', description: 'Remove devices from the organization.', kind: 'permission' },
      { key: 'devices:assign', label: 'Assign devices to members', description: 'Grant or revoke other members’ device access.', kind: 'permission' },
      { key: 'devices:groups:create', label: 'Create device groups', description: 'Create and rename device groups.', kind: 'permission' },
      { key: 'devices:groups:delete', label: 'Delete device groups', description: 'Delete device groups.', kind: 'permission' },
      { key: 'devices:reportIssue', label: 'Report a device problem', description: 'Flag a device issue to owners/admins.', kind: 'permission' },
    ],
  },
  {
    category: 'Sessions',
    description: 'Remote-control session capabilities.',
    items: [
      { key: 'sessions:start', label: 'Start remote sessions', description: 'Initiate a remote-control session to a device.', kind: 'permission' },
      { key: 'sessions:join', label: 'Join remote sessions', description: 'Join a session started by someone else.', kind: 'permission' },
      { key: 'sessions:viewHistoryAll', label: 'View session history', description: 'See the full remote-session history.', kind: 'permission' },
      { key: 'sessions:recordings:view', label: 'View recordings', description: 'Watch recorded remote sessions.', kind: 'permission' },
    ],
  },
  {
    category: 'Team',
    description: 'Managing organization members.',
    items: [
      { key: 'members:view', label: 'View members', description: 'See the list of organization members.', kind: 'permission' },
      { key: 'members:invite', label: 'Invite members', description: 'Send invitations to new members.', kind: 'permission' },
      { key: 'members:edit', label: 'Edit members', description: 'Change a member’s access and permissions.', kind: 'permission' },
      { key: 'members:remove', label: 'Remove members', description: 'Remove members from the organization.', kind: 'permission' },
      { key: 'members:assignRole', label: 'Assign roles', description: 'Change a member’s role (Admin / Viewer).', kind: 'permission' },
    ],
  },
  {
    category: 'Billing',
    description: 'Plan and billing visibility.',
    items: [
      { key: 'billing:view', label: 'View billing & plan', description: 'See the plan, invoices, and license usage.', kind: 'permission' },
      { key: 'billing:manage', label: 'Manage billing', description: 'Change the plan and payment details.', kind: 'permission' },
    ],
  },
  {
    category: 'Organization',
    description: 'Organization-level settings.',
    items: [
      { key: 'org:settings', label: 'Organization settings', description: 'Edit organization name, security, and policies.', kind: 'permission' },
    ],
  },
] as const;

/** Feature keys an override may touch (subset of RoleFeatureKey present in the catalog). */
export const ALLOCATABLE_FEATURES: readonly RoleFeatureKey[] = PERMISSION_CATALOG
  .flatMap((cat) => cat.items)
  .filter((item) => item.kind === 'feature')
  .map((item) => item.key as RoleFeatureKey);

/** RBAC permissions an override may touch. */
export const ALLOCATABLE_PERMISSIONS: readonly Permission[] = PERMISSION_CATALOG
  .flatMap((cat) => cat.items)
  .filter((item) => item.kind === 'permission')
  .map((item) => item.key as Permission);

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);
const ALLOCATABLE_PERMISSION_SET = new Set<string>(ALLOCATABLE_PERMISSIONS);
const ALLOCATABLE_FEATURE_SET = new Set<string>(ALLOCATABLE_FEATURES);

const normalizeRole = (role?: string | null) => String(role || '').trim().toUpperCase();
const isFullAccessRole = (role?: string | null) => {
  const r = normalizeRole(role);
  return r === 'OWNER' || r === 'SUPER_ADMIN';
};

const asOverrides = (raw: any): UserPermissionOverrides => {
  if (!raw || typeof raw !== 'object') return {};
  return {
    features: raw.features && typeof raw.features === 'object' ? raw.features : {},
    permissions: raw.permissions && typeof raw.permissions === 'object' ? raw.permissions : {},
  };
};

/**
 * Effective RBAC permission set for a user (role default + per-user override).
 * Org roleFeatures do NOT affect RBAC permissions — only the `features`
 * (sidebar) namespace is org-governed. Used by backend action gates.
 */
export function resolveEffectiveRbac(role: string | null | undefined, overrides: any): Set<Permission> {
  if (isFullAccessRole(role)) return new Set(ROLE_PERMISSIONS[normalizeRole(role) as Role] ?? ALL_PERMISSIONS);

  const roleKey = normalizeRole(role) as Role;
  const result = new Set<Permission>(ROLE_PERMISSIONS[roleKey] ?? []);
  const { permissions } = asOverrides(overrides);
  for (const [key, value] of Object.entries(permissions || {})) {
    if (!ALLOCATABLE_PERMISSION_SET.has(key)) continue; // only catalog perms are overridable
    if (value === true) result.add(key as Permission);
    else if (value === false) result.delete(key as Permission);
  }
  return result;
}

/**
 * Does a user hold a permission after applying their overrides? Backend gates
 * pass the acting user's `{ role, permissionOverrides }`.
 */
export function userHasPermission(
  user: { role?: string | null; permissionOverrides?: any } | null | undefined,
  perm: Permission,
): boolean {
  if (!user) return false;
  return resolveEffectiveRbac(user.role, user.permissionOverrides).has(perm);
}

/**
 * Full effective picture for a user: sidebar `features` + RBAC `permissions`.
 * Returned by /auth/me and used to render the per-user matrix and gate the UI.
 */
export function resolveEffectivePermissions(
  role: string | null | undefined,
  orgRoleFeatures: any,
  overrides: any,
): { features: RoleFeatures; permissions: Permission[] } {
  // Start features from the role/org resolution (reuses role-features.ts), then
  // apply the user's feature overrides.
  const features = resolveRoleFeatures(role, orgRoleFeatures);
  if (!isFullAccessRole(role)) {
    const { features: featureOverrides } = asOverrides(overrides);
    for (const key of ROLE_FEATURE_KEYS) {
      const v = (featureOverrides || {})[key];
      if (typeof v === 'boolean') features[key] = v;
    }
  }
  const permissions = Array.from(resolveEffectiveRbac(role, overrides));
  return { features, permissions };
}

/**
 * Bound a desired override object to what the acting admin is actually allowed
 * to allocate: an actor can never GRANT a capability they don't themselves
 * hold (revokes are always permitted), and unknown/non-allocatable keys are
 * dropped. `actor` is the acting user's own `{ role, permissionOverrides }`.
 */
export function sanitizeOverridesAgainstActor(
  actor: { role?: string | null; permissionOverrides?: any },
  desired: any,
): UserPermissionOverrides {
  const wanted = asOverrides(desired);
  const actorPerms = resolveEffectiveRbac(actor.role, actor.permissionOverrides);
  // Actor's effective feature visibility (owners see everything).
  const actorFeatures = resolveEffectivePermissions(actor.role, {}, actor.permissionOverrides).features;
  const actorIsFull = isFullAccessRole(actor.role);

  const cleanPermissions: Partial<Record<Permission, boolean>> = {};
  for (const [key, value] of Object.entries(wanted.permissions || {})) {
    if (!ALLOCATABLE_PERMISSION_SET.has(key) || !PERMISSION_SET.has(key)) continue;
    if (typeof value !== 'boolean') continue;
    // Grants require the actor to hold the capability; revokes are always allowed.
    if (value === true && !(actorIsFull || actorPerms.has(key as Permission))) continue;
    cleanPermissions[key as Permission] = value;
  }

  const cleanFeatures: Partial<Record<RoleFeatureKey, boolean>> = {};
  for (const [key, value] of Object.entries(wanted.features || {})) {
    if (!ALLOCATABLE_FEATURE_SET.has(key)) continue;
    if (typeof value !== 'boolean') continue;
    if (value === true && !(actorIsFull || actorFeatures[key as RoleFeatureKey])) continue;
    cleanFeatures[key as RoleFeatureKey] = value;
  }

  return { features: cleanFeatures, permissions: cleanPermissions };
}
