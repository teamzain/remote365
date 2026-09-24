-- AlterTable
ALTER TABLE "User" ADD COLUMN "allowedDeviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "allowedDeviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
