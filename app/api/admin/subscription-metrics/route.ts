import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { hotmartRequest } from "@/lib/hotmart/client";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/admin/subscription-metrics");

/**
 * GET /api/admin/subscription-metrics
 * Calcula métricas de assinatura a partir da API Hotmart.
 * Faz chamadas paralelas por status para obter contagens.
 */

interface HotmartPageInfo {
  total_results: number;
  next_page_token?: string;
  results_per_page: number;
}

interface HotmartSalesSummaryItem {
  total_items: number;
  total_value: { value: number; currency_code: string };
}

interface HotmartSalesSummaryResponse {
  items: HotmartSalesSummaryItem[];
  page_info: HotmartPageInfo;
}

interface HotmartSubscriptionsResponse {
  items: Array<{
    subscription_id: number;
    status: string;
    accession_date: number;
    end_date?: number;
    price: { value: number; currency_code: string };
  }>;
  page_info: HotmartPageInfo;
}

/** Fetch subscription count for a given Hotmart status */
async function countByStatus(
  status: string,
  productId: string | null,
): Promise<number> {
  const params: Record<string, string | number> = {
    status,
    max_results: 1,
  };
  if (productId) params.product_id = productId;

  try {
    const data = await hotmartRequest<HotmartSubscriptionsResponse>(
      "/payments/api/v1/subscriptions",
      { params },
    );
    return data.page_info?.total_results ?? 0;
  } catch (err) {
    log.error("countByStatus failed", {
      status,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const productId = await getSetting(SETTING_KEYS.HOTMART_PRODUCT_ID);

    const url = new URL(req.url);
    const now = new Date();
    const year = parseInt(url.searchParams.get("year") ?? String(now.getFullYear()), 10);
    const month = parseInt(url.searchParams.get("month") ?? String(now.getMonth() + 1), 10); // 1-based
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = isCurrentMonth ? now : new Date(year, month, 1); // exclusive end for faturado/liquidado
    const fullMonthEnd = new Date(year, month, 1); // always full month end — used for previsto window
    const startOfMonthMs = startOfMonth.getTime();
    const endOfMonthMs = endOfMonth.getTime();
    const fullMonthEndMs = fullMonthEnd.getTime();

    // Parallel calls to get counts by status
    const [
      active,
      cancelledByCustomer,
      cancelledBySeller,
      cancelledByAdmin,
      delayed,
      overdue,
      inactive,
      started,
    ] = await Promise.all([
      countByStatus("ACTIVE", productId),
      countByStatus("CANCELLED_BY_CUSTOMER", productId),
      countByStatus("CANCELLED_BY_SELLER", productId),
      countByStatus("CANCELLED_BY_ADMIN", productId),
      countByStatus("DELAYED", productId),
      countByStatus("OVERDUE", productId),
      countByStatus("INACTIVE", productId),
      countByStatus("STARTED", productId),
    ]);

    const cancelled = cancelledByCustomer + cancelledBySeller;
    const refunded = cancelledByAdmin;

    // INADIMPLENTES VÊM DO NOSSO BANCO, NÃO DA HOTMART.
    //
    // A listagem /payments/api/v1/subscriptions OMITE assinaturas em atraso:
    // `status=DELAYED` devolve total_results=0, e varrer a lista inteira (154
    // assinaturas) não traz nenhuma DELAYED. As mesmas assinaturas, quando
    // consultadas por `subscriber_code`, respondem `status: "DELAYED"`.
    //
    // Verificado em 2026-08-10: 58 inadimplentes no nosso banco, todos
    // confirmados como DELAYED pela própria Hotmart em consulta individual —
    // e a aba mostrava zero.
    //
    // O nosso banco é alimentado por webhook e é a fonte mais completa aqui.
    const pastDueFromApi = delayed + overdue;
    const pastDueLocal = await prisma.subscription.count({
      where: { status: "PAST_DUE" },
    });
    const pastDue = Math.max(pastDueFromApi, pastDueLocal);
    // STARTED = boleto aguardando pagamento; INACTIVE = boleto expirado
    const pending = started + inactive;
    const total = active + cancelled + refunded + pastDue + pending;

    // Fetch recent subscriptions to compute "new this month" and "cancelled this month"
    // We get active subs with accession_date filter for new this month
    const recentParams: Record<string, string | number> = {
      max_results: 200,
    };
    if (productId) recentParams.product_id = productId;

    let newThisMonth = 0;
    let cancelledThisMonth = 0;
    let revenueApprovedThisMonthCents = 0; // APPROVED comprados no mês (para somar no faturado)
    let revenueApprovedCents = 0;          // APPROVED onde data+7d cai no mês (previsto)
    let revenueCompletedCents = 0;         // COMPLETE liquidados no mês

    try {
      const recentData = await hotmartRequest<HotmartSubscriptionsResponse>(
        "/payments/api/v1/subscriptions",
        { params: { ...recentParams, accession_date: startOfMonthMs } },
      );
      newThisMonth =
        recentData.page_info?.total_results ?? recentData.items?.length ?? 0;
    } catch {
      // Silent fallback
    }

    try {
      const cancelledData = await hotmartRequest<HotmartSubscriptionsResponse>(
        "/payments/api/v1/subscriptions",
        {
          params: {
            ...recentParams,
            status: "CANCELLED_BY_CUSTOMER",
            end_date: startOfMonthMs,
          },
        },
      );
      cancelledThisMonth =
        cancelledData.page_info?.total_results ??
        cancelledData.items?.length ??
        0;
    } catch {
      // Silent fallback
    }

    // Fetch all 3 revenue views in parallel
    const SETTLE_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // janela de estorno Hotmart = 7 dias

    const salesBase: Record<string, string | number> = {
      start_date: startOfMonthMs,
      end_date: endOfMonthMs,
    };
    if (productId) salesBase.product_id = productId;

    await Promise.all([
      // Faturado (compras do mês) — APPROVED no período selecionado
      hotmartRequest<HotmartSalesSummaryResponse>(
        "/payments/api/v1/sales/summary",
        { params: { ...salesBase, transaction_status: "APPROVED" } },
      ).then((s) => {
        const brl = s.items?.find((i) => i.total_value?.currency_code === "BRL");
        revenueApprovedThisMonthCents = brl ? Math.round(brl.total_value.value * 100) : 0;
      }).catch(() => {}),

      // Liquidado — COMPLETE que liquidou no período (Hotmart filtra pela data de liquidação)
      hotmartRequest<HotmartSalesSummaryResponse>(
        "/payments/api/v1/sales/summary",
        { params: { ...salesBase, transaction_status: "COMPLETE" } },
      ).then((s) => {
        const brl = s.items?.find((i) => i.total_value?.currency_code === "BRL");
        revenueCompletedCents = brl ? Math.round(brl.total_value.value * 100) : 0;
      }).catch(() => {}),

      // Previsto — APPROVED onde data_compra + 7 dias cai dentro do mês
      // Usa fullMonthEnd (sempre o fim real do mês, não "now") para capturar
      // todas as compras cujo prazo de liquidação cai dentro do mês selecionado.
      // O filtro APPROVED exclui automaticamente o que já liquidou.
      hotmartRequest<HotmartSalesSummaryResponse>(
        "/payments/api/v1/sales/summary",
        {
          params: {
            ...(productId ? { product_id: productId } : {}),
            transaction_status: "APPROVED",
            start_date: startOfMonthMs - SETTLE_DAYS_MS,
            end_date: fullMonthEndMs - SETTLE_DAYS_MS,
          },
        },
      ).then((s) => {
        const brl = s.items?.find((i) => i.total_value?.currency_code === "BRL");
        revenueApprovedCents = brl ? Math.round(brl.total_value.value * 100) : 0;
      }).catch(() => {}),
    ]);

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
      refundedSubscribers: refunded,
      pastDueSubscribers: pastDue,
      pendingSubscribers: pending,
      totalSubscribers: total,
      newThisMonth,
      cancelledThisMonth,
      revenueThisMonthCents: revenueApprovedThisMonthCents + revenueCompletedCents,
      revenueApprovedCents,
      revenueCompletedCents,
      periodLabel: `${monthNames[month - 1]} ${year}`,
      lastSyncAt: null,
    });
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao calcular métricas", detail: String(error) },
      { status: 500 },
    );
  }
}
