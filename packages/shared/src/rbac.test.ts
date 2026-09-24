import assert from 'node:assert/strict';
import {
  ADMIN_PERMISSIONS,
  ALL_PERMISSIONS,
  OWNER_PERMISSIONS,
  PLATFORM_ONLY_PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  VIEWER_PERMISSIONS,
  canAssignRole,
  hasPermission,
  rankOf,
  type Permission,
  type Role,
} from './rbac';

const expectedRanks: Record<Role, number> = {
  SUPER_ADMIN: 100,
  OWNER: 80,
  ADMIN: 60,
  VIEWER: 20,
};

for (const [role, rank] of Object.entries(expectedRanks) as Array<[Role, number]>) {
  assert.equal(ROLE_RANK[role], rank);
  assert.equal(rankOf(role), rank);
}

for (const permission of ALL_PERMISSIONS) {
  assert.equal(hasPermission('SUPER_ADMIN', permission), true);
}

const platformPermissions: Permission[] = ['platform:manage', 'plan:manage', 'audit:viewPlatform'];
for (const role of ['OWNER', 'ADMIN', 'VIEWER'] as Role[]) {
  for (const permission of platformPermissions) {
    assert.equal(hasPermission(role, permission), false);
  }
}

for (const permission of PLATFORM_ONLY_PERMISSIONS) {
  assert.equal(hasPermission('SUPER_ADMIN', permission), true);
  for (const role of ['OWNER', 'ADMIN', 'VIEWER'] as Role[]) {
    assert.equal(hasPermission(role, permission), false);
  }
}

assert.deepEqual(
  Array.from(ROLE_PERMISSIONS.SUPER_ADMIN).sort(),
  Array.from(ALL_PERMISSIONS).sort(),
);

assert.deepEqual(
  Array.from(ROLE_PERMISSIONS.OWNER).sort(),
  Array.from(OWNER_PERMISSIONS).sort(),
);

for (const permission of OWNER_PERMISSIONS) {
  assert.equal(hasPermission('OWNER', permission), true);
}

assert.equal(hasPermission('OWNER', 'organizations:viewAll'), false);
assert.equal(hasPermission('OWNER', 'billing:viewRevenue'), false);
assert.equal(hasPermission('OWNER', 'platform:manage'), false);
assert.equal(hasPermission('OWNER', 'plan:manage'), false);
assert.equal(hasPermission('OWNER', 'audit:viewPlatform'), false);
assert.equal(hasPermission('OWNER', 'users:viewAll'), false);
assert.equal(hasPermission('OWNER', 'devices:viewAll'), false);
assert.equal(hasPermission('OWNER', 'devices:block'), false);
assert.equal(hasPermission('OWNER', 'security:manage'), false);
assert.equal(hasPermission('OWNER', 'settings:paymentGateway'), false);
assert.equal(hasPermission('OWNER', 'sessions:viewLogs'), false);
assert.equal(hasPermission('OWNER', 'support:escalate'), false);

assert.deepEqual(
  Array.from(ROLE_PERMISSIONS.ADMIN).sort(),
  Array.from(ADMIN_PERMISSIONS).sort(),
);

for (const permission of ADMIN_PERMISSIONS) {
  assert.equal(hasPermission('ADMIN', permission), true);
}

assert.equal(hasPermission('ADMIN', 'org:delete'), false);
assert.equal(hasPermission('ADMIN', 'org:settings'), true);
assert.equal(hasPermission('ADMIN', 'audit:viewOrg'), true);
assert.equal(hasPermission('ADMIN', 'billing:view'), true);
assert.equal(hasPermission('ADMIN', 'billing:manage'), false);
assert.equal(hasPermission('ADMIN', 'members:invite'), true);
assert.equal(hasPermission('ADMIN', 'members:edit'), true);
assert.equal(hasPermission('ADMIN', 'members:remove'), true);
assert.equal(hasPermission('ADMIN', 'members:assignRole'), true);
assert.equal(hasPermission('ADMIN', 'devices:register'), true);
assert.equal(hasPermission('ADMIN', 'devices:remove'), true);
assert.equal(hasPermission('ADMIN', 'devices:assign'), true);
assert.equal(hasPermission('ADMIN', 'devices:configure'), true);
assert.equal(hasPermission('ADMIN', 'support:viewAll'), true);
assert.equal(hasPermission('ADMIN', 'support:assign'), true);
assert.equal(hasPermission('ADMIN', 'support:updateStatus'), true);
assert.equal(hasPermission('ADMIN', 'support:close'), true);
assert.equal(hasPermission('ADMIN', 'sessions:monitorAll'), true);
assert.equal(hasPermission('ADMIN', 'sessions:terminateAny'), true);
assert.equal(hasPermission('ADMIN', 'sessions:viewHistoryAll'), true);
assert.equal(hasPermission('ADMIN', 'sessions:recordings:view'), true);
assert.equal(hasPermission('ADMIN', 'billing:viewRevenue'), false);
assert.equal(hasPermission('ADMIN', 'organizations:update'), false);
assert.equal(hasPermission('ADMIN', 'users:viewAll'), false);
assert.equal(hasPermission('ADMIN', 'devices:viewAll'), false);
assert.equal(hasPermission('ADMIN', 'devices:block'), false);
assert.equal(hasPermission('ADMIN', 'sessions:viewLogs'), false);
assert.equal(hasPermission('ADMIN', 'support:escalate'), false);
assert.equal(hasPermission('ADMIN', 'support:viewPerformance'), false);
assert.equal(hasPermission('ADMIN', 'support:viewHistory'), false);
assert.equal(hasPermission('ADMIN', 'security:manage'), false);
assert.equal(hasPermission('ADMIN', 'settings:paymentGateway'), false);

assert.deepEqual(
  Array.from(ROLE_PERMISSIONS.VIEWER).sort(),
  Array.from(VIEWER_PERMISSIONS).sort(),
);

for (const permission of VIEWER_PERMISSIONS) {
  assert.equal(hasPermission('VIEWER', permission), true);
}

const viewerDeniedPermissions: Permission[] = [
  'members:view',
  'members:invite',
  'members:edit',
  'members:remove',
  'members:assignRole',
  'billing:manage',
  'billing:viewRevenue',
  'billing:viewInvoices',
  'billing:viewFailedPayments',
  'billing:viewTrialConversions',
  'plan:manage',
  'org:settings',
  'org:delete',
  'audit:viewOrg',
  'platform:manage',
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
  'security:manage',
  'security:enforcePolicies',
  'settings:branding',
  'settings:trial',
  'settings:emailTemplates',
  'settings:notifications',
  'settings:storage',
  'settings:recording',
  'settings:paymentGateway',
  'devices:register',
  'devices:remove',
  'devices:assign',
  'devices:configure',
  'devices:groups:create',
  'devices:groups:delete',
  'devices:viewAll',
  'devices:block',
  'devices:viewActivity',
  'devices:viewOwnership',
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
];

for (const permission of viewerDeniedPermissions) {
  assert.equal(hasPermission('VIEWER', permission), false);
}

assert.equal(hasPermission('VIEWER', 'devices:view'), true);
assert.equal(hasPermission('VIEWER', 'devices:reportIssue'), true);
assert.equal(hasPermission('VIEWER', 'billing:view'), true);
assert.equal(hasPermission('VIEWER', 'devices:register'), false);
assert.equal(hasPermission('VIEWER', 'support:create'), false);
assert.equal(hasPermission('VIEWER', 'users:viewAll'), false);
assert.equal(hasPermission('VIEWER', 'sessions:start'), false);
assert.equal(hasPermission('UNKNOWN', 'devices:view'), false);

assert.equal(canAssignRole('OWNER', 'ADMIN'), true);
assert.equal(canAssignRole('OWNER', 'VIEWER'), true);
assert.equal(canAssignRole('OWNER', 'OWNER'), false);
assert.equal(canAssignRole('OWNER', 'SUPER_ADMIN'), false);
assert.equal(canAssignRole('ADMIN', 'VIEWER'), true);
assert.equal(canAssignRole('ADMIN', 'ADMIN'), false);
assert.equal(canAssignRole('VIEWER', 'ADMIN'), false);

console.log('RBAC tests passed');
