/**
 * app/api/admin/avatar-video/scenarios/route.ts
 *
 * GET  — list all video scenarios (active and inactive)
 * POST — create a scenario
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { createScenario, listAllScenarios } from "@/lib/avatar-video/admin";

const log = createLogger("api/admin/avatar-video/scenarios");

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const scenarios = await listAllScenarios();
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

    const scenario = await createScenario({
      name,
      description:
        typeof body.description === "string" ? body.description : null,
      promptHint: typeof body.promptHint === "string" ? body.promptHint : null,
      isDefault:
        typeof body.isDefault === "boolean" ? body.isDefault : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      sortOrder:
        typeof body.sortOrder === "number" ? body.sortOrder : undefined,
    });

    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to create scenario", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
