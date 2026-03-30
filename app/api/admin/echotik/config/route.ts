/**
 * app/api/admin/echotik/config/route.ts
 *
 * GET  — returns current Echotik config + active region list
 * PUT  — updates Echotik config (partial patch supported)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import {
  getEchotikConfig,
  saveEchotikConfig,
  validateEchotikConfigPatch,
} from "@/lib/echotik/cron/config";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/admin/echotik/config");

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const [config, regions] = await Promise.all([
      getEchotikConfig(),
      prisma.region.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

    return NextResponse.json({ config, regions });
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load Echotik config" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await req.json();

    const validationErrors = validateEchotikConfigPatch(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 },
      );
    }

    await saveEchotikConfig(body);

    const updated = await getEchotikConfig();
    log.info("Echotik config updated", { updatedBy: auth.userId });

    return NextResponse.json({ config: updated });
  } catch (error) {
    log.error("PUT failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to save Echotik config" },
      { status: 500 },
    );
  }
}
