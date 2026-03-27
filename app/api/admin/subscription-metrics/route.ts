import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/admin/subscription-metrics");

/**
 * GET /api/admin/subscription-metrics
 * Calcula métricas de assinatura a partir do banco de dados local.
 * Independente de provider externo.
 */

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      active,
      cancelled,
      pastDue,
      total,
      newThisMonth,
      cancelledThisMonth,
      revenueAgg,
      lastSync,
    ] = await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
      prisma.subscription.count({
        where: { status: { in: ["PAST_DUE", "PENDING"] } },
      }),
      prisma.subscription.count(),
      prisma.subscription.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.subscription.count({
        where: {
          status: "CANCELLED",
          cancelledAt: { gte: startOfMonth },
        },
      }),
      prisma.subscriptionCharge.aggregate({
        _sum: { amountCents: true },
        where: { paidAt: { gte: startOfMonth } },
      }),
      prisma.subscription.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
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
      pastDueSubscribers: pastDue,
      totalSubscribers: total,
      newThisMonth,
      cancelledThisMonth,
      revenueThisMonthCents: revenueAgg._sum.amountCents ?? 0,
      periodLabel: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      lastSyncAt: lastSync?.updatedAt?.toISOString() ?? null,
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
