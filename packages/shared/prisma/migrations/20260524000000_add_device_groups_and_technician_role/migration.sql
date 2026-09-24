ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TECHNICIAN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MEMBER';

CREATE TABLE IF NOT EXISTS "DeviceGroup" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceGroup_orgId_name_key" ON "DeviceGroup"("orgId", "name");
CREATE INDEX IF NOT EXISTS "DeviceGroup_orgId_idx" ON "DeviceGroup"("orgId");

ALTER TABLE "DeviceGroup"
    ADD CONSTRAINT "DeviceGroup_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "_DeviceToGroup" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "_DeviceToGroup_AB_unique" ON "_DeviceToGroup"("A", "B");
CREATE INDEX IF NOT EXISTS "_DeviceToGroup_B_index" ON "_DeviceToGroup"("B");

ALTER TABLE "_DeviceToGroup"
    ADD CONSTRAINT "_DeviceToGroup_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_DeviceToGroup"
    ADD CONSTRAINT "_DeviceToGroup_B_fkey"
    FOREIGN KEY ("B") REFERENCES "DeviceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "_MemberAllowedGroups" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "_MemberAllowedGroups_AB_unique" ON "_MemberAllowedGroups"("A", "B");
CREATE INDEX IF NOT EXISTS "_MemberAllowedGroups_B_index" ON "_MemberAllowedGroups"("B");

ALTER TABLE "_MemberAllowedGroups"
    ADD CONSTRAINT "_MemberAllowedGroups_A_fkey"
    FOREIGN KEY ("A") REFERENCES "DeviceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_MemberAllowedGroups"
    ADD CONSTRAINT "_MemberAllowedGroups_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "allowedGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
