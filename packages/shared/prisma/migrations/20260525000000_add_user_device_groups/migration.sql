-- Account-scoped device groups for the Devices page.
-- These groups belong to one user and do not change/remove the devices.
CREATE TABLE "UserDeviceGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDeviceGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_UserDeviceGroupDevices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "UserDeviceGroup_userId_name_key" ON "UserDeviceGroup"("userId", "name");
CREATE INDEX "UserDeviceGroup_userId_idx" ON "UserDeviceGroup"("userId");
CREATE UNIQUE INDEX "_UserDeviceGroupDevices_AB_unique" ON "_UserDeviceGroupDevices"("A", "B");
CREATE INDEX "_UserDeviceGroupDevices_B_index" ON "_UserDeviceGroupDevices"("B");

ALTER TABLE "UserDeviceGroup" ADD CONSTRAINT "UserDeviceGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_UserDeviceGroupDevices" ADD CONSTRAINT "_UserDeviceGroupDevices_A_fkey" FOREIGN KEY ("A") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_UserDeviceGroupDevices" ADD CONSTRAINT "_UserDeviceGroupDevices_B_fkey" FOREIGN KEY ("B") REFERENCES "UserDeviceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
