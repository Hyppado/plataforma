/**
 * Admin API client for billing integration and quota management.
 *
 * Calls internal API endpoints that query real DB data.
 * No mock data — all values come from Prisma queries.
 * Provider-agnostic: supports Hotmart, Stripe, manual, invite, etc.
 */

import type {
  HotmartConnection,
  Subscriber,
  SubscribersResponse,
  SubscriptionMetrics,
  QuotaPolicy,
  QuotaUsage,
} from "@/lib/types/admin";

// ==================== DEFAULT VALUES ====================

/** Default quota policy (our internal limits) */
export const DEFAULT_QUOTA_POLICY: QuotaPolicy = {
  transcriptsPerMonth: 40,
  scriptsPerMonth: 70,
  insightTokensPerMonth: 50_000,
  scriptTokensPerMonth: 20_000,
  insightMaxOutputTokens: 800,
  scriptMaxOutputTokens: 1500,
};

/** Empty/not-connected Hotmart connection state */
export const NOT_CONNECTED: HotmartConnection = {
  connected: false,
  status: "not_configured",
  message: "Hotmart backend not configured",
};

// ==================== API FUNCTIONS ====================

/**
 * Check Hotmart connection status.
 */
export async function getHotmartConnection(): Promise<HotmartConnection> {
  try {
    const res = await fetch("/api/admin/hotmart/connection");
    if (!res.ok) return NOT_CONNECTED;
    return await res.json();
  } catch {
    return NOT_CONNECTED;
  }
}

/**
 * Get subscribers list from real DB data.
 * Returns paginated response with subscriber details.
 */
export async function getSubscribers(
  status?: "active" | "canceled" | "past_due",
  page = 1,
  limit = 50,
  search?: string,
): Promise<SubscribersResponse> {
  const empty: SubscribersResponse = {
    subscribers: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
  };
  try {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await fetch(`/api/admin/subscribers?${params.toString()}`);
    if (!res.ok) return empty;
    const data = await res.json();
    // Handle both new paginated format and potential legacy array format
    if (data.subscribers) return data as SubscribersResponse;
    if (Array.isArray(data)) {
      return {
        subscribers: data as Subscriber[],
        pagination: {
          page: 1,
          limit: data.length,
          total: data.length,
          totalPages: 1,
        },
      };
    }
    return empty;
  } catch {
    return empty;
  }
}

/**
 * Get subscription metrics (real aggregated counts from DB).
 */
export async function getSubscriptionMetrics(): Promise<SubscriptionMetrics> {
  const empty: SubscriptionMetrics = {
    activeSubscribers: 0,
    canceledSubscribers: 0,
    pastDueSubscribers: 0,
    totalSubscribers: 0,
    newThisMonth: 0,
    cancelledThisMonth: 0,
    revenueThisMonthCents: 0,
    periodLabel: "",
    lastSyncAt: null,
  };
  try {
    const res = await fetch("/api/admin/subscription-metrics");
    if (!res.ok) return empty;
    return await res.json();
  } catch {
    return empty;
  }
}

/** Update quota policy via API. */
export async function updateQuotaPolicy(policy: QuotaPolicy): Promise<void> {
  const res = await fetch("/api/admin/quota-policy", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policy),
  });
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: "Erro ao salvar limites" }));
    throw new Error(body.error ?? `Erro ${res.status} ao salvar limites`);
  }
}

/**
 * Get quota policy from the Plan table (server-side).
 * Falls back to defaults if not configured.
 */
export async function getQuotaPolicy(): Promise<QuotaPolicy> {
  try {
    const res = await fetch("/api/admin/quota-policy");
    if (!res.ok) return DEFAULT_QUOTA_POLICY;
    return await res.json();
  } catch {
    return DEFAULT_QUOTA_POLICY;
  }
}

/**
 * Get current quota usage for the period.
 * Returns null values if not connected/tracking.
 */
export async function getQuotaUsage(): Promise<QuotaUsage> {
  try {
    const res = await fetch("/api/admin/quota-usage");
    if (!res.ok) {
      return {
        transcriptsUsed: null,
        scriptsUsed: null,
        insightTokensUsed: null,
        scriptTokensUsed: null,
        periodStart: null,
        periodEnd: null,
        lastUpdatedAt: null,
      };
    }
    return await res.json();
  } catch {
    return {
      transcriptsUsed: null,
      scriptsUsed: null,
      insightTokensUsed: null,
      scriptTokensUsed: null,
      periodStart: null,
      periodEnd: null,
      lastUpdatedAt: null,
    };
  }
}

// ==================== LOCAL STORAGE HELPERS ====================

// ==================== PROMPT CONFIG API ====================

import type { PromptConfig } from "@/lib/types/admin";

/** Get prompt config from API (DB-backed). */
export async function getPromptConfig(): Promise<PromptConfig> {
  try {
    const res = await fetch("/api/admin/prompt-config");
    if (!res.ok) throw new Error("Failed to fetch prompt config");
    return await res.json();
  } catch {
    // Fallback to default (should match backend default)
    const { getDefaultPromptConfig } = await import("@/lib/admin/config");
    return getDefaultPromptConfig();
  }
}

/** Update prompt config via API. */
export async function updatePromptConfig(config: PromptConfig): Promise<void> {
  const res = await fetch("/api/admin/prompt-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: "Erro ao salvar prompt" }));
    throw new Error(body.error ?? `Erro ${res.status} ao salvar prompt`);
  }
}
