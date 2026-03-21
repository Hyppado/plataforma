import { prisma } from "@/lib/prisma";
import type { Plan } from "@prisma/client";

export interface QuotaLimits {
  transcriptsPerMonth: number;
  scriptsPerMonth: number;
  insightTokensMonthlyMax: number;
  scriptTokensMonthlyMax: number;
  insightMaxOutputTokens: number;
  scriptMaxOutputTokens: number;
}

/**
 * Returns the active Plan for the given user, or null when the user has no
 * active subscription.
 */
export async function getUserActivePlan(userId: string): Promise<Plan | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    include: { plan: true },
  });
  return subscription?.plan ?? null;
}

/**
 * Maps a Plan row to the QuotaLimits interface.
 * Falls back to safe defaults if the plan is null.
 */
export function getQuotaLimits(plan: Plan | null): QuotaLimits {
  if (!plan) {
    return {
      transcriptsPerMonth: 0,
      scriptsPerMonth: 0,
      insightTokensMonthlyMax: 0,
      scriptTokensMonthlyMax: 0,
      insightMaxOutputTokens: 0,
      scriptMaxOutputTokens: 0,
    };
  }
  return {
    transcriptsPerMonth: plan.transcriptsPerMonth,
    scriptsPerMonth: plan.scriptsPerMonth,
    insightTokensMonthlyMax: plan.insightTokensMonthlyMax,
    scriptTokensMonthlyMax: plan.scriptTokensMonthlyMax,
    insightMaxOutputTokens: plan.insightMaxOutputTokens,
    scriptMaxOutputTokens: plan.scriptMaxOutputTokens,
  };
}
