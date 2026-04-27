/**
 * app/api/avatar-video/creations/[id]/select-variation/route.ts
 *
 * PATCH /api/avatar-video/creations/:id/select-variation
 *
 * Records which image variation the user prefers.
 * Only allowed when creation status is IMAGES_READY.
 *
 * Body: { variationId: string | null }
 *   - string: select this variation
 *   - null: clear selection
 *
 * Returns: { creation: CreationDTO }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { selectImageVariation } from "@/lib/avatar-video/service";

const log = createLogger("api/avatar-video/creations/[id]/select-variation");

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;
  if (!creationId || typeof creationId !== "string") {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  const { variationId } = body as Record<string, unknown>;

  if (variationId !== null && typeof variationId !== "string") {
    return NextResponse.json(
      { error: "variationId deve ser string ou null" },
      { status: 400 },
    );
  }

  try {
    const result = await selectImageVariation(
      auth.userId,
      creationId,
      variationId as string | null,
    );

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
    log.error("Unexpected error in PATCH select-variation", {
      userId: auth.userId,
      creationId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
