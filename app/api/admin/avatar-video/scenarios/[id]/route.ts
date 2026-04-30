/**
 * app/api/admin/avatar-video/scenarios/[id]/route.ts
 *
 * PATCH  — update a scenario
 * DELETE — hard-delete the scenario (FK to AvatarVideoCreation uses onDelete: SetNull)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

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

    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name)
        return NextResponse.json(
          { error: "name não pode ser vazio" },
          { status: 400 },
        );
      patch.name = name;
    }
    if (body.description === null || typeof body.description === "string")
      patch.description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;
    if (body.promptHint === null || typeof body.promptHint === "string")
      patch.promptHint =
        typeof body.promptHint === "string"
          ? body.promptHint.trim() || null
          : null;
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
    if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
    if (typeof body.isDefault === "boolean") patch.isDefault = body.isDefault;

    const scenario = await prisma.$transaction(async (tx) => {
      if (patch.isDefault === true) {
        await tx.videoScenario.updateMany({
          where: { isDefault: true, id: { not: params.id } },
          data: { isDefault: false },
        });
      }
      return tx.videoScenario.update({
        where: { id: params.id },
        data: patch,
      });
    });

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
    await prisma.videoScenario.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to delete scenario", { id: params.id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
