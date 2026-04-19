/**
 * GET /api/public/support-email
 *
 * Returns the configured support email for public pages (no auth required).
 * Used by the login page and other unauthenticated views.
 */

import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const DEFAULT = "suporte@hyppado.com";

export async function GET() {
  try {
    const value = (await getSetting("support.email")) ?? DEFAULT;
    return NextResponse.json({ email: value });
  } catch {
    return NextResponse.json({ email: DEFAULT });
  }
}
