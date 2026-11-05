-- CreateEnum
CREATE TYPE "JobDescriptionSource" AS ENUM ('FULL', 'EMAIL_SNIPPET');

-- CreateEnum
CREATE TYPE "GmailMessageStatus" AS ENUM ('DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "descriptionSource" "JobDescriptionSource" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "GmailSender" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailSender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailProcessedMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" "GmailMessageStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailProcessedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailSender_userId_value_key" ON "GmailSender"("userId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "GmailProcessedMessage_userId_messageId_key" ON "GmailProcessedMessage"("userId", "messageId");

-- AddForeignKey
ALTER TABLE "GmailSender" ADD CONSTRAINT "GmailSender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailProcessedMessage" ADD CONSTRAINT "GmailProcessedMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
