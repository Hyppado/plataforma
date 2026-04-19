import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { hotmartRequest } from "@/lib/hotmart/client";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { createLogger } from "@/lib/logger";

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
  } catch {
    return 0;
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const productId = await getSetting(SETTING_KEYS.HOTMART_PRODUCT_ID);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthMs = startOfMonth.getTime();

    // Parallel calls to get counts by status + recent active subscriptions
    const [
      active,
      cancelledByCustomer,
      cancelledBySeller,
      cancelledByAdmin,
      delayed,
      overdue,
      inactive,
      started,
      expired,
    ] = await Promise.all([
      countByStatus("ACTIVE", productId),
      countByStatus("CANCELLED_BY_CUSTOMER", productId),
      countByStatus("CANCELLED_BY_SELLER", productId),
      countByStatus("CANCELLED_BY_ADMIN", productId),
      countByStatus("DELAYED", productId),
      countByStatus("OVERDUE", productId),
      countByStatus("INACTIVE", productId),
      countByStatus("STARTED", productId),
      countByStatus("EXPIRED", productId),
    ]);

    const cancelled = cancelledByCustomer + cancelledBySeller;
    const refunded = cancelledByAdmin;
    const pastDue = delayed + overdue;
    const pending = started + expired;
    const total = active + cancelled + refunded + pastDue + inactive + pending;

    // Fetch recent subscriptions to compute "new this month" and "cancelled this month"
    // We get active subs with accession_date filter for new this month
    const recentParams: Record<string, string | number> = {
      max_results: 200,
    };
    if (productId) recentParams.product_id = productId;

    let newThisMonth = 0;
    let cancelledThisMonth = 0;

    try {
      // Get subscriptions created this month (any status, accession_date >= start of month)
      const recentData = await hotmartRequest<HotmartSubscriptionsResponse>(
        "/payments/api/v1/subscriptions",
        {
          params: {
            ...recentParams,
            accession_date: startOfMonthMs,
          },
        },
      );
      newThisMonth =
        recentData.page_info?.total_results ?? recentData.items?.length ?? 0;
    } catch {
      // Silent fallback
    }

    try {
      // Get cancelled subscriptions this month
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
      revenueThisMonthCents: 0,
      periodLabel: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
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
