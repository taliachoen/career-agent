-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('MANUAL', 'EMAIL');

-- DropIndex
DROP INDEX "Job_userId_idx";

-- AlterTable (url is dropped further down, after it has been copied into JobPosting)
ALTER TABLE "Job" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "source" "JobSource" NOT NULL,
    "sourceMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPosting_jobId_idx" ON "JobPosting"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosting_userId_url_key" ON "JobPosting"("userId", "url");

-- CreateIndex
CREATE INDEX "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_id_userId_key" ON "Job"("id", "userId");

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_jobId_userId_fkey" FOREIGN KEY ("jobId", "userId") REFERENCES "Job"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing job keeps its url as one MANUAL posting.
-- site = lowercased hostname without userinfo, port or a leading "www."
-- (the same value the app computes with new URL(url).hostname).
INSERT INTO "JobPosting" ("id", "jobId", "userId", "url", "site", "source", "sourceMessageId", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "userId",
    "url",
    regexp_replace(
        lower(substring("url" from '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^/?#@]*@)?([^/:?#]+)')),
        '^www\.',
        ''
    ),
    'MANUAL',
    NULL,
    "createdAt"
FROM "Job";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "url";
