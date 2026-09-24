-- Business sign-up: company details on the organisation. Idempotent so it can
-- also be applied by hand on a droplet ahead of the image build.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "accountType" TEXT NOT NULL DEFAULT 'PERSONAL';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "businessNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "companyEmail" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "addressLine" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
