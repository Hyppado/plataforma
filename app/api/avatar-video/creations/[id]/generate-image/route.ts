/**
 * app/api/avatar-video/creations/[id]/generate-image/route.ts
 *
 * POST /api/avatar-video/creations/:id/generate-image
 *
 * Starts (or restarts) image generation for an avatar video creation.
 *
 * Allowed statuses:
 *   - DRAFT        → first generation (quota enforced)
 *   - IMAGES_READY → regeneration (quota enforced again)
 *   - FAILED       → retry after a failed generation (quota enforced again)
 *
 * Flow (synchronous — result returned in the same request):
 * 1. Auth check
 * 2. Call startImageGeneration(userId, creationId)
 *    - Validates state and product selection
 *    - Enforces avatar-video quota
 *    - Generates 2 Google AI (Gemini) image variations (uploaded to Vercel Blob)
 *    - Transitions creation to IMAGES_READY (or FAILED)
 *    - Consumes quota on success
 * 3. Return updated creation DTO
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { startImageGeneration } from "@/lib/avatar-video/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;

  try {
    const result = await startImageGeneration(auth.userId, creationId);

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
