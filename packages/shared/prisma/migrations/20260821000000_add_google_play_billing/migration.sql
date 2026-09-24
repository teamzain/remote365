-- Google Play Billing support on Subscription.
--
-- `platform` records which system owns the money for a subscription. Existing rows are
-- MANUAL by design: the only path that ever wrote them was the test-mode plan change,
-- which charged nothing, so labelling them STRIPE would overstate what happened.
CREATE TYPE "BillingPlatform" AS ENUM ('MANUAL', 'STRIPE', 'GOOGLE_PLAY');

ALTER TABLE "Subscription"
  ADD COLUMN "platform" "BillingPlatform" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "googlePlayPurchaseToken" TEXT,
  ADD COLUMN "googlePlayProductId" TEXT;

-- One Play purchase can never be claimed by two accounts.
CREATE UNIQUE INDEX "Subscription_googlePlayPurchaseToken_key"
  ON "Subscription"("googlePlayPurchaseToken");
