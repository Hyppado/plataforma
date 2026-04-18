/**
 * GET /api/support-email
 *
 * Returns the configured support email for authenticated users.
 * Used by the /dashboard/suporte page.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const DEFAULT = "suporte@hyppado.com";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!isAuthed(auth)) return auth;

    const value = (await getSetting("support.email")) ?? DEFAULT;
    return NextResponse.json({ email: value });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
