/**
 * Admin API client for Hotmart integration and quota management.
 *
 * Calls internal API endpoints that query real DB data.
 * No mock data — all values come from Prisma queries.
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

/**
 * Trigger Hotmart sync (plans + coupons + subscribers).
 */
export async function triggerHotmartSync(): Promise<{
  success: boolean;
  message: string;
  data?: unknown;
}> {
  try {
    const adminSecret = getAdminSecret();
    const res = await fetch("/api/admin/sync-hotmart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminSecret ? { Authorization: `Bearer ${adminSecret}` } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error ?? "Sync falhou", data };
    }
    return { success: true, message: "Sync concluído", data };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function getAdminSecret(): string | null {
  // AVISO DE SEGURANÇA: Este helper recupera um segredo admin do localStorage,
  // que é acessível por qualquer script na página (XSS). O ideal é usar
  // session-based auth (next-auth) ao invés de um segredo via localStorage.
  // TODO: Migrar /api/admin/sync-hotmart para autenticação via sessão.
  if (typeof window !== "undefined") {
    return localStorage.getItem("hyppado_admin_secret");
  }
  return process.env.ADMIN_SECRET ?? null;
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

// ==================== HOTMART COUPON (UI-only) ====================

export interface CouponCreateRequest {
  productId: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  startDate?: string;
  endDate?: string;
  maxUses?: number;
}

/**
 * Create a Hotmart coupon.
 * This will only work when backend is connected.
 * Returns { success: false, message } if not connected.
 */
export async function createHotmartCoupon(
  coupon: CouponCreateRequest,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/admin/hotmart/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coupon),
    });
    if (!res.ok) {
      return {
        success: false,
        message: "Backend not connected or request failed",
      };
    }
    return await res.json();
  } catch {
    return { success: false, message: "Backend not available" };
  }
}

// ==================== LOCAL STORAGE HELPERS ====================

const QUOTA_POLICY_KEY = "hyppado_quota_policy";
const SUPPORT_CONFIG_KEY = "hyppado_support_config";

export interface SupportConfig {
  email?: string;
}

/** Save quota policy to localStorage */
export function saveQuotaPolicyLocally(policy: QuotaPolicy): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(QUOTA_POLICY_KEY, JSON.stringify(policy));
  }
}

/** Load quota policy from localStorage */
export function loadQuotaPolicyLocally(): QuotaPolicy | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(QUOTA_POLICY_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as QuotaPolicy;
  } catch {
    return null;
  }
}

/** Save support config locally */
export function saveSupportConfigLocally(config: SupportConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(SUPPORT_CONFIG_KEY, JSON.stringify(config));
  }
}

/** Load support config from localStorage */
export function loadSupportConfigLocally(): SupportConfig {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(SUPPORT_CONFIG_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as SupportConfig;
  } catch {
    return {};
  }
}

// ==================== ADMIN MODE CHECK ====================

/**
 * @deprecated A função isAdminMode() usa NEXT_PUBLIC_ADMIN_MODE cheé uma
 * variável de ambiente pública. A verificação de admin deve ser feita via
 * session.user.role === "ADMIN" (server-side) ou pelo helper requireAdmin()
 * em lib/auth.ts. Esta função será removida numa versão futura.
 */
export function isAdminMode(): boolean {
  return process.env.NEXT_PUBLIC_ADMIN_MODE === "true";
}
