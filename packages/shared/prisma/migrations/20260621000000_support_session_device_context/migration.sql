ALTER TABLE "SupportSession" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "SupportSession" ADD COLUMN IF NOT EXISTS "deviceName" TEXT;

CREATE INDEX IF NOT EXISTS "SupportSession_deviceId_idx" ON "SupportSession"("deviceId");
