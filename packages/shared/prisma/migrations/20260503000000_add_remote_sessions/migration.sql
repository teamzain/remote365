CREATE TABLE "RemoteSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "joinLink" TEXT,
    "conversationId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "RemoteSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RemoteSessionCollaborator" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteSessionCollaborator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RemoteSessionCollaborator_sessionId_email_key" ON "RemoteSessionCollaborator"("sessionId", "email");

ALTER TABLE "RemoteSession" ADD CONSTRAINT "RemoteSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RemoteSessionCollaborator" ADD CONSTRAINT "RemoteSessionCollaborator_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RemoteSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RemoteSessionCollaborator" ADD CONSTRAINT "RemoteSessionCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
