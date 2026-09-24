-- One-time DATA migration (no schema change): unify device groups.
--
-- The app previously had two disconnected group systems:
--   * UserDeviceGroup (personal, per-user) — used by the Devices page.
--   * DeviceGroup (org-level) — used for member access grants + the invite picker.
-- The backend now uses org DeviceGroup everywhere. This moves existing personal
-- groups (and their device memberships) into org groups so nothing is lost.
--
-- Safe to re-run (idempotent via NOT EXISTS). Purely additive — no deletes.
-- Run per environment, e.g. on the droplet:
--   docker compose -f docker-compose.prod.yml exec -T postgres \
--     psql -U remotelink -d remotelink -f - < this-file.sql
-- (UserDeviceGroup rows are intentionally left in place as a safety net.)

BEGIN;

-- 1. Copy each personal group into its owner's org group set, preserving the id
--    (so device-membership rows map across without a lookup table). Skip when an
--    org group with the same name already exists.
INSERT INTO "DeviceGroup" (id, "orgId", name, color, "createdAt", "updatedAt")
SELECT udg.id, u."organizationId", udg.name, udg.color, udg."createdAt", udg."updatedAt"
FROM "UserDeviceGroup" udg
JOIN "User" u ON u.id = udg."userId"
WHERE u."organizationId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "DeviceGroup" dg
    WHERE dg."orgId" = u."organizationId" AND dg.name = udg.name
  );

-- 2. Copy device memberships for groups that were migrated (same A=device,
--    B=group column ordering in both implicit m2m join tables).
INSERT INTO "_DeviceToGroup" ("A", "B")
SELECT j."A", j."B"
FROM "_UserDeviceGroupDevices" j
WHERE EXISTS (SELECT 1 FROM "DeviceGroup" dg WHERE dg.id = j."B")
  AND NOT EXISTS (
    SELECT 1 FROM "_DeviceToGroup" d WHERE d."A" = j."A" AND d."B" = j."B"
  );

COMMIT;
