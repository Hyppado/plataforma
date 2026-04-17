/**
 * app/api/usage/route.ts
 *
 * GET /api/usage — Returns the authenticated user's quota usage and plan limits.
 *
 * Sources:
 *   - Usage counters: UsagePeriod for the current billing month
 *   - Limits: Plan resolved via getUserActivePlan (AccessGrant → Subscription → null)
 *
 * This is the user-facing endpoint — unlike /api/admin/quota-usage, it
 * returns data scoped to the authenticated user and includes plan-based limits.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { getUserActivePlan, getQuotaLimits } from "@/lib/usage/quota";
import { getCurrentUsagePeriod, getPeriodBounds } from "@/lib/usage/period";

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const [plan, period] = await Promise.all([
      getUserActivePlan(auth.userId),
      getCurrentUsagePeriod(auth.userId),
    ]);

    const limits = getQuotaLimits(plan);
    const { start, end } = getPeriodBounds();

    return NextResponse.json({
      transcriptsUsed: period?.transcriptsUsed ?? 0,
      scriptsUsed: period?.scriptsUsed ?? 0,
      insightsUsed: period?.insightsUsed ?? 0,
      transcriptsLimit: limits.transcriptsPerMonth,
      scriptsLimit: limits.scriptsPerMonth,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
