import { NextResponse } from "next/server";
import { hotmartRequest } from "@/lib/hotmart/client";

/**
 * GET /api/admin/subscribers
 * Busca assinantes direto da API da Hotmart (sem cache de DB).
 * Webhooks continuam sendo o canal para receber eventos em tempo real.
 *
 * Query params:
 *   status=active|canceled|past_due|inactive
 *   search=<termo>       busca local por nome/email
 *   limit=50             itens por página (max 200)
 *   page_token=<token>   paginação cursor da Hotmart
 */

interface HotmartSubscriptionsResponse {
  items?: HotmartItem[];
  page_info?: {
    results_per_page?: number;
    total_results?: number;
    next_page_token?: string;
  };
}

interface HotmartItem {
  subscriber_code?: string;
  subscription_id?: number;
  status?: string;
  accession_date?: number;
  end_date?: number;
  plan?: { name?: string; id?: number; recurrency_period?: number };
  product?: { name?: string; id?: number };
  price?: { currency_code?: string; value?: number };
  subscriber?: { name?: string; email?: string; ucode?: string };
  date_next_charge?: number;
  transaction?: string;
}

const STATUS_MAP: Record<string, string> = {
  ACTIVE: "ACTIVE",
  CANCELED: "CANCELLED_BY_CUSTOMER",
  CANCELLED: "CANCELLED_BY_CUSTOMER",
  PAST_DUE: "OVERDUE",
  INACTIVE: "INACTIVE",
  EXPIRED: "EXPIRED",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status")?.toUpperCase();
  const search = url.searchParams.get("search");
  const pageToken = url.searchParams.get("page_token");
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")),
  );

  try {
    const productId = process.env.HOTMART_PRODUCT_ID;

    if (!productId) {
      return NextResponse.json(
        { error: "HOTMART_PRODUCT_ID não configurado" },
        { status: 400 },
      );
    }

    const params: Record<string, string | number> = {
      product_id: productId,
      max_results: limit,
    };

    if (statusFilter && STATUS_MAP[statusFilter]) {
      params.status = STATUS_MAP[statusFilter];
    }

    if (pageToken) {
      params.page_token = pageToken;
    }

    const data = await hotmartRequest<HotmartSubscriptionsResponse>(
      "/payments/api/v1/subscriptions",
      { params },
    );

    let items = data.items ?? [];

    // Filtro de texto local (API não suporta busca textual)
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          (item.subscriber?.name?.toLowerCase() ?? "").includes(q) ||
          (item.subscriber?.email?.toLowerCase() ?? "").includes(q),
      );
    }

    const subscribers = items.map((item) => ({
      id: String(item.subscription_id ?? item.subscriber_code),
      name: item.subscriber?.name ?? null,
      email: item.subscriber?.email ?? null,
      status: item.status ?? "UNKNOWN",
      plan: {
        id: String(item.plan?.id ?? ""),
        code: String(item.plan?.id ?? ""),
        name: item.plan?.name ?? null,
        displayPrice: item.price?.value
          ? `${item.price.currency_code} ${item.price.value.toFixed(2)}`
          : null,
        periodicity:
          (item.plan?.recurrency_period ?? 30) >= 360 ? "ANNUAL" : "MONTHLY",
      },
      subscriberCode: item.subscriber_code ?? null,
      hotmartStatus: item.status ?? null,
      startedAt: item.accession_date
        ? new Date(item.accession_date).toISOString()
        : null,
      cancelledAt: item.end_date ? new Date(item.end_date).toISOString() : null,
      lastPaymentAt: null,
      lastPaymentAmount: item.price?.value
        ? Math.round(item.price.value * 100)
        : null,
      lastPaymentCurrency: item.price?.currency_code ?? "BRL",
      createdAt: item.accession_date
        ? new Date(item.accession_date).toISOString()
        : new Date().toISOString(),
    }));

    return NextResponse.json({
      subscribers,
      pagination: {
        limit,
        total: subscribers.length,
        nextPageToken: data.page_info?.next_page_token ?? null,
      },
    });
  } catch (error) {
    console.error("[admin/subscribers] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar assinantes", detail: String(error) },
      { status: 500 },
    );
  }
}
