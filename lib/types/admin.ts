/**
 * Admin types for billing integration and token quotas.
 * Provider-agnostic: supports Hotmart, Stripe, manual, invite, etc.
 */

// ==================== SUBSCRIBER TYPES (real data from DB) ====================

/** Subscriber status (provider-agnostic) */
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

/** Subscriber record — real data from Subscription + User (provider-agnostic) */
export interface Subscriber {
  id: string;
  name?: string | null;
  email?: string | null;
  status: SubscriberStatus;
  plan: SubscriberPlan;
  /** Origin: "hotmart" | "manual" | "invite" | "stripe" */
  source?: string;
  /** External subscriber code (e.g. Hotmart subscriberCode), if any */
  subscriberCode?: string | null;
  /** External provider status, if any */
  hotmartStatus?: string | null;
  startedAt?: string | null;
  cancelledAt?: string | null;
  /** Date the next charge is scheduled */
  nextChargeAt?: string | null;
  /** Date the subscription ends (after cancellation) */
  endDate?: string | null;
  /** Date the cancellation was requested */
  requestDate?: string | null;
  /** Whether the subscription is in trial */
  trial?: boolean;
  /** Max charge cycles for the plan */
  maxChargeCycles?: number | null;
  /** Recurrency period (MONTHLY, YEARLY, etc.) */
  recurrencyPeriod?: string | null;
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

/** Hotmart webhook event types we handle */
export const HOTMART_WEBHOOK_EVENTS = [
  // Provisionamento principal
  {
    event: "PURCHASE_APPROVED",
    description: "Compra aprovada / pagamento confirmado",
  },
  {
    event: "PURCHASE_COMPLETE",
    description: "Compra concluída (pós-garantia antichargeback)",
  },

  // Cancelamentos e perdas
  { event: "PURCHASE_CANCELED", description: "Compra cancelada" },
  { event: "PURCHASE_REFUNDED", description: "Reembolso processado" },
  { event: "PURCHASE_CHARGEBACK", description: "Chargeback recebido" },
  {
    event: "SUBSCRIPTION_CANCELLATION",
    description: "Assinatura cancelada definitivamente",
  },

  // Atraso e expiração
  { event: "PURCHASE_DELAYED", description: "Pagamento em atraso (overdue)" },
  {
    event: "PURCHASE_EXPIRED",
    description: "Pagamento expirado (boleto/PIX não compensado)",
  },

  // Disputa / pedido de reembolso
  {
    event: "PURCHASE_PROTEST",
    description: "Solicitação de reembolso / disputa",
  },

  // Alterações de assinatura
  { event: "SWITCH_PLAN", description: "Mudança de plano" },
  {
    event: "UPDATE_SUBSCRIPTION_CHARGE_DATE",
    description: "Data de cobrança alterada",
  },

  // Aguardando pagamento
  {
    event: "PURCHASE_BILLET_PRINTED",
    description: "Boleto emitido (aguardando pagamento)",
  },

  // Informativos (audit log apenas)
  { event: "CART_ABANDONMENT", description: "Carrinho abandonado" },
  { event: "CLUB_FIRST_ACCESS", description: "Primeiro acesso ao conteúdo" },
  { event: "CLUB_MODULE_COMPLETED", description: "Módulo concluído" },
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
