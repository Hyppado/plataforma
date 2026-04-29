/**
 * app/api/admin/avatar-video/scenarios/[id]/route.ts
 *
 * PATCH  — update a scenario
 * DELETE — delete (or deactivate if in use)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import {
  deleteOrDeactivateScenario,
  updateScenario,
} from "@/lib/avatar-video/admin";

const log = createLogger("api/admin/avatar-video/scenarios/[id]");

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const patch: Parameters<typeof updateScenario>[1] = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (body.description === null || typeof body.description === "string")
      patch.description = body.description as string | null;
    if (body.promptHint === null || typeof body.promptHint === "string")
      patch.promptHint = body.promptHint as string | null;
    if (typeof body.isDefault === "boolean") patch.isDefault = body.isDefault;
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
    if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

    if (patch.name !== undefined && !patch.name.trim()) {
      return NextResponse.json(
        { error: "name não pode ser vazio" },
        { status: 400 },
      );
    }

    const scenario = await updateScenario(params.id, patch);
    return NextResponse.json({ scenario });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to update scenario", { id: params.id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const result = await deleteOrDeactivateScenario(params.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to delete scenario", { id: params.id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
