import { NextResponse } from "next/server";
import { hotmartRequest } from "@/lib/hotmart/client";

/**
 * GET /api/admin/subscription-metrics
 * Busca métricas de assinatura direto da API da Hotmart.
 * Webhooks continuam sendo o canal para receber eventos em tempo real.
 */

interface HotmartSubscriptionsResponse {
  items?: unknown[];
  page_info?: { total_results?: number };
}

async function fetchCount(productId: string, status?: string): Promise<number> {
  const params: Record<string, string | number> = {
    product_id: productId,
    max_results: 500,
  };
  if (status) params.status = status;

  const data = await hotmartRequest<HotmartSubscriptionsResponse>(
    "/payments/api/v1/subscriptions",
    { params },
  );
  return data.items?.length ?? 0;
}

export async function GET() {
  try {
    const productId = process.env.HOTMART_PRODUCT_ID;

    if (!productId) {
      return NextResponse.json(
        { error: "HOTMART_PRODUCT_ID não configurado" },
        { status: 400 },
      );
    }

    const [active, cancelled, overdue, inactive, total] = await Promise.all([
      fetchCount(productId, "ACTIVE"),
      fetchCount(productId, "CANCELLED_BY_CUSTOMER"),
      fetchCount(productId, "OVERDUE"),
      fetchCount(productId, "INACTIVE"),
      fetchCount(productId),
    ]);

    const now = new Date();
    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];

    return NextResponse.json({
      activeSubscribers: active,
      canceledSubscribers: cancelled,
      pastDueSubscribers: overdue + inactive,
      totalSubscribers: total,
      newThisMonth: 0,
      cancelledThisMonth: 0,
      revenueThisMonthCents: 0,
      periodLabel: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      lastSyncAt: null,
    });
  } catch (error) {
    console.error("[admin/subscription-metrics] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao calcular métricas", detail: String(error) },
      { status: 500 },
    );
  }
}
