-- 2026-09-04: Subscription.paidSince — the first moment a row moved onto a paid
-- (non-TRIAL) plan; cleared when it drops back to TRIAL. Feeds the Billing &
-- Revenue "new revenue this month" KPI, which used to key on createdAt (the
-- trial row's birth at sign-up, which never moves on upgrade).
--
-- Backfilled from createdAt for rows that are already paid so the KPI keeps
-- its previous meaning for legacy rows and only new upgrades change it.
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "paidSince" TIMESTAMP(3);

UPDATE "Subscription"
   SET "paidSince" = "createdAt"
 WHERE "paidSince" IS NULL
   AND ("customPlanKey" IS NOT NULL OR plan <> 'TRIAL');
