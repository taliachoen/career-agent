-- CreateEnum
CREATE TYPE "GmailConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'NEEDS_RECONNECT');

-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GmailConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "googleEmail" TEXT,
    "encryptedRefreshToken" TEXT,
    "scope" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "oauthNonce" TEXT,
    "oauthCodeVerifier" TEXT,
    "oauthExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_userId_key" ON "GmailConnection"("userId");

-- AddForeignKey
ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
