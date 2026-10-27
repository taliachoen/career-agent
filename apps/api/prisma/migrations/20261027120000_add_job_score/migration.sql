-- CreateTable
CREATE TABLE "JobScore" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "matches" TEXT[],
    "gaps" TEXT[],
    "model" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobScore_jobId_key" ON "JobScore"("jobId");

-- CreateIndex
CREATE INDEX "JobScore_userId_idx" ON "JobScore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "JobScore_jobId_userId_key" ON "JobScore"("jobId", "userId");

-- AddForeignKey
ALTER TABLE "JobScore" ADD CONSTRAINT "JobScore_jobId_userId_fkey" FOREIGN KEY ("jobId", "userId") REFERENCES "Job"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

