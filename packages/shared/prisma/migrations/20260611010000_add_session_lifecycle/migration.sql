ALTER TABLE "RemoteSession" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "RemoteSession" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "RemoteSession" ADD COLUMN "requestId" TEXT;
ALTER TABLE "RemoteSessionCollaborator" ADD COLUMN "joinedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "RemoteSession_requestId_key" ON "RemoteSession"("requestId");
CREATE INDEX "RemoteSession_status_expiresAt_idx" ON "RemoteSession"("status", "expiresAt");
