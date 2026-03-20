/**
 * Admin types for Hotmart billing integration and token quotas.
 */

// ==================== SUBSCRIBER TYPES (real data from DB) ====================

/** Subscriber status mapped from Hotmart */
export type SubscriberStatus =
  | "ACTIVE"
  | "CANCELED"
  | "PAST_DUE"
  | "PENDING"
  | "EXPIRED";

/** Plan info embedded in subscriber response */
export interface SubscriberPlan {
  id: string;
  code: string;
  name: string;
  displayPrice?: string | null;
  periodicity?: string | null;
}

/** Subscriber record — real data from Subscription + User + HotmartSubscription */
export interface Subscriber {
  id: string;
  name?: string | null;
  email?: string | null;
  status: SubscriberStatus;
  plan: SubscriberPlan;
  subscriberCode?: string | null;
  hotmartStatus?: string | null;
  startedAt?: string | null;
  cancelledAt?: string | null;
  lastPaymentAt?: string | null;
  lastPaymentAmount?: number | null;
  lastPaymentCurrency?: string;
  createdAt: string;
}

/** Paginated subscribers response */
export interface SubscribersResponse {
  subscribers: Subscriber[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Aggregated subscription metrics — real counts from DB */
export interface SubscriptionMetrics {
  activeSubscribers: number;
  canceledSubscribers: number;
  pastDueSubscribers: number;
  totalSubscribers: number;
  newThisMonth: number;
  cancelledThisMonth: number;
  revenueThisMonthCents: number;
  periodLabel: string;
  lastSyncAt?: string | null;
}

// ==================== QUOTA POLICY & USAGE ====================

/** Our internal limits per tenant/subscriber (NOT from Hotmart) */
export interface QuotaPolicy {
  /** Transcripts allowed per month (default 40) */
  transcriptsPerMonth: number;
  /** Script prompts allowed per month (default 70) */
  scriptsPerMonth: number;
  /** Insight tokens allowed per month */
  insightTokensPerMonth: number;
  /** Script tokens allowed per month */
  scriptTokensPerMonth: number;
  /** Max output tokens per insight request */
  insightMaxOutputTokens: number;
  /** Max output tokens per script request */
  scriptMaxOutputTokens: number;
}

/** Current period usage - null values mean unknown/not connected */
export interface QuotaUsage {
  transcriptsUsed?: number | null;
  scriptsUsed?: number | null;
  insightTokensUsed?: number | null;
  scriptTokensUsed?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  lastUpdatedAt?: string | null;
}

// ==================== HOTMART CONNECTION ====================

/** Hotmart API connection status */
export type HotmartConnectionStatus = "not_configured" | "connected" | "error";

/** Hotmart integration status */
export interface HotmartConnection {
  connected: boolean;
  status: HotmartConnectionStatus;
  producerId?: string;
  lastWebhookAt?: string;
  message?: string;
}

/** Customer/Account (Tenant) */
export interface Tenant {
  id: string;
  name: string;
  email?: string;
  planId?: string;
  hotmart?: HotmartConnection;
  createdAt?: string;
}

/** Billing plan with token quotas */
export interface Plan {
  id: string;
  name: string;
  price?: string;
  billingCycle?: "monthly" | "yearly";
  quotas: {
    /** Maximum insight tokens per month */
    insightTokensMonthlyMax: number;
    /** Maximum script tokens per month */
    scriptTokensMonthlyMax: number;
    /** Max output tokens per insight generation */
    insightMaxOutputTokens: number;
    /** Max output tokens per script generation */
    scriptMaxOutputTokens: number;
  };
}

/** Usage data for current billing period */
export interface Usage {
  tenantId: string;
  period: {
    startISO: string;
    endISO: string;
  };
  /** Insight tokens used this period (null if unknown) */
  insightTokensUsed?: number | null;
  /** Script tokens used this period (null if unknown) */
  scriptTokensUsed?: number | null;
}

/** Quota display data for header */
export interface QuotaInfo {
  used: number | null;
  max: number | null;
}

/** Hook return type for quota usage */
export interface QuotaUsageState {
  insight: QuotaInfo;
  script: QuotaInfo;
  status: "not_connected" | "ok" | "loading";
  period?: {
    startISO: string;
    endISO: string;
  };
}

/** Model settings for LLM generation */
export interface ModelSettings {
  model: string;
  temperature: number;
  top_p?: number;
  max_output_tokens: number;
}

/** Prompt configuration */
export interface PromptConfig {
  insight: {
    template: string;
    settings: ModelSettings;
  };
  script: {
    template: string;
    settings: ModelSettings;
  };
}

/** Hotmart webhook event types we plan to listen to */
export const HOTMART_WEBHOOK_EVENTS = [
  {
    event: "PURCHASE_APPROVED",
    description: "Compra aprovada / pagamento confirmado",
  },
  { event: "PURCHASE_REFUNDED", description: "Reembolso processado" },
  { event: "PURCHASE_CHARGEBACK", description: "Chargeback recebido" },
  { event: "SUBSCRIPTION_CANCELLATION", description: "Assinatura cancelada" },
  {
    event: "SUBSCRIPTION_RENEWAL",
    description: "Renovação de assinatura paga",
  },
  { event: "SWITCH_PLAN", description: "Mudança de plano" },
] as const;

/** Hotmart product/offer data mapping (schema reference) */
export const HOTMART_DATA_MAPPING = [
  { field: "product_id", description: "ID único do produto no Hotmart" },
  { field: "product_name", description: "Nome do produto" },
  { field: "product_status", description: "Status (ativo, inativo)" },
  { field: "offer_code", description: "Código da oferta" },
  { field: "offer_price", description: "Preço da oferta" },
  { field: "offer_currency", description: "Moeda (BRL, USD, etc.)" },
  {
    field: "payment_mode",
    description: "Modo de pagamento (one-time, subscription)",
  },
  {
    field: "subscription_periodicity",
    description: "Periodicidade (mensal, anual)",
  },
  { field: "subscription_installments", description: "Número de parcelas" },
  { field: "trial_days", description: "Dias de trial (se aplicável)" },
] as const;
