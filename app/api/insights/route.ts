/**
 * app/api/insights/route.ts
 *
 * POST /api/insights — Request an Insight Hyppado for a video.
 *
 * Body: { videoExternalId: string, videoTitle?: string, videoCreator?: string }
 *
 * Flow (SYNCHRONOUS — result returned in the same request):
 * 1. Auth check
 * 2. Quota check (INSIGHT)
 * 3. If user already has READY insight → return it (no quota consumed)
 * 4. Ensure transcript exists → generate insight from transcript
 * 5. Consume quota with actual tokens used
 * 6. Return READY with sections, or FAILED with reason
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { assertQuota, QuotaExceededError } from "@/lib/usage/enforce";
import { consumeUsage } from "@/lib/usage/consume";
import { requestInsight } from "@/lib/insight";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  let body: {
    videoExternalId?: string;
    videoTitle?: string;
    videoCreator?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  const { videoExternalId, videoTitle, videoCreator } = body;
  if (!videoExternalId || typeof videoExternalId !== "string") {
    return NextResponse.json(
      { error: "videoExternalId é obrigatório" },
      { status: 400 },
    );
  }

  // Check quota before processing
  try {
    await assertQuota(auth.userId, "INSIGHT");
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "Cota de insights excedida",
          used: error.used,
          limit: error.limit,
        },
        { status: 429 },
      );
    }
    throw error;
  }

  const result = await requestInsight(
    videoExternalId,
    auth.userId,
    videoTitle,
    videoCreator,
  );

  // Consume quota only for new insights (not reuses of existing)
  if (result.isNew && result.status === "READY" && result.tokensUsed > 0) {
    await consumeUsage(auth.userId, "INSIGHT", result.tokensUsed, {
      idempotencyKey: `insight:${videoExternalId}:${auth.userId}`,
      refTable: "VideoInsight",
      refId: videoExternalId,
    });
  }

  return NextResponse.json({
    videoExternalId: result.videoExternalId,
    status: result.status,
    contextText: result.contextText,
    hookText: result.hookText,
    problemText: result.problemText,
    solutionText: result.solutionText,
    ctaText: result.ctaText,
    copyWorkedText: result.copyWorkedText,
    errorMessage: result.errorMessage,
    tokensUsed: result.tokensUsed,
  });
}
