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
import { getQuotaLimits, type QuotaLimits } from "@/lib/usage/quota";

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
  quotas: QuotaLimits | null;
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
      quotas: grant.plan ? getQuotaLimits(grant.plan) : null,
    };
  }

  // 4. Check subscription with valid paid period
  // A CANCELLED subscription still grants access until endedAt
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
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: { plan: true },
  });

  if (subscription?.status === "ACTIVE") {
    return {
      status: "FULL_ACCESS",
      source: "subscription",
      plan: subscription.plan,
      expiresAt: subscription.nextChargeAt,
      reason: `Assinatura ativa: ${subscription.plan.name}`,
      quotas: getQuotaLimits(subscription.plan),
    };
  }

  if (subscription?.status === "PAST_DUE") {
    return {
      status: "GRACE_PERIOD",
      source: "subscription",
      plan: subscription.plan,
      expiresAt: subscription.nextChargeAt,
      reason: `Pagamento em atraso: ${subscription.plan.name}`,
      quotas: getQuotaLimits(subscription.plan),
    };
  }

  // CANCELLED but still within paid period
  if (subscription?.status === "CANCELLED" && subscription.endedAt) {
    return {
      status: "FULL_ACCESS",
      source: "subscription",
      plan: subscription.plan,
      expiresAt: subscription.endedAt,
      reason: `Assinatura cancelada, acesso até ${subscription.endedAt.toLocaleDateString("pt-BR")}`,
      quotas: getQuotaLimits(subscription.plan),
    };
  }

  // 5. No access
  return NO_ACCESS;
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
