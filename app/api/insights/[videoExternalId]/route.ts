/**
 * app/api/insights/[videoExternalId]/route.ts
 *
 * GET /api/insights/:videoExternalId — Get insight status/content for the
 * authenticated user.
 *
 * Returns:
 * - 200 with insight data if exists
 * - 404 if no insight requested yet
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { getInsight } from "@/lib/insight";

export async function GET(
  _req: NextRequest,
  { params }: { params: { videoExternalId: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { videoExternalId } = params;
  if (!videoExternalId) {
    return NextResponse.json(
      { error: "videoExternalId é obrigatório" },
      { status: 400 },
    );
  }

  try {
    const insight = await getInsight(videoExternalId, auth.userId);

    if (!insight) {
      return NextResponse.json(
        { error: "Insight não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      videoExternalId: insight.videoExternalId,
      status: insight.status,
      contextText: insight.contextText,
      hookText: insight.hookText,
      problemText: insight.problemText,
      solutionText: insight.solutionText,
      ctaText: insight.ctaText,
      copyWorkedText: insight.copyWorkedText,
      errorMessage: insight.errorMessage,
      createdAt: insight.createdAt.toISOString(),
      readyAt: insight.readyAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
