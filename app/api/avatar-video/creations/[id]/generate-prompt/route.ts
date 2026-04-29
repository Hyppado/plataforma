/**
 * app/api/avatar-video/creations/[id]/generate-prompt/route.ts
 *
 * POST /api/avatar-video/creations/:id/generate-prompt
 *
 * Generates the structured VEO 3 JSON prompt for an avatar video creation.
 *
 * Allowed statuses:
 *   - CONCEPT_READY → first prompt generation (concept must exist and be READY)
 *   - PROMPT_READY  → regeneration (replaces the existing prompt)
 *
 * Flow (synchronous — result returned in the same request):
 * 1. Auth check
 * 2. Call startPromptGeneration(userId, creationId)
 *    - Validates state and that at least one image variation is READY
 *    - Loads admin-configurable system prompt template from DB settings
 *    - Calls OpenAI Chat Completions with full creation context
 *    - Persists structured JSON (with takes, camera/visual direction, spoken lines)
 *    - Transitions creation to PROMPT_READY (or FAILED)
 * 3. Return updated creation DTO (includes prompt with promptJson / promptText)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { startPromptGeneration } from "@/lib/avatar-video/service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;

  let requestedTakeCount: number | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      takeCount?: unknown;
    };
    if (
      typeof body.takeCount === "number" &&
      body.takeCount >= 1 &&
      body.takeCount <= 12
    ) {
      requestedTakeCount = Math.round(body.takeCount);
    }
  } catch {
    // no body — use creation's existing takeCount
  }

  try {
    const result = await startPromptGeneration(
      auth.userId,
      creationId,
      requestedTakeCount,
    );

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
