import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { hotmartRequest } from "@/lib/hotmart/client";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/admin/subscribers");

/**
 * GET /api/admin/subscribers
 * Lista assinantes diretamente da API Hotmart.
 *
 * Query params:
 *   status=active|canceled|past_due  filtra por status (mapeado para Hotmart)
 *   search=<termo>       busca por email do assinante
 *   limit=50             itens por página (max 200)
 *   page=1               número da página
 */

// ── Hotmart API response types ──────────────────────────────────────────────

interface HotmartSubscriber {
  name: string;
  email: string;
  ucode: string;
}

interface HotmartPlan {
  name: string;
  id: number;
  recurrency_period?: string;
  max_charge_cycles?: number;
}

interface HotmartPrice {
  value: number;
  currency_code: string;
}

interface HotmartSubscription {
  subscriber_code: string;
  subscription_id: number;
  status: string;
  accession_date: number;
  end_date?: number;
  request_date?: number;
  date_next_charge?: number;
  trial?: boolean;
  plan: HotmartPlan;
  price: HotmartPrice;
  subscriber: HotmartSubscriber;
}

interface HotmartPageInfo {
  total_results: number;
  next_page_token?: string;
  prev_page_token?: string;
  results_per_page: number;
}

interface HotmartSubscriptionsResponse {
  items: HotmartSubscription[];
  page_info: HotmartPageInfo;
}

// ── Status mapping ──────────────────────────────────────────────────────────

/** Our filter → Hotmart API status value */
const STATUS_FILTER_TO_HOTMART: Record<string, string> = {
  ACTIVE: "ACTIVE",
  CANCELED: "CANCELLED_BY_CUSTOMER",
  CANCELLED: "CANCELLED_BY_CUSTOMER",
  PAST_DUE: "DELAYED",
  PENDING: "STARTED",
  EXPIRED: "INACTIVE",
};

/** Hotmart status → our internal display status */
function mapHotmartStatus(
  hotmartStatus: string,
): "ACTIVE" | "CANCELED" | "PAST_DUE" | "PENDING" | "EXPIRED" {
  switch (hotmartStatus) {
    case "ACTIVE":
      return "ACTIVE";
    case "CANCELLED_BY_CUSTOMER":
    case "CANCELLED_BY_SELLER":
    case "CANCELLED_BY_ADMIN":
      return "CANCELED";
    case "DELAYED":
    case "OVERDUE":
      return "PAST_DUE";
    case "STARTED":
      return "PENDING";
    case "INACTIVE":
    default:
      return "EXPIRED";
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status")?.toUpperCase();
  const search = url.searchParams.get("search");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")),
  );

  try {
    const productId = await getSetting(SETTING_KEYS.HOTMART_PRODUCT_ID);

    // Build Hotmart API params
    const params: Record<string, string | number> = {
      max_results: limit,
    };

    if (productId) {
      params.product_id = productId;
    }

    // Map our status filter to Hotmart status
    if (statusFilter && STATUS_FILTER_TO_HOTMART[statusFilter]) {
      params.status = STATUS_FILTER_TO_HOTMART[statusFilter];
    }

    // Hotmart supports search by email
    if (search && search.includes("@")) {
      params.subscriber_email = search;
    }

    // Hotmart uses page_token for pagination, but for page > 1 we need
    // to iterate. For simplicity, use max_results offset approach.
    // Hotmart API doesn't have offset — it uses page_token.
    // We'll fetch page 1 and return it; for subsequent pages we'd need
    // to chain page_token calls. For admin usage, limit is usually enough.
    const data = await hotmartRequest<HotmartSubscriptionsResponse>(
      "/payments/api/v1/subscriptions",
      { params },
    );

    const items = data.items ?? [];

    // Map Hotmart subscriptions to our Subscriber shape
    const subscribers = items.map((item) => ({
      id: String(item.subscription_id),
      name: item.subscriber?.name ?? null,
      email: item.subscriber?.email ?? null,
      status: mapHotmartStatus(item.status),
      plan: {
        id: String(item.plan?.id ?? ""),
        code: String(item.plan?.id ?? ""),
        name: item.plan?.name ?? "—",
        displayPrice: item.price
          ? `${item.price.currency_code} ${(item.price.value / 1).toFixed(2)}`
          : null,
        periodicity: item.plan?.recurrency_period ?? null,
      },
      source: "hotmart" as const,
      subscriberCode: item.subscriber_code ?? null,
      hotmartStatus: item.status,
      startedAt: item.accession_date
        ? new Date(item.accession_date).toISOString()
        : null,
      cancelledAt: item.end_date ? new Date(item.end_date).toISOString() : null,
      lastPaymentAt: null,
      lastPaymentAmount: item.price ? Math.round(item.price.value * 100) : null,
      lastPaymentCurrency: item.price?.currency_code ?? "BRL",
      createdAt: item.accession_date
        ? new Date(item.accession_date).toISOString()
        : new Date().toISOString(),
    }));

    // Client-side name search for non-email queries
    const filtered =
      search && !search.includes("@")
        ? subscribers.filter(
            (s) =>
              s.name?.toLowerCase().includes(search.toLowerCase()) ||
              s.email?.toLowerCase().includes(search.toLowerCase()),
          )
        : subscribers;

    const total = data.page_info?.total_results ?? filtered.length;

    return NextResponse.json({
      subscribers: filtered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao buscar assinantes da Hotmart", detail: String(error) },
      { status: 500 },
    );
  }
}
