/**
 * lib/insight/service.ts
 *
 * Core insight service — orchestrates transcript dependency,
 * OpenAI chat completion, and persistence of user-specific
 * Insight Hyppado entries.
 *
 * Flow (SYNCHRONOUS — within one HTTP request):
 * 1. Check existing insight for this user + video
 * 2. Ensure transcript exists (generate if needed)
 * 3. Load admin-configured insight prompt template
 * 4. Call OpenAI Chat Completions with transcript + prompt
 * 5. Parse structured response → save VideoInsight
 *
 * Called by:
 * - POST /api/insights (synchronous pipeline)
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { getPromptConfigFromDB } from "@/lib/admin/config";
import { requestTranscript } from "@/lib/transcription/service";
import { getTranscript } from "@/lib/transcription/service";
import {
  generateInsight,
  isGenerateError,
  type InsightSections,
} from "./generate";
import type { InsightStatus, Prisma } from "@prisma/client";

const log = createLogger("insight/service");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InsightResult {
  videoExternalId: string;
  status: InsightStatus;
  contextText: string | null;
  hookText: string | null;
  problemText: string | null;
  solutionText: string | null;
  ctaText: string | null;
  copyWorkedText: string | null;
  errorMessage: string | null;
  tokensUsed: number;
  isNew: boolean;
}

export interface SavedInsight {
  videoExternalId: string;
  status: InsightStatus;
  contextText: string | null;
  hookText: string | null;
  problemText: string | null;
  solutionText: string | null;
  ctaText: string | null;
  copyWorkedText: string | null;
  errorMessage: string | null;
  createdAt: Date;
  readyAt: Date | null;
}

// ---------------------------------------------------------------------------
// Request insight (user-facing, synchronous)
// ---------------------------------------------------------------------------

/**
 * Requests an insight for a video for a specific user.
 *
 * 1. If user already has READY insight → return it (no regen)
 * 2. If FAILED → re-process
 * 3. Ensure transcript exists → generate from transcript
 * 4. Returns READY with sections, or FAILED with reason
 */
export async function requestInsight(
  videoExternalId: string,
  userId: string,
  videoTitle?: string,
  videoCreator?: string,
): Promise<InsightResult> {
  // Check existing insight for this user + video
  const existing = await prisma.videoInsight.findUnique({
    where: { userId_videoExternalId: { userId, videoExternalId } },
  });

  if (existing) {
    // If READY, return immediately
    if (existing.status === "READY") {
      return toResult(existing, false);
    }

    // If FAILED or PENDING, re-process
    if (existing.status === "FAILED" || existing.status === "PENDING") {
      return processInsightPipeline(
        existing.id,
        videoExternalId,
        userId,
        false,
        videoTitle,
        videoCreator,
      );
    }

    // If PROCESSING (unlikely in sync flow, but defensive)
    return toResult(existing, false);
  }

  // Create new record
  const insight = await prisma.videoInsight.create({
    data: {
      userId,
      videoExternalId,
      status: "PENDING",
    },
  });

  return processInsightPipeline(
    insight.id,
    videoExternalId,
    userId,
    true,
    videoTitle,
    videoCreator,
  );
}

// ---------------------------------------------------------------------------
// Get existing insight for a user + video
// ---------------------------------------------------------------------------

export async function getInsight(
  videoExternalId: string,
  userId: string,
): Promise<SavedInsight | null> {
  const row = await prisma.videoInsight.findUnique({
    where: { userId_videoExternalId: { userId, videoExternalId } },
    select: {
      videoExternalId: true,
      status: true,
      contextText: true,
      hookText: true,
      problemText: true,
      solutionText: true,
      ctaText: true,
      copyWorkedText: true,
      errorMessage: true,
      createdAt: true,
      readyAt: true,
    },
  });
  return row;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function processInsightPipeline(
  insightId: string,
  videoExternalId: string,
  userId: string,
  isNew: boolean,
  videoTitle?: string,
  videoCreator?: string,
): Promise<InsightResult> {
  // Mark as PROCESSING
  await prisma.videoInsight.update({
    where: { id: insightId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  // Step 1: Ensure transcript exists
  let transcriptText: string | null = null;

  const existingTranscript = await getTranscript(videoExternalId);
  if (
    existingTranscript?.status === "READY" &&
    existingTranscript.transcriptText
  ) {
    transcriptText = existingTranscript.transcriptText;
  } else {
    // Generate transcript (synchronous — same as POST /api/transcripts)
    log.info("Generating transcript for insight", { videoExternalId });
    const transcriptResult = await requestTranscript(videoExternalId, userId);
    if (
      transcriptResult.status !== "READY" ||
      !transcriptResult.transcriptText
    ) {
      return markFailed(
        insightId,
        videoExternalId,
        isNew,
        transcriptResult.errorMessage ||
          "Não foi possível transcrever o vídeo para gerar o insight",
      );
    }
    transcriptText = transcriptResult.transcriptText;
  }

  // Step 2: Load admin-configured prompt
  const promptConfig = await getPromptConfigFromDB();
  const template = promptConfig.insight.template;
  const settings = promptConfig.insight.settings;

  // Step 3: Build final prompt with variable substitution
  const finalPrompt = buildPrompt(template, {
    transcript_text: transcriptText,
    video_title: videoTitle || videoExternalId,
    video_creator: videoCreator || "",
  });

  // Step 4: Call OpenAI
  try {
    const result = await generateInsight(finalPrompt, settings);
    if (isGenerateError(result)) {
      return markFailed(insightId, videoExternalId, isNew, result.error);
    }

    // Step 5: Save structured result
    const updated = await prisma.videoInsight.update({
      where: { id: insightId },
      data: {
        status: "READY",
        contextText: result.sections.contexto,
        hookText: result.sections.gancho,
        problemText: result.sections.problema,
        solutionText: result.sections.solucao,
        ctaText: result.sections.cta,
        copyWorkedText: result.sections.copie_o_que_funcionou,
        rawResponseJson: result.rawResponse as Prisma.InputJsonValue,
        tokensUsed: result.tokensUsed,
        readyAt: new Date(),
        errorMessage: null,
      },
    });

    log.info("Insight ready", {
      videoExternalId,
      userId,
      tokensUsed: result.tokensUsed,
    });

    return toResult(updated, isNew);
  } catch (error) {
    log.error("Insight pipeline failed", {
      videoExternalId,
      userId,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return markFailed(
      insightId,
      videoExternalId,
      isNew,
      error instanceof Error
        ? error.message.slice(0, 500)
        : "Erro desconhecido",
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function markFailed(
  insightId: string,
  videoExternalId: string,
  isNew: boolean,
  errorMessage: string,
): Promise<InsightResult> {
  await prisma.videoInsight.update({
    where: { id: insightId },
    data: { status: "FAILED", errorMessage },
  });

  return {
    videoExternalId,
    status: "FAILED",
    contextText: null,
    hookText: null,
    problemText: null,
    solutionText: null,
    ctaText: null,
    copyWorkedText: null,
    errorMessage,
    tokensUsed: 0,
    isNew,
  };
}

function toResult(
  row: {
    videoExternalId: string;
    status: InsightStatus;
    contextText: string | null;
    hookText: string | null;
    problemText: string | null;
    solutionText: string | null;
    ctaText: string | null;
    copyWorkedText: string | null;
    errorMessage: string | null;
    tokensUsed?: number;
  },
  isNew: boolean,
): InsightResult {
  return {
    videoExternalId: row.videoExternalId,
    status: row.status,
    contextText: row.contextText,
    hookText: row.hookText,
    problemText: row.problemText,
    solutionText: row.solutionText,
    ctaText: row.ctaText,
    copyWorkedText: row.copyWorkedText,
    errorMessage: row.errorMessage,
    tokensUsed: row.tokensUsed ?? 0,
    isNew,
  };
}

/**
 * Substitutes {{variable_name}} placeholders in the template.
 */
function buildPrompt(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
