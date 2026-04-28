/**
 * app/api/avatar-video/creations/[id]/edit-concept/route.ts
 *
 * PATCH /api/avatar-video/creations/:id/edit-concept
 *
 * Persists user-edited concept fields to the AvatarVideoConcept row.
 * Allowed only when status is CONCEPT_READY.
 *
 * Body: { videoIdea: string, hook: string, copy: string, cta: string,
 *         scenes: Array<{ sceneNumber: number, goal: string, description: string }> }
 *
 * Response: { creation: CreationDTO }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { saveEditedConcept } from "@/lib/avatar-video/service";
import type { ConceptScene } from "@/lib/avatar-video/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido no corpo da requisição." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (
    typeof b.videoIdea !== "string" ||
    typeof b.hook !== "string" ||
    typeof b.copy !== "string" ||
    typeof b.cta !== "string" ||
    !Array.isArray(b.scenes)
  ) {
    return NextResponse.json(
      {
        error:
          "Campos obrigatórios: videoIdea, hook, copy, cta (string) e scenes (array).",
      },
      { status: 400 },
    );
  }

  const scenes = b.scenes as ConceptScene[];

  try {
    const result = await saveEditedConcept(auth.userId, creationId, {
      videoIdea: b.videoIdea as string,
      hook: b.hook as string,
      copy: b.copy as string,
      cta: b.cta as string,
      scenes,
    });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        forbidden: 403,
        invalid_state: 409,
        internal: 500,
      };
      const status = statusMap[result.code] ?? 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ creation: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
