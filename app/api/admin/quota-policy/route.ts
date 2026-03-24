import { NextResponse } from "next/server";
import type { QuotaPolicy } from "@/lib/types/admin";
import { requireAdmin, isAuthed } from "@/lib/auth";

/**
 * GET /api/admin/quota-policy
 * Returns quota policy defaults.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  // Always return default policy (localStorage override happens client-side)
  const defaultPolicy: QuotaPolicy = {
    transcriptsPerMonth: 40,
    scriptsPerMonth: 70,
    insightTokensPerMonth: 50_000,
    scriptTokensPerMonth: 20_000,
    insightMaxOutputTokens: 800,
    scriptMaxOutputTokens: 1500,
  };

  return NextResponse.json(defaultPolicy);
}
