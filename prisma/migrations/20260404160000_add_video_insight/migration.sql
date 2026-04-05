-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "VideoInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoExternalId" TEXT NOT NULL,
    "status" "InsightStatus" NOT NULL DEFAULT 'PENDING',
    "contextText" TEXT,
    "hookText" TEXT,
    "problemText" TEXT,
    "solutionText" TEXT,
    "ctaText" TEXT,
    "copyWorkedText" TEXT,
    "rawResponseJson" JSONB,
    "promptVersion" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "VideoInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoInsight_userId_videoExternalId_key" ON "VideoInsight"("userId", "videoExternalId");

-- CreateIndex
CREATE INDEX "VideoInsight_userId_idx" ON "VideoInsight"("userId");

-- CreateIndex
CREATE INDEX "VideoInsight_videoExternalId_idx" ON "VideoInsight"("videoExternalId");

-- CreateIndex
CREATE INDEX "VideoInsight_status_idx" ON "VideoInsight"("status");

-- AddForeignKey
ALTER TABLE "VideoInsight" ADD CONSTRAINT "VideoInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
