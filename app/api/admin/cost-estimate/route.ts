/**
 * app/api/admin/cost-estimate/route.ts
 *
 * GET /api/admin/cost-estimate
 *
 * Returns active plans with quota fields and the current USD→BRL exchange rate.
 * Used by the "Custos" admin tab to calculate estimated AI costs per plan.
 *
 * Requires ADMIN role.
 */

import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStoredUsdRate } from "@/lib/exchange/fetchRate";

const log = createLogger("api/admin/cost-estimate");

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const [plans, ratePayload] = await Promise.all([
      prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          priceAmount: true,
          displayPrice: true,
          periodicity: true,
          transcriptsPerMonth: true,
          scriptsPerMonth: true,
          insightTokensMonthlyMax: true,
          insightMaxOutputTokens: true,
          scriptTokensMonthlyMax: true,
          scriptMaxOutputTokens: true,
          avatarVideoQuota: true,
          influencerIaDailyQuota: true,
        },
      }),
      getStoredUsdRate(),
    ]);

    log.info("Cost estimate data loaded", {
      planCount: plans.length,
      usdRate: ratePayload?.rate,
    });

    return NextResponse.json({
      plans,
      usdToBrl: ratePayload?.rate ?? 5.5,
      rateDate: ratePayload?.date ?? null,
      rateFetchedAt: ratePayload?.fetchedAt ?? null,
    });
  } catch (error) {
    log.error("Failed to load cost estimate data", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao carregar dados de custo" },
      { status: 500 },
    );
  }
}
