import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/subscription-metrics
 * Retorna métricas reais de assinatura agregadas do banco de dados.
 */
export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Parallel queries for all metrics
    const [
      activeCount,
      cancelledCount,
      pastDueCount,
      totalCount,
      revenueResult,
      cancelledThisMonth,
      newThisMonth,
      lastWebhook,
    ] = await Promise.all([
      // Active subscriptions
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      // All-time cancelled
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
      // Past due
      prisma.subscription.count({ where: { status: "PAST_DUE" } }),
      // Total subscriptions ever
      prisma.subscription.count(),
      // Revenue this month (sum of paid charges)
      prisma.subscriptionCharge.aggregate({
        _sum: { amountCents: true },
        where: {
          status: "PAID",
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      // Cancelled this month
      prisma.subscription.count({
        where: {
          status: "CANCELLED",
          cancelledAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      // New subscriptions this month
      prisma.subscription.count({
        where: {
          startedAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      // Last webhook received
      prisma.hotmartWebhookEvent.findFirst({
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true },
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
    const periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    return NextResponse.json({
      activeSubscribers: activeCount,
      canceledSubscribers: cancelledCount,
      pastDueSubscribers: pastDueCount,
      totalSubscribers: totalCount,
      newThisMonth,
      cancelledThisMonth,
      revenueThisMonthCents: revenueResult._sum.amountCents ?? 0,
      periodLabel,
      lastSyncAt: lastWebhook?.receivedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[admin/subscription-metrics] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao calcular métricas", detail: String(error) },
      { status: 500 },
    );
  }
}
