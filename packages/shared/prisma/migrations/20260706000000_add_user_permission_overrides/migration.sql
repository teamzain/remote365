-- AlterTable
ALTER TABLE "User" ADD COLUMN "permissionOverrides" JSONB DEFAULT '{}';
