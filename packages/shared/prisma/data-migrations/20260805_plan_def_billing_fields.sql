-- Adds the billing fields the super-admin plan form previously dropped on
-- save (currency, billing period, trial auto-convert/reminder). Matches the
-- PlanDef model in schema.prisma; safe to run repeatedly.
ALTER TABLE "PlanDef" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "PlanDef" ADD COLUMN IF NOT EXISTS "billingPeriod" TEXT NOT NULL DEFAULT 'Monthly';
ALTER TABLE "PlanDef" ADD COLUMN IF NOT EXISTS "autoConvert" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlanDef" ADD COLUMN IF NOT EXISTS "trialReminder" TEXT;

-- Older rows saved by the UI's Draft/Archived options were collapsed to
-- "Disabled"; keep them hidden but under the label the admin actually chose.
UPDATE "PlanDef" SET "status" = 'Archived' WHERE "status" = 'Disabled';
