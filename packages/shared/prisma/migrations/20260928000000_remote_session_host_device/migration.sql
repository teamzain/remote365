-- Support sessions now share the CREATOR's computer: the session remembers which
-- device it was created on (hostAccessKey), and the first account that uses the
-- code takes the seat (joinedById/joinedAt), so a code works once.
-- Idempotent so it can also be applied by hand on a droplet ahead of the image build.
ALTER TABLE "RemoteSession" ADD COLUMN IF NOT EXISTS "hostAccessKey" TEXT;
ALTER TABLE "RemoteSession" ADD COLUMN IF NOT EXISTS "joinedById" TEXT;
ALTER TABLE "RemoteSession" ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3);
