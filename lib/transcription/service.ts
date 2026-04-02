/**
 * lib/transcription/service.ts
 *
 * Core transcription service — coordinates caption retrieval,
 * Whisper fallback, and database persistence.
 *
 * Strategies (in order):
 * 1. Echotik captions API (free, instant) → extract subtitle text
 * 2. OpenAI Whisper (paid, async) → full transcription from audio
 *
 * The service is called by:
 * - POST /api/transcripts (creates PENDING record, tries captions immediately)
 * - POST /api/cron/transcribe (processes PENDING/FAILED records via Whisper)
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { TranscriptStatus } from "@prisma/client";
import { getVideoCaptions } from "./media";

const log = createLogger("transcription/service");

// ---------------------------------------------------------------------------
// Request a transcript (user-facing)
// ---------------------------------------------------------------------------

export interface RequestTranscriptResult {
  videoExternalId: string;
  status: TranscriptStatus;
  transcriptText: string | null;
  isNew: boolean;
}

/**
 * Requests a transcript for a video.
 * - If already exists, returns the existing record (global/shared per video).
 * - If new, creates a PENDING record and tries Echotik captions immediately.
 * - If captions succeed, sets READY immediately (no cron needed).
 * - If captions fail, leaves as PENDING for the cron to process via Whisper.
 */
export async function requestTranscript(
  videoExternalId: string,
  userId: string,
): Promise<RequestTranscriptResult> {
  // Check for existing transcript (global reuse)
  const existing = await prisma.videoTranscript.findUnique({
    where: { videoExternalId },
  });

  if (existing) {
    return {
      videoExternalId: existing.videoExternalId,
      status: existing.status,
      transcriptText: existing.transcriptText,
      isNew: false,
    };
  }

  // Create PENDING record
  const transcript = await prisma.videoTranscript.create({
    data: {
      videoExternalId,
      status: "PENDING",
      requestedByUserId: userId,
    },
  });

  // Try Echotik captions immediately (fast, free)
  try {
    const captions = await getVideoCaptions(videoExternalId);
    if (captions?.text) {
      const updated = await prisma.videoTranscript.update({
        where: { id: transcript.id },
        data: {
          status: "READY",
          transcriptText: captions.text,
          language: captions.language,
          source: "echotik_captions",
          readyAt: new Date(),
        },
      });

      log.info("Transcript ready via captions", {
        videoExternalId,
        language: captions.language,
        textLength: captions.text.length,
      });

      return {
        videoExternalId: updated.videoExternalId,
        status: updated.status,
        transcriptText: updated.transcriptText,
        isNew: true,
      };
    }
  } catch (error) {
    log.error("Caption retrieval failed, leaving PENDING for cron", {
      videoExternalId,
      error: error instanceof Error ? error.message : "Unknown",
    });
  }

  // Captions not available — stay PENDING for cron/Whisper
  return {
    videoExternalId: transcript.videoExternalId,
    status: transcript.status,
    transcriptText: null,
    isNew: true,
  };
}

// ---------------------------------------------------------------------------
// Get transcript status
// ---------------------------------------------------------------------------

export interface TranscriptInfo {
  videoExternalId: string;
  status: TranscriptStatus;
  transcriptText: string | null;
  language: string | null;
  durationSeconds: number | null;
  readyAt: Date | null;
  createdAt: Date;
}

/**
 * Returns the current transcript for a video, or null if none exists.
 */
export async function getTranscript(
  videoExternalId: string,
): Promise<TranscriptInfo | null> {
  const row = await prisma.videoTranscript.findUnique({
    where: { videoExternalId },
    select: {
      videoExternalId: true,
      status: true,
      transcriptText: true,
      language: true,
      durationSeconds: true,
      readyAt: true,
      createdAt: true,
    },
  });

  return row;
}

// ---------------------------------------------------------------------------
// Cron: process pending transcripts
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BATCH_SIZE = 5;

/**
 * Picks PENDING transcripts and processes them.
 * Called by the cron route. Returns count of processed items.
 *
 * For now, if Echotik captions failed at request time, we re-try captions
 * and if still unavailable, mark as FAILED (Whisper requires audio download
 * which will be added when Echotik provides video URLs).
 */
export async function processPendingTranscripts(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const stats = { processed: 0, succeeded: 0, failed: 0 };

  // Pick a batch of PENDING transcripts (oldest first)
  const pending = await prisma.videoTranscript.findMany({
    where: {
      status: { in: ["PENDING"] },
      retryCount: { lt: MAX_RETRIES },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return stats;
  }

  log.info("Processing pending transcripts", { count: pending.length });

  for (const transcript of pending) {
    stats.processed++;

    // Mark as PROCESSING
    await prisma.videoTranscript.update({
      where: { id: transcript.id },
      data: { status: "PROCESSING", processingAt: new Date() },
    });

    try {
      // Retry Echotik captions
      const captions = await getVideoCaptions(transcript.videoExternalId);

      if (captions?.text) {
        await prisma.videoTranscript.update({
          where: { id: transcript.id },
          data: {
            status: "READY",
            transcriptText: captions.text,
            language: captions.language,
            source: "echotik_captions",
            readyAt: new Date(),
          },
        });
        stats.succeeded++;
        log.info("Cron: transcript ready via captions", {
          videoExternalId: transcript.videoExternalId,
        });
        continue;
      }

      // No captions available — increment retry and mark FAILED if max retries
      const newRetry = transcript.retryCount + 1;
      const nextStatus: TranscriptStatus =
        newRetry >= MAX_RETRIES ? "FAILED" : "PENDING";

      await prisma.videoTranscript.update({
        where: { id: transcript.id },
        data: {
          status: nextStatus,
          retryCount: newRetry,
          errorMessage:
            nextStatus === "FAILED"
              ? "Captions not available after maximum retries"
              : null,
        },
      });

      if (nextStatus === "FAILED") {
        stats.failed++;
        log.info("Cron: transcript marked FAILED after retries", {
          videoExternalId: transcript.videoExternalId,
          retries: newRetry,
        });
      }
    } catch (error) {
      // Processing error — increment retry count
      const newRetry = transcript.retryCount + 1;
      await prisma.videoTranscript.update({
        where: { id: transcript.id },
        data: {
          status: newRetry >= MAX_RETRIES ? "FAILED" : "PENDING",
          retryCount: newRetry,
          errorMessage:
            error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
        },
      });
      stats.failed++;
      log.error("Cron: transcript processing error", {
        videoExternalId: transcript.videoExternalId,
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  }

  log.info("Cron processing complete", stats);
  return stats;
}
