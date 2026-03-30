/**
 * app/api/admin/echotik/health/route.ts
 *
 * GET — returns Echotik operational health (staleness, failures, status per task × region)
 */

import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getEchotikHealth } from "@/lib/echotik/admin/health";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/admin/echotik/health");

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const health = await getEchotikHealth();
    return NextResponse.json(health);
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load Echotik health" },
      { status: 500 },
    );
  }
}
