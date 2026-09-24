# Remote 365 RBAC System Report

Date: 2026-07-07

## Goal

Make the desktop RBAC flow feel smooth and predictable, with the organization owner having clear control over what Admin and Viewer users can see and do.

## Current Model

The system currently has four roles:

- `SUPER_ADMIN`: platform-level access.
- `OWNER`: organization owner, intended to have full organization control.
- `ADMIN`: organization staff role.
- `VIEWER`: restricted/view-only member role.

The core role defaults live in `packages/shared/src/rbac.ts`.

Important current defaults:

- Owners can manage organization settings, billing, members, devices, support, sessions, and recordings.
- Admins currently get many strong defaults: organization settings, member invite/edit/remove/assign role, device register/remove/assign/configure, support assignment/status/close, and session monitor/terminate/history/recordings.
- Viewers currently get `devices:view`, `devices:reportIssue`, and `billing:view`.

There are two newer customization layers:

- Organization role feature toggles in `Organization.roleFeatures`, handled by `packages/shared/src/role-features.ts`.
- Per-user permission overrides in `User.permissionOverrides`, handled by `packages/shared/src/user-permissions.ts`.

The intended effective permission stack is:

1. Role default.
2. Organization-level feature visibility for Admin/Viewer.
3. Per-user grants/revokes.

Owner and Super Admin are intentionally not governed by these overrides.

## What Already Works

The backend has a good shared resolver:

- `resolveEffectivePermissions()` returns both UI features and action permissions.
- `userHasPermission()` checks role defaults plus per-user overrides.
- `sanitizeOverridesAgainstActor()` prevents an Admin from granting capabilities they do not personally have.

The desktop also has a member permission editor:

- `apps/desktop/src/renderer/components/members/MemberPermissions.tsx`
- It lets an owner/admin pick a member role and fine-tune feature/permission toggles.
- It saves to `PATCH /api/members/:userId/permissions`.

The member routes are mostly aligned with the new model:

- `apps/auth-service/src/routes/members.ts` loads the actor with `permissionOverrides`.
- Invite, view, remove, edit, and per-user permission updates use `userHasPermission()`.

The device routes are partly aligned:

- Most device actions now call `hasDeviceCapability()`, which uses `userHasPermission()`.
- This means per-user device grants/revokes are honored for many device operations.

## Main Problems

### 1. UI still gates major areas by raw role

`apps/desktop/src/renderer/App.tsx` still has several role-only checks:

- `canSeeSessionsView = ['OWNER', 'ADMIN'].includes(normalizedRole)`
- `canUseRemoteSupportView = normalizedRole !== 'VIEWER'`
- `canSeeDevicesView = true`

This makes the owner permission editor feel unreliable. For example:

- If the owner grants a Viewer `sessions:start`, the Viewer may still not see Remote support because the UI only checks `role !== VIEWER`.
- If the owner revokes an Admin's session permissions, the Admin may still see session-related UI because the UI only checks the role.
- Feature toggle `remoteSupport` exists, but the main navigation is not using it consistently.

### 2. Some backend routes still ignore per-user overrides

Several routes still use `hasPermission(decoded.role, ...)` or role helpers instead of loading the acting user and calling `userHasPermission()`.

Examples:

- `apps/auth-service/src/routes/groups.ts` checks `hasPermission(user.role, 'devices:assign')`.
- `apps/auth-service/src/routes/organizations.ts` checks `hasPermission(decoded.role, 'org:settings')` for organization settings and role-feature reads.
- `apps/auth-service/src/routes/devices.ts` has a remote access check that selects only `role` and calls `canRequestControl(viewer?.role)`, which ignores `permissionOverrides`.

This creates mismatches where the UI may show a permission as granted, but the backend rejects the action, or the backend allows a role-default action that the owner thought was revoked.

### 3. Feature toggles and action permissions overlap in confusing ways

There are both:

- Feature toggles such as `remoteSupport`, `adminSettings`, `licenses`.
- Action permissions such as `sessions:start`, `members:edit`, `billing:view`.

That split is useful, but the UX currently does not make the dependency clear.

Example:

- A user may have `sessions:start` but not the `remoteSupport` feature.
- Or may see `remoteSupport` but lack `sessions:start`.

The result can feel weird: the page appears but actions fail, or the permission is enabled but the user cannot find the page.

### 4. Admin defaults are too powerful for an owner-controlled model

Admin currently starts with near-owner organization capabilities, including:

- Member invite/edit/remove/assign role.
- Device register/remove/assign/configure.
- Session monitor/terminate/history/recordings.
- Organization settings.

Because the role default is already broad, the owner mostly has to remove things from Admins. That feels less like "owner controls what admins can do" and more like "admins are powerful unless manually limited."

For a smoother owner-led model, Admin should probably be a strong but bounded role, with dangerous powers explicitly granted by the owner.

### 5. Renderer duplicates the permission catalog

The shared source of truth is `packages/shared/src/user-permissions.ts`, but the desktop renderer mirrors the catalog manually in `MemberPermissions.tsx`.

That creates drift risk:

- Backend allows one set of permissions.
- UI shows another set.
- Labels/descriptions/defaults may fall out of sync.

This already matters because the owner experience depends on the matrix being trusted.

### 6. Role-level settings only control visibility, not real backend access

`Organization.roleFeatures` controls what Admin/Viewer see, not what they can do.

The page says "Roles & permissions", but the role-level matrix only changes feature visibility. Real action permissions are handled per user through `User.permissionOverrides`.

This naming can confuse owners because they expect the Admin and Viewer columns to define the actual role behavior.

## Recommended Target Model

Use three clear layers:

### Layer 1: Role Presets

Roles should be presets, not the final authority.

Recommended behavior:

- Owner: full organization control, never editable by Admins/Viewers.
- Admin: can help manage the workspace, but risky powers are explicit grants.
- Viewer: can view assigned devices and report issues by default.

### Layer 2: Role Template Editor

The owner should be able to edit Admin and Viewer role templates.

This should control both:

- Navigation/features.
- Action permissions.

Stored shape could stay under `Organization.roleFeatures` plus a new `Organization.rolePermissionDefaults`, or be unified as:

```json
{
  "ADMIN": {
    "features": {},
    "permissions": {}
  },
  "VIEWER": {
    "features": {},
    "permissions": {}
  }
}
```

### Layer 3: Per-User Overrides

The owner should still be able to fine-tune a specific member.

Effective access should become:

```text
base role preset -> owner-edited role template -> per-user override
```

## Recommended Implementation Plan

### Phase 1: Make current system consistent

This is the fastest fix for the current weirdness.

1. Add small helpers in the desktop renderer:
   - `hasUserPermission(user, permission)`
   - `hasUserFeature(user, feature)`

2. Replace raw-role UI gates in `App.tsx`:
   - Remote support should require `features.remoteSupport` and `permissions` like `sessions:start`.
   - Sessions/history should require matching session permissions.
   - Billing should use `billing:view` plus the `licenses` feature.
   - Admin settings should use `features.adminSettings` plus the relevant member/org permissions.

3. Replace remaining backend `hasPermission(role, ...)` checks for org/member/device/group routes with `userHasPermission(actor, ...)`.

4. Fix remote connection control:
   - Load `permissionOverrides` in the `verify-access` viewer lookup.
   - Check `userHasPermission(viewer, 'sessions:start')` or a more specific `sessions:control` permission if added.

5. Add tests for:
   - Viewer granted `sessions:start` can see and use Remote support.
   - Admin revoked `devices:remove` cannot remove devices.
   - Admin revoked `members:assignRole` cannot change roles.
   - Owner always keeps full organization access.

### Phase 2: Make owner controls simpler

1. Rename the current "Roles & permissions" role matrix if it remains visibility-only.
   - Better: "Role visibility" or "Navigation access".

2. Or upgrade it into a true role-template editor:
   - Admin column controls Admin default permissions.
   - Viewer column controls Viewer default permissions.
   - Per-user member editor remains for exceptions.

3. Group controls into plain-language sections:
   - Navigation
   - Devices
   - Remote sessions
   - Team
   - Billing
   - Organization settings

4. Show a clear "Effective access" summary for each member:
   - Role default
   - Changed by owner template
   - Custom override

### Phase 3: Reduce future drift

1. Stop duplicating the permission catalog manually in the renderer.
2. Export a shared JSON/catalog artifact, or create an API endpoint like:

```text
GET /api/members/permission-catalog
```

3. Drive the owner UI from that catalog.
4. Add automated tests around the catalog and effective permission resolver.

## Suggested Admin and Viewer Defaults

### Admin Default

Recommended default:

- Can view members.
- Can invite viewers.
- Can view devices.
- Can configure assigned devices.
- Can start/join sessions for assigned devices.
- Can view session history for assigned devices.
- Can view billing/license usage only.

Owner-granted only:

- Remove members.
- Assign roles.
- Delete/remove devices.
- Assign devices to other members.
- Manage billing.
- Change organization settings.
- Terminate any session.
- View all session recordings.

### Viewer Default

Recommended default:

- View assigned devices.
- Report a device problem.
- Optionally view license/plan only if owner enables it.

Owner-granted only:

- Start remote session.
- Join session.
- Chat.
- Remote support page visibility.
- Device configuration.

## High-Impact Fixes

1. Use `user.permissions` and `user.features` everywhere in the desktop shell.
2. Use `userHasPermission()` everywhere in organization/member/device/group backend gates.
3. Decide whether role-level controls are visibility-only or true permission templates.
4. Make Admin less powerful by default, then let the owner add powers.
5. Avoid catalog drift by serving the permission catalog from the backend/shared package.

## Bottom Line

The foundation is good, but it is half-migrated. The shared permission resolver and per-user override model already support the owner-led control you want. The weirdness comes from old role-only gates still living in the desktop shell and some backend routes.

The clean direction is:

- Owner always full control.
- Admin and Viewer are editable templates.
- Each member can have exceptions.
- Every UI and backend decision reads from the same effective permission result.
