/**
 * app/api/transcripts/route.ts
 *
 * POST /api/transcripts — Request a transcript for a video.
 *
 * Body: { videoExternalId: string }
 *
 * Flow (SYNCHRONOUS — result returned in the same request):
 * 1. Auth check
 * 2. Quota check (TRANSCRIPT)
 * 3. If transcript already READY, return it (no quota consumed)
 * 4. Try Echotik captions → if unavailable, download video + Whisper
 * 5. Return READY with text, or FAILED
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { assertQuota, QuotaExceededError } from "@/lib/usage/enforce";
import { consumeUsage } from "@/lib/usage/consume";
import { requestTranscript } from "@/lib/transcription/service";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  let body: { videoExternalId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  const { videoExternalId } = body;
  if (!videoExternalId || typeof videoExternalId !== "string") {
    return NextResponse.json(
      { error: "videoExternalId é obrigatório" },
      { status: 400 },
    );
  }

  // Check quota before processing
  try {
    await assertQuota(auth.userId, "TRANSCRIPT");
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "Cota de transcrições excedida",
          used: error.used,
          limit: error.limit,
        },
        { status: 429 },
      );
    }
    throw error;
  }

  const result = await requestTranscript(videoExternalId, auth.userId);

  // Consume quota only for new transcript requests (not reuses)
  if (result.isNew) {
    await consumeUsage(auth.userId, "TRANSCRIPT", 0, {
      idempotencyKey: `transcript:${videoExternalId}:${auth.userId}`,
      refTable: "VideoTranscript",
      refId: videoExternalId,
    });
  }

  return NextResponse.json({
    videoExternalId: result.videoExternalId,
    status: result.status,
    transcriptText: result.transcriptText,
  });
}
