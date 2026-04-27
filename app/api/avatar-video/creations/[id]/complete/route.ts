/**
 * app/api/avatar-video/creations/[id]/complete/route.ts
 *
 * POST /api/avatar-video/creations/:id/complete
 *
 * Marks the creation as COMPLETED — the user has finished the wizard.
 * Allowed only when status is PROMPT_READY.
 *
 * Response: { creation: CreationDTO }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { completeCreation } from "@/lib/avatar-video/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;

  try {
    const result = await completeCreation(auth.userId, creationId);

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
