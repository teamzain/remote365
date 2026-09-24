/**
 * Owner-configurable feature visibility per member role. The owner flips these
 * in Admin settings → Roles & permissions; they govern what ADMIN and VIEWER
 * members see (sidebar entries, the Licenses/plan surface, etc.). OWNER and
 * SUPER_ADMIN always see everything and are never governed by this.
 *
 * Stored as JSON on Organization.roleFeatures, keyed by role:
 *   { ADMIN: { licenses: true, ... }, VIEWER: { ... } }
 */

export type RoleFeatureKey =
  | 'licenses'
  | 'chat'
  | 'remoteSupport'
  | 'feedback'
  | 'help'
  | 'adminSettings';

export interface RoleFeatureMeta {
  key: RoleFeatureKey;
  label: string;
  description: string;
}

// Order here drives the order shown in the owner's matrix editor.
export const ROLE_FEATURE_META: readonly RoleFeatureMeta[] = [
  { key: 'licenses', label: 'Licenses & plan', description: 'See the workspace plan, license usage, and upgrade options.' },
  { key: 'chat', label: 'Chat', description: 'Access the team chat.' },
  { key: 'remoteSupport', label: 'Remote support', description: 'Start remote-support connections to devices.' },
  { key: 'feedback', label: 'Feedback', description: 'Send product feedback.' },
  { key: 'help', label: 'Help', description: 'Open the help menu.' },
  { key: 'adminSettings', label: 'Admin settings', description: 'Open the organization admin settings (members, devices, policies, billing).' },
] as const;

export const ROLE_FEATURE_KEYS: readonly RoleFeatureKey[] = ROLE_FEATURE_META.map((m) => m.key);

export type RoleFeatures = Record<RoleFeatureKey, boolean>;

// Roles the owner can configure. OWNER/SUPER_ADMIN are intentionally excluded.
export const CONFIGURABLE_ROLES = ['ADMIN', 'VIEWER'] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

const ALL_ON: RoleFeatures = { licenses: true, chat: true, remoteSupport: true, feedback: true, help: true, adminSettings: true };

// Sensible defaults when the owner hasn't customized anything. Viewers are
// view-only, so remote support is off for them by default. Admin settings is
// off for both Admin and Viewer by default — only the owner sees it unless the
// owner explicitly grants it.
export const ROLE_FEATURE_DEFAULTS: Record<ConfigurableRole, RoleFeatures> = {
  ADMIN: { licenses: true, chat: true, remoteSupport: true, feedback: true, help: true, adminSettings: false },
  VIEWER: { licenses: true, chat: true, remoteSupport: false, feedback: true, help: true, adminSettings: false },
};

const normalizeRole = (role?: string | null) => String(role || '').trim().toUpperCase();

/** Coerce a stored/partial features object into a complete RoleFeatures. */
const coerce = (base: RoleFeatures, override: any): RoleFeatures => {
  const result = { ...base };
  if (override && typeof override === 'object') {
    for (const key of ROLE_FEATURE_KEYS) {
      if (typeof override[key] === 'boolean') result[key] = override[key];
    }
  }
  return result;
};

/**
 * Effective features for a specific user's role, merging the org's stored
 * overrides over the role defaults. OWNER/SUPER_ADMIN get everything.
 */
export function resolveRoleFeatures(role: string | null | undefined, roleFeatures: any): RoleFeatures {
  const r = normalizeRole(role);
  if (r === 'OWNER' || r === 'SUPER_ADMIN') return { ...ALL_ON };
  if (r === 'ADMIN' || r === 'VIEWER') {
    return coerce(ROLE_FEATURE_DEFAULTS[r], roleFeatures?.[r]);
  }
  // Unknown roles: nothing extra.
  return { licenses: false, chat: false, remoteSupport: false, feedback: false, help: false, adminSettings: false };
}

/** Full editable matrix for the owner UI: defaults merged with stored overrides. */
export function resolveRoleFeatureMatrix(roleFeatures: any): Record<ConfigurableRole, RoleFeatures> {
  return {
    ADMIN: coerce(ROLE_FEATURE_DEFAULTS.ADMIN, roleFeatures?.ADMIN),
    VIEWER: coerce(ROLE_FEATURE_DEFAULTS.VIEWER, roleFeatures?.VIEWER),
  };
}
