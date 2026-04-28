/**
 * app/api/avatar-video/creations/[id]/generate-concept/route.ts
 *
 * POST /api/avatar-video/creations/:id/generate-concept
 *
 * Generates a structured video concept (hook, copy, CTA, scenes) for an avatar
 * video creation using product data + reference images.
 *
 * This is Stage 1 of a two-stage AI generation flow:
 *   Stage 1: generate-concept  — hook, copy, CTA, scenes (this route)
 *   Stage 2: generate-prompt   — VEO 3 per-take prompts using the approved concept
 *
 * Allowed statuses:
 *   - IMAGES_READY  → first concept generation
 *   - CONCEPT_READY → regeneration (replaces the existing concept)
 *
 * Flow (synchronous — result returned in the same request):
 * 1. Auth check
 * 2. Call startConceptGeneration(userId, creationId)
 *    - Validates state and that at least one image variation is READY
 *    - Loads admin-configurable system prompt template from DB settings
 *    - Calls OpenAI Chat Completions with full creation context
 *    - Persists structured concept (videoIdea, hook, copy, cta, scenesJson)
 *    - Transitions creation to CONCEPT_READY (or FAILED)
 * 3. Return updated creation DTO (includes concept)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { startConceptGeneration } from "@/lib/avatar-video/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;

  try {
    const result = await startConceptGeneration(auth.userId, creationId);

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        forbidden: 403,
        quota_exceeded: 429,
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
