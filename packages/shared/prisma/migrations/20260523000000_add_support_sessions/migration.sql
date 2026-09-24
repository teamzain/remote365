-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'QUEUED', 'ASSIGNED', 'RINGING', 'CONNECTED', 'ENDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "SupportSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'QUEUED',
    "orgId" TEXT NOT NULL,
    "customerUserId" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "technicianId" TEXT,
    "issueCategory" TEXT,
    "issueSummary" TEXT,
    "notes" TEXT,
    "systemInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "rating" INTEGER,
    "ratingComment" TEXT,
    "recordingUrl" TEXT,

    CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportSession_code_key" ON "SupportSession"("code");

-- CreateIndex
CREATE INDEX "SupportSession_orgId_status_idx" ON "SupportSession"("orgId", "status");

-- CreateIndex
CREATE INDEX "SupportSession_technicianId_idx" ON "SupportSession"("technicianId");

-- CreateIndex
CREATE INDEX "SupportSession_code_idx" ON "SupportSession"("code");
