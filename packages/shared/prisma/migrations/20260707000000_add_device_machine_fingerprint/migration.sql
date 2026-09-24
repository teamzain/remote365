-- AlterTable
ALTER TABLE "Device" ADD COLUMN "machineFingerprint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Device_machineFingerprint_key" ON "Device"("machineFingerprint");
