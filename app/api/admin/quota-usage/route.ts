import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPeriodBounds } from "@/lib/usage/period";
import type { QuotaUsage } from "@/lib/types/admin";

/**
 * GET /api/admin/quota-usage?userId=<id>
 *
 * Returns the real UsagePeriod counters for the current billing month.
 * When no userId is provided, returns aggregate totals across all users.
 */
export async function GET(req: NextRequest) {
  const { start, end } = getPeriodBounds();
  const userId = req.nextUrl.searchParams.get("userId");

  if (userId) {
    // Single-user lookup
    const period = await prisma.usagePeriod.findUnique({
      where: { userId_periodStart: { userId, periodStart: start } },
    });

    const usage: QuotaUsage = {
      transcriptsUsed: period?.transcriptsUsed ?? null,
      scriptsUsed: period?.scriptsUsed ?? null,
      insightTokensUsed: period?.tokensUsed ?? null,
      scriptTokensUsed: null, // tracked together in tokensUsed for now
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      lastUpdatedAt: period?.updatedAt.toISOString() ?? null,
    };

    return NextResponse.json(usage);
  }

  // Aggregate across all users for the current period
  const agg = await prisma.usagePeriod.aggregate({
    where: { periodStart: start },
    _sum: {
      transcriptsUsed: true,
      scriptsUsed: true,
      tokensUsed: true,
    },
    _max: { updatedAt: true },
  });

  const usage: QuotaUsage = {
    transcriptsUsed: agg._sum.transcriptsUsed ?? null,
    scriptsUsed: agg._sum.scriptsUsed ?? null,
    insightTokensUsed: agg._sum.tokensUsed ?? null,
    scriptTokensUsed: null,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    lastUpdatedAt: agg._max.updatedAt?.toISOString() ?? null,
  };

  return NextResponse.json(usage);
}
