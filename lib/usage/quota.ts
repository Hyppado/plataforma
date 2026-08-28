import { prisma } from "@/lib/prisma";
import type { Plan } from "@prisma/client";

export interface QuotaLimits {
  transcriptsPerMonth: number;
  scriptsPerMonth: number;
  insightTokensMonthlyMax: number;
  scriptTokensMonthlyMax: number;
  insightMaxOutputTokens: number;
  scriptMaxOutputTokens: number;
  avatarVideoQuota: number;
  shopeeDownloadsPerDay: number;
}

/**
 * Returns the effective Plan for the given user, considering all access
 * sources in priority order:
 *
 *   1. Active AccessGrant with a linked plan (admin override)
 *   2. Subscription with valid paid period (status ACTIVE/PAST_DUE, or
 *      CANCELLED but endedAt not yet reached)
 *   3. null (no plan / no quota limits)
 *
 * This mirrors the priority chain in `lib/access/resolver.ts` so that
 * quota enforcement stays consistent with the access decision.
 *
 * Note: A CANCELLED subscription still grants quota access until endedAt,
 * since the user has already paid for that period.
 */
export async function getUserActivePlan(userId: string): Promise<Plan | null> {
  // 1. Check AccessGrant first (admin override, highest priority)
  const now = new Date();
  const grant = await prisma.accessGrant.findFirst({
    where: {
      userId,
      isActive: true,
      planId: { not: null },
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (grant?.plan) {
    return grant.plan;
  }

  // 2. Fall back to subscription with valid paid period
  // Priority: ACTIVE > PAST_DUE > CANCELLED (with valid period)
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      OR: [
        // Active or past due subscriptions
        { status: { in: ["ACTIVE", "PAST_DUE"] } },
        // Cancelled but paid period not yet expired
        {
          status: "CANCELLED",
          endedAt: { gt: now },
        },
      ],
    },
    orderBy: [
      // Prefer ACTIVE over others
      { status: "asc" },
      { startedAt: "desc" },
    ],
    include: { plan: true },
  });

  return subscription?.plan ?? null;
}

/**
 * Maps a Plan row to the QuotaLimits interface.
 * Falls back to safe defaults if the plan is null.
 */
/**
 * Teto DIÁRIO de downloads da Shopee quando não há plano resolvido.
 *
 * As demais cotas devolvem 0 nesse caso, e 0 significa ILIMITADO no
 * assertQuota. Isso funciona para elas porque quem não tem plano normalmente
 * nem chega ao check — mas há um caminho em que chega: cortesia (AccessGrant)
 * sem plano vinculado concede acesso e deixa o plano nulo. Aplicar o mesmo 0
 * aqui daria download ilimitado justo a quem não paga.
 */
const SHOPEE_DOWNLOADS_DIA_SEM_PLANO = 10;

export function getQuotaLimits(plan: Plan | null): QuotaLimits {
  if (!plan) {
    return {
      transcriptsPerMonth: 0,
      scriptsPerMonth: 0,
      insightTokensMonthlyMax: 0,
      scriptTokensMonthlyMax: 0,
      insightMaxOutputTokens: 0,
      scriptMaxOutputTokens: 0,
      avatarVideoQuota: 0,
      shopeeDownloadsPerDay: SHOPEE_DOWNLOADS_DIA_SEM_PLANO,
    };
  }
  return {
    transcriptsPerMonth: plan.transcriptsPerMonth,
    scriptsPerMonth: plan.scriptsPerMonth,
    insightTokensMonthlyMax: plan.insightTokensMonthlyMax,
    scriptTokensMonthlyMax: plan.scriptTokensMonthlyMax,
    insightMaxOutputTokens: plan.insightMaxOutputTokens,
    scriptMaxOutputTokens: plan.scriptMaxOutputTokens,
    avatarVideoQuota: plan.avatarVideoQuota,
    shopeeDownloadsPerDay: plan.shopeeDownloadsPerDay,
  };
}
