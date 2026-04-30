/**
 * app/api/admin/avatar-video/scenarios/route.ts
 *
 * GET  — list all scenarios (active and inactive)
 * POST — create a new scenario
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/admin/avatar-video/scenarios");

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const scenarios = await prisma.videoScenario.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ scenarios });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to list scenarios", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "name é obrigatório" },
        { status: 400 },
      );
    }

    const isDefault =
      typeof body.isDefault === "boolean" ? body.isDefault : false;

    const scenario = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.videoScenario.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.videoScenario.create({
        data: {
          name,
          description:
            typeof body.description === "string"
              ? body.description.trim() || null
              : null,
          promptHint:
            typeof body.promptHint === "string"
              ? body.promptHint.trim() || null
              : null,
          isDefault,
          isActive: typeof body.isActive === "boolean" ? body.isActive : true,
          sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
        },
      });
    });

    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to create scenario", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
