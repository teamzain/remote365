-- Allow logged-out users to create server-backed video meetings.
ALTER TABLE "RemoteSession" DROP CONSTRAINT IF EXISTS "RemoteSession_createdById_fkey";

ALTER TABLE "RemoteSession" ALTER COLUMN "createdById" DROP NOT NULL;

ALTER TABLE "RemoteSession"
ADD CONSTRAINT "RemoteSession_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
