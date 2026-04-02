/**
 * lib/transcription/service.ts
 *
 * Core transcription service — coordinates caption retrieval,
 * video download + Whisper fallback, and database persistence.
 *
 * The flow is SYNCHRONOUS — user clicks "Transcribe", and within the
 * same HTTP request they get the result (READY or FAILED). No more
 * "volte em alguns minutos" dead-end.
 *
 * Strategies (in order, all within one request):
 * 1. Echotik captions API (free, ~3s) → extract subtitle text
 * 2. Echotik download-url → download video → OpenAI Whisper (~15-20s)
 *
 * The cron only retries previously FAILED transcripts.
 *
 * Called by:
 * - POST /api/transcripts (synchronous pipeline)
 * - GET /api/cron/transcribe (retry FAILED records)
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { TranscriptStatus, Prisma } from "@prisma/client";
import { getVideoCaptions, getVideoDownloadUrl, downloadVideoBuffer } from "./media";
import { transcribeWithWhisper, isWhisperError } from "./whisper";

const log = createLogger("transcription/service");

// ---------------------------------------------------------------------------
// Request a transcript (user-facing, synchronous)
// ---------------------------------------------------------------------------

export interface RequestTranscriptResult {
  videoExternalId: string;
  status: TranscriptStatus;
  transcriptText: string | null;
  errorMessage: string | null;
  isNew: boolean;
}

/**
 * Requests a transcript for a video — fully synchronous.
 *
 * 1. If already exists and READY → return immediately (shared/global)
 * 2. If already exists and FAILED → re-process via full pipeline
 * 3. Create DB record → try captions → if no captions → download + Whisper
 * 4. Returns READY with text, or FAILED with reason
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
    // If READY, return immediately — no quota consumed
    if (existing.status === "READY" && existing.transcriptText) {
      return {
        videoExternalId: existing.videoExternalId,
        status: existing.status,
        transcriptText: existing.transcriptText,
        errorMessage: null,
        isNew: false,
      };
    }

    // If FAILED or still stuck, re-process via full pipeline
    if (existing.status === "FAILED" || existing.status === "PENDING") {
      return processTranscriptPipeline(existing.id, videoExternalId, true);
    }

    // If PROCESSING (unlikely in sync flow, but defensive)
    return {
      videoExternalId: existing.videoExternalId,
      status: existing.status,
      transcriptText: existing.transcriptText,
      errorMessage: existing.errorMessage ?? null,
      isNew: false,
    };
  }

  // Create new record
  const transcript = await prisma.videoTranscript.create({
    data: {
      videoExternalId,
      status: "PENDING",
      requestedByUserId: userId,
    },
  });

  return processTranscriptPipeline(transcript.id, videoExternalId, true);
}

// ---------------------------------------------------------------------------
// Full transcription pipeline (captions → download + Whisper)
// ---------------------------------------------------------------------------

/**
 * Runs the full transcription pipeline synchronously.
 * 1. Mark PROCESSING
 * 2. Try Echotik captions (fast, free)
 * 3. If no captions → get download URL → download video → Whisper
 * 4. Update DB with result (READY or FAILED)
 */
async function processTranscriptPipeline(
  transcriptId: string,
  videoExternalId: string,
  isNew: boolean,
): Promise<RequestTranscriptResult> {
  // Mark as PROCESSING
  await prisma.videoTranscript.update({
    where: { id: transcriptId },
    data: { status: "PROCESSING", processingAt: new Date(), errorMessage: null },
  });

  // Step 1: Try Echotik captions (fast, free)
  try {
    const captions = await getVideoCaptions(videoExternalId);
    if (captions?.text) {
      const updated = await prisma.videoTranscript.update({
        where: { id: transcriptId },
        data: {
          status: "READY",
          transcriptText: captions.text,
          language: captions.language,
          source: "echotik_captions",
          readyAt: new Date(),
          errorMessage: null,
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
        errorMessage: null,
        isNew,
      };
    }
  } catch (error) {
    log.error("Caption retrieval failed, trying Whisper fallback", {
      videoExternalId,
      error: error instanceof Error ? error.message : "Unknown",
    });
  }

  // Step 2: Download video + Whisper fallback
  try {
    const urls = await getVideoDownloadUrl(videoExternalId);
    if (!urls) {
      return markFailed(transcriptId, videoExternalId, isNew, "Video download URL not available");
    }

    const videoBuffer = await downloadVideoBuffer(urls);
    if (!videoBuffer) {
      return markFailed(transcriptId, videoExternalId, isNew, "Video download failed or file too large");
    }

    const whisperResult = await transcribeWithWhisper(videoBuffer, `${videoExternalId}.mp4`);
    if (isWhisperError(whisperResult)) {
      return markFailed(transcriptId, videoExternalId, isNew, whisperResult.error);
    }
    if (!whisperResult.text) {
      return markFailed(transcriptId, videoExternalId, isNew, "Whisper transcription returned no text");
    }

    const updated = await prisma.videoTranscript.update({
      where: { id: transcriptId },
      data: {
        status: "READY",
        transcriptText: whisperResult.text,
        language: whisperResult.language,
        durationSeconds: whisperResult.duration ? Math.round(whisperResult.duration) : null,
        source: "openai_whisper",
        segmentsJson: whisperResult.segments.length > 0
          ? (whisperResult.segments as unknown as Prisma.InputJsonValue)
          : undefined,
        readyAt: new Date(),
        errorMessage: null,
      },
    });

    log.info("Transcript ready via Whisper", {
      videoExternalId,
      language: whisperResult.language,
      duration: whisperResult.duration,
      textLength: whisperResult.text.length,
    });

    return {
      videoExternalId: updated.videoExternalId,
      status: updated.status,
      transcriptText: updated.transcriptText,
      errorMessage: null,
      isNew,
    };
  } catch (error) {
    log.error("Whisper pipeline failed", {
      videoExternalId,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return markFailed(
      transcriptId,
      videoExternalId,
      isNew,
      error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
    );
  }
}

/**
 * Marks a transcript as FAILED with an error message.
 */
async function markFailed(
  transcriptId: string,
  videoExternalId: string,
  isNew: boolean,
  errorMessage: string,
): Promise<RequestTranscriptResult> {
  await prisma.videoTranscript.update({
    where: { id: transcriptId },
    data: {
      status: "FAILED",
      errorMessage,
      retryCount: { increment: 1 },
    },
  });

  log.info("Transcript marked FAILED", { videoExternalId, errorMessage });

  return {
    videoExternalId,
    status: "FAILED",
    transcriptText: null,
    errorMessage,
    isNew,
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
// Cron: retry FAILED transcripts
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BATCH_SIZE = 5;

/**
 * Picks FAILED transcripts (below retry limit) and re-processes them
 * through the full pipeline (captions → download → Whisper).
 *
 * Called by the cron route. Returns count of processed items.
 */
export async function processPendingTranscripts(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const stats = { processed: 0, succeeded: 0, failed: 0 };

  // Pick a batch of FAILED transcripts that can be retried
  const pending = await prisma.videoTranscript.findMany({
    where: {
      status: { in: ["FAILED", "PENDING"] },
      retryCount: { lt: MAX_RETRIES },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return stats;
  }

  log.info("Cron: retrying failed transcripts", { count: pending.length });

  for (const transcript of pending) {
    stats.processed++;

    try {
      const result = await processTranscriptPipeline(
        transcript.id,
        transcript.videoExternalId,
        false,
      );

      if (result.status === "READY") {
        stats.succeeded++;
      } else {
        stats.failed++;
      }
    } catch (error) {
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
