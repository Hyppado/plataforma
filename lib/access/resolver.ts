/**
 * lib/access/resolver.ts
 *
 * Serviço de resolução de acesso.
 * Computa o AccessStatus efetivo a partir de:
 *   1. UserStatus (conta)
 *   2. AccessGrant (override manual do admin)
 *   3. SubscriptionStatus (assinatura comercial)
 *
 * O AccessStatus NUNCA é persistido — é sempre derivado em runtime.
 */

import { prisma } from "@/lib/prisma";
import type { Plan } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccessStatus =
  | "FULL_ACCESS"
  | "GRACE_PERIOD"
  | "NO_ACCESS"
  | "SUSPENDED";

export type AccessSource = "subscription" | "manual_grant" | "none";

export interface AccessResolution {
  status: AccessStatus;
  source: AccessSource;
  plan: Plan | null;
  expiresAt: Date | null;
  reason: string;
  /** Quota limits derived from the resolved plan */
  quotas: {
    transcriptsPerMonth: number;
    scriptsPerMonth: number;
    insightTokensMonthlyMax: number;
    scriptTokensMonthlyMax: number;
    insightMaxOutputTokens: number;
    scriptMaxOutputTokens: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Default (no access) result
// ---------------------------------------------------------------------------

const NO_ACCESS: AccessResolution = {
  status: "NO_ACCESS",
  source: "none",
  plan: null,
  expiresAt: null,
  reason: "Sem assinatura ativa",
  quotas: null,
};

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve o acesso efetivo de um usuário.
 *
 * Prioridade:
 *   UserStatus > AccessGrant > SubscriptionStatus
 */
export async function resolveUserAccess(
  userId: string,
): Promise<AccessResolution> {
  // 1. Busca usuário
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NO_ACCESS;

  // 2. UserStatus checks (bloqueio absoluto)
  if (user.status === "SUSPENDED") {
    return {
      status: "SUSPENDED",
      source: "none",
      plan: null,
      expiresAt: null,
      reason: "Conta suspensa",
      quotas: null,
    };
  }

  if (user.status === "INACTIVE" || user.deletedAt) {
    return {
      status: "NO_ACCESS",
      source: "none",
      plan: null,
      expiresAt: null,
      reason: user.deletedAt ? "Conta excluída (LGPD)" : "Conta inativa",
      quotas: null,
    };
  }

  // 3. Check AccessGrant (admin override — highest priority after user status)
  const now = new Date();
  const grant = await prisma.accessGrant.findFirst({
    where: {
      userId,
      isActive: true,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (grant) {
    return {
      status: "FULL_ACCESS",
      source: "manual_grant",
      plan: grant.plan,
      expiresAt: grant.expiresAt,
      reason: `Acesso concedido manualmente: ${grant.reason}`,
      quotas: grant.plan ? extractQuotas(grant.plan) : null,
    };
  }

  // 4. Check active subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
    orderBy: { startedAt: "desc" },
    include: { plan: true },
  });

  if (subscription?.status === "ACTIVE") {
    return {
      status: "FULL_ACCESS",
      source: "subscription",
      plan: subscription.plan,
      expiresAt: subscription.nextChargeAt,
      reason: `Assinatura ativa: ${subscription.plan.name}`,
      quotas: extractQuotas(subscription.plan),
    };
  }

  if (subscription?.status === "PAST_DUE") {
    return {
      status: "GRACE_PERIOD",
      source: "subscription",
      plan: subscription.plan,
      expiresAt: subscription.nextChargeAt,
      reason: `Pagamento em atraso: ${subscription.plan.name}`,
      quotas: extractQuotas(subscription.plan),
    };
  }

  // 5. No access
  return NO_ACCESS;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractQuotas(plan: Plan) {
  return {
    transcriptsPerMonth: plan.transcriptsPerMonth,
    scriptsPerMonth: plan.scriptsPerMonth,
    insightTokensMonthlyMax: plan.insightTokensMonthlyMax,
    scriptTokensMonthlyMax: plan.scriptTokensMonthlyMax,
    insightMaxOutputTokens: plan.insightMaxOutputTokens,
    scriptMaxOutputTokens: plan.scriptMaxOutputTokens,
  };
}

/**
 * Quick check: does the user currently have access?
 * Useful for middleware/guards that only need a boolean.
 */
export async function hasAccess(userId: string): Promise<boolean> {
  const resolution = await resolveUserAccess(userId);
  return (
    resolution.status === "FULL_ACCESS" || resolution.status === "GRACE_PERIOD"
  );
}
