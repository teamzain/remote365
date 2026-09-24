-- Per-person chat state: a server-side read marker (unread counts and "seen" ticks
-- follow the person across devices) and the "delete for me" cut-off. Idempotent so
-- it can also be applied by hand on a droplet ahead of the image build.
ALTER TABLE "ConversationParticipant" ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP(3);
ALTER TABLE "ConversationParticipant" ADD COLUMN IF NOT EXISTS "clearedAt" TIMESTAMP(3);
