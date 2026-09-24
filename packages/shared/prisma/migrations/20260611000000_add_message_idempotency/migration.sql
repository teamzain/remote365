ALTER TABLE "Message" ADD COLUMN "clientMessageId" TEXT;

CREATE UNIQUE INDEX "Message_clientMessageId_key" ON "Message"("clientMessageId");
