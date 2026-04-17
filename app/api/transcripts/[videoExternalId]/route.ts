/**
 * app/api/transcripts/[videoExternalId]/route.ts
 *
 * GET /api/transcripts/:videoExternalId — Get transcript status/content.
 *
 * Returns:
 * - 200 with transcript data if exists
 * - 404 if no transcript requested yet
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { getTranscript } from "@/lib/transcription/service";

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
    const transcript = await getTranscript(videoExternalId);

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcrição não encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      videoExternalId: transcript.videoExternalId,
      status: transcript.status,
      transcriptText: transcript.transcriptText,
      language: transcript.language,
      durationSeconds: transcript.durationSeconds,
      readyAt: transcript.readyAt?.toISOString() ?? null,
      createdAt: transcript.createdAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
