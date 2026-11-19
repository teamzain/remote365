-- App Store (iOS) subscriptions: additive only.
-- AlterEnum
ALTER TYPE "BillingPlatform" ADD VALUE 'APP_STORE';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "appStoreEnvironment" TEXT,
ADD COLUMN "appStoreOriginalTransactionId" TEXT,
ADD COLUMN "appStoreProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_appStoreOriginalTransactionId_key" ON "Subscription"("appStoreOriginalTransactionId");
