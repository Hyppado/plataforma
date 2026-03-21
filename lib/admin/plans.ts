/**
 * lib/admin/plans.ts
 *
 * Helpers para planos com quotas.
 * Dados reais vêm do banco — este arquivo provê tipos e fallbacks.
 */

import prisma from "@/lib/prisma";
import type { Plan } from "@/lib/types/admin";

/**
 * Busca plano do banco e converte para o tipo Plan da UI.
 * Retorna fallback se não encontrado.
 */
export async function getPlanFromDb(planId: string): Promise<Plan> {
  const dbPlan = await prisma.plan.findUnique({ where: { id: planId } });

  if (!dbPlan) return DEFAULT_FALLBACK_PLAN;

  return {
    id: dbPlan.id,
    name: dbPlan.name,
    price: dbPlan.displayPrice ?? undefined,
    billingCycle: dbPlan.periodicity === "ANNUAL" ? "yearly" : "monthly",
    quotas: {
      insightTokensMonthlyMax: dbPlan.insightTokensMonthlyMax,
      scriptTokensMonthlyMax: dbPlan.scriptTokensMonthlyMax,
      insightMaxOutputTokens: dbPlan.insightMaxOutputTokens,
      scriptMaxOutputTokens: dbPlan.scriptMaxOutputTokens,
    },
  };
}

/** Busca plano por code (slug). */
export async function getPlanByCode(code: string): Promise<Plan> {
  const dbPlan = await prisma.plan.findUnique({ where: { code } });

  if (!dbPlan) return DEFAULT_FALLBACK_PLAN;

  return {
    id: dbPlan.id,
    name: dbPlan.name,
    price: dbPlan.displayPrice ?? undefined,
    billingCycle: dbPlan.periodicity === "ANNUAL" ? "yearly" : "monthly",
    quotas: {
      insightTokensMonthlyMax: dbPlan.insightTokensMonthlyMax,
      scriptTokensMonthlyMax: dbPlan.scriptTokensMonthlyMax,
      insightMaxOutputTokens: dbPlan.insightMaxOutputTokens,
      scriptMaxOutputTokens: dbPlan.scriptMaxOutputTokens,
    },
  };
}

/** Fallback se plano não existir no banco. */
const DEFAULT_FALLBACK_PLAN: Plan = {
  id: "fallback",
  name: "Free",
  billingCycle: "monthly",
  quotas: {
    insightTokensMonthlyMax: 10000,
    scriptTokensMonthlyMax: 5000,
    insightMaxOutputTokens: 500,
    scriptMaxOutputTokens: 800,
  },
};

/**
 * Get a plan by ID — reads from database.
 * Falls back to default if not found.
 */
export function getPlanById(planId: string | undefined): Promise<Plan> {
  if (!planId) return Promise.resolve(DEFAULT_FALLBACK_PLAN);
  return getPlanFromDb(planId);
}

/**
 * Format token count for display.
 * e.g., 50000 -> "50k", 1000000 -> "1M"
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(count % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(count % 1_000 === 0 ? 0 : 1)}k`;
  }
  return count.toString();
}
