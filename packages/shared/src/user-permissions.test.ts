import assert from 'node:assert/strict';
import {
  ALLOCATABLE_FEATURES,
  ALLOCATABLE_PERMISSIONS,
  PERMISSION_CATALOG,
  resolveEffectivePermissions,
  resolveEffectiveRbac,
  sanitizeOverridesAgainstActor,
  userHasPermission,
} from './user-permissions';
import { OWNER_PERMISSIONS } from './rbac';
import { ROLE_FEATURE_KEYS } from './role-features';

// --- 1. Viewer granted remote session permission can see/use Remote support ---

const grantedViewer = {
  role: 'VIEWER',
  permissionOverrides: {
    features: { remoteSupport: true },
    permissions: { 'sessions:start': true },
  },
};

// Backend gate (devices verify-access, meeting start).
assert.equal(userHasPermission(grantedViewer, 'sessions:start'), true);

// Desktop gate: /auth/me resolution shows both the page and the action.
const grantedViewerResolved = resolveEffectivePermissions('VIEWER', {}, grantedViewer.permissionOverrides);
assert.equal(grantedViewerResolved.features.remoteSupport, true);
assert.ok(grantedViewerResolved.permissions.includes('sessions:start'));

// A plain viewer stays view-only.
const plainViewer = { role: 'VIEWER', permissionOverrides: {} };
assert.equal(userHasPermission(plainViewer, 'sessions:start'), false);
const plainViewerResolved = resolveEffectivePermissions('VIEWER', {}, {});
assert.equal(plainViewerResolved.features.remoteSupport, false);
assert.ok(!plainViewerResolved.permissions.includes('sessions:start'));

// --- 2. Admin revoked device removal cannot remove devices ---

const strippedAdmin = {
  role: 'ADMIN',
  permissionOverrides: { permissions: { 'devices:remove': false } },
};
assert.equal(userHasPermission(strippedAdmin, 'devices:remove'), false);
// The rest of the admin's device powers are untouched.
assert.equal(userHasPermission(strippedAdmin, 'devices:register'), true);
assert.equal(userHasPermission(strippedAdmin, 'devices:configure'), true);

// --- 3. Admin revoked role assignment cannot change member roles ---

const noRolesAdmin = {
  role: 'ADMIN',
  permissionOverrides: { permissions: { 'members:assignRole': false } },
};
assert.equal(userHasPermission(noRolesAdmin, 'members:assignRole'), false);
// They can still invite/edit unless those are revoked too.
assert.equal(userHasPermission(noRolesAdmin, 'members:invite'), true);
assert.equal(userHasPermission(noRolesAdmin, 'members:edit'), true);

// --- 4. Owner always retains full access — overrides can never lock them out ---

const sabotagedOwner = {
  role: 'OWNER',
  permissionOverrides: {
    features: Object.fromEntries(ROLE_FEATURE_KEYS.map((k) => [k, false])),
    permissions: Object.fromEntries(ALLOCATABLE_PERMISSIONS.map((p) => [p, false])),
  },
};
for (const permission of OWNER_PERMISSIONS) {
  assert.equal(userHasPermission(sabotagedOwner, permission), true, `owner must keep ${permission}`);
}
const ownerResolved = resolveEffectivePermissions('OWNER', { ADMIN: { licenses: false } }, sabotagedOwner.permissionOverrides);
for (const key of ROLE_FEATURE_KEYS) {
  assert.equal(ownerResolved.features[key], true, `owner must keep feature ${key}`);
}

// Same for SUPER_ADMIN.
assert.equal(userHasPermission({ role: 'SUPER_ADMIN', permissionOverrides: { permissions: { 'devices:remove': false } } }, 'devices:remove'), true);

// --- Override bounds: only catalog capabilities are overridable ---

// A grant of a platform-only permission via overrides is ignored.
const sneakyViewer = resolveEffectiveRbac('VIEWER', { permissions: { 'platform:manage': true, 'org:delete': true } });
assert.ok(!sneakyViewer.has('platform:manage' as any));
assert.ok(!sneakyViewer.has('org:delete' as any));

// --- sanitizeOverridesAgainstActor: an actor can't grant beyond their own ceiling ---

// Admin (no billing:manage) tries to grant billing:manage → dropped; the
// revoke of devices:remove survives (revokes are always allowed).
const adminActor = { role: 'ADMIN', permissionOverrides: {} };
const cleaned = sanitizeOverridesAgainstActor(adminActor, {
  permissions: { 'billing:manage': true, 'devices:remove': false, 'sessions:start': true },
  features: { remoteSupport: true, bogus: true },
});
assert.equal(cleaned.permissions?.['billing:manage'], undefined);
assert.equal(cleaned.permissions?.['devices:remove'], false);
assert.equal(cleaned.permissions?.['sessions:start'], true);
assert.equal(cleaned.features?.remoteSupport, true);
assert.equal((cleaned.features as any)?.bogus, undefined);

// An admin whose own sessions:start was revoked can no longer grant it.
const revokedAdminActor = { role: 'ADMIN', permissionOverrides: { permissions: { 'sessions:start': false } } };
const cleaned2 = sanitizeOverridesAgainstActor(revokedAdminActor, { permissions: { 'sessions:start': true } });
assert.equal(cleaned2.permissions?.['sessions:start'], undefined);

// Owners can grant anything allocatable.
const ownerActor = { role: 'OWNER', permissionOverrides: {} };
const cleaned3 = sanitizeOverridesAgainstActor(ownerActor, {
  permissions: { 'billing:manage': true },
  features: { adminSettings: true },
});
assert.equal(cleaned3.permissions?.['billing:manage'], true);
assert.equal(cleaned3.features?.adminSettings, true);

// --- Catalog sanity: every catalog capability is actually overridable ---

for (const cat of PERMISSION_CATALOG) {
  for (const item of cat.items) {
    if (item.kind === 'permission') {
      assert.ok(ALLOCATABLE_PERMISSIONS.includes(item.key as any), `catalog permission ${item.key} must be allocatable`);
    } else {
      assert.ok(ALLOCATABLE_FEATURES.includes(item.key as any), `catalog feature ${item.key} must be allocatable`);
    }
  }
}
// The per-member editor exposes adminSettings — it must be servable/acceptable.
assert.ok(ALLOCATABLE_FEATURES.includes('adminSettings' as any));

console.log('User-permission override tests passed');
