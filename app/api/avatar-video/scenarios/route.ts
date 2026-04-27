/**
 * app/api/avatar-video/scenarios/route.ts
 *
 * GET /api/avatar-video/scenarios
 *
 * Returns the list of active video scenario templates available for selection.
 * Ordered by isDefault desc, then sortOrder asc — default scenarios appear first.
 *
 * Response: { scenarios: VideoScenarioDTO[] }
 *
 * Security:
 *   - Requires authenticated user (not admin — any subscriber can read).
 *   - Only public fields are exposed; promptHint is included as it
 *     helps users understand what the scenario generates.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/avatar-video/scenarios");

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const scenarios = await prisma.videoScenario.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        promptHint: true,
        isDefault: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ scenarios });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    log.error("Failed to list video scenarios", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
