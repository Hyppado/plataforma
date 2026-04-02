-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "VideoTranscript" (
    "id" TEXT NOT NULL,
    "videoExternalId" TEXT NOT NULL,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'openai',
    "language" TEXT,
    "transcriptText" TEXT,
    "segmentsJson" JSONB,
    "durationSeconds" INTEGER,
    "requestedByUserId" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readyAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),

    CONSTRAINT "VideoTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoTranscript_videoExternalId_key" ON "VideoTranscript"("videoExternalId");

-- CreateIndex
CREATE INDEX "VideoTranscript_status_idx" ON "VideoTranscript"("status");

-- CreateIndex
CREATE INDEX "VideoTranscript_status_createdAt_idx" ON "VideoTranscript"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VideoTranscript_createdAt_idx" ON "VideoTranscript"("createdAt");
