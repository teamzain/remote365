-- Which New Meeting option created a VIDEO_MEETING row: instant | later | calendar.
-- Idempotent so it can also be applied by hand on a droplet ahead of the image build.
ALTER TABLE "RemoteSession" ADD COLUMN IF NOT EXISTS "variant" TEXT;
