import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/subscribers
 * Retorna assinantes reais do banco de dados (populados via webhook Hotmart).
 *
 * Query params:
 *   status=active|canceled|past_due  (filtra por status)
 *   plan=<planCode>                  (filtra por plano)
 *   search=<termo>                   (busca por nome ou email)
 *   page=1                           (paginação, default 1)
 *   limit=50                         (itens por página, max 200)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status")?.toUpperCase();
  const planFilter = url.searchParams.get("plan");
  const search = url.searchParams.get("search");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")),
  );
  const skip = (page - 1) * limit;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    const statusMap: Record<string, string> = {
      ACTIVE: "ACTIVE",
      CANCELED: "CANCELLED",
      CANCELLED: "CANCELLED",
      PAST_DUE: "PAST_DUE",
      PENDING: "PENDING",
      EXPIRED: "EXPIRED",
    };

    if (statusFilter && statusMap[statusFilter]) {
      whereClause.status = statusMap[statusFilter];
    }

    if (planFilter) {
      whereClause.plan = { code: planFilter };
    }

    if (search) {
      whereClause.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const total = await prisma.subscription.count({ where: whereClause });

    const subscriptions = await prisma.subscription.findMany({
      where: whereClause,
      include: {
        user: {
          include: { hotmartIdentity: true },
        },
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            displayPrice: true,
            periodicity: true,
          },
        },
        hotmart: {
          select: {
            hotmartSubscriptionId: true,
            subscriberCode: true,
            externalStatus: true,
            buyerEmail: true,
          },
        },
        charges: {
          where: { status: "PAID" },
          orderBy: { paidAt: "desc" },
          take: 1,
          select: { paidAt: true, amountCents: true, currency: true },
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip,
      take: limit,
    });

    const subscribers = subscriptions.map((sub) => ({
      id: sub.id,
      name: sub.user.name,
      email: sub.user.email,
      status: sub.status === "CANCELLED" ? "CANCELED" : sub.status,
      plan: {
        id: sub.plan.id,
        code: sub.plan.code,
        name: sub.plan.name,
        displayPrice: sub.plan.displayPrice,
        periodicity: sub.plan.periodicity,
      },
      subscriberCode: sub.hotmart?.subscriberCode ?? null,
      hotmartStatus: sub.hotmart?.externalStatus ?? null,
      startedAt: sub.startedAt?.toISOString() ?? null,
      cancelledAt: sub.cancelledAt?.toISOString() ?? null,
      lastPaymentAt: sub.charges[0]?.paidAt?.toISOString() ?? null,
      lastPaymentAmount: sub.charges[0]?.amountCents ?? null,
      lastPaymentCurrency: sub.charges[0]?.currency ?? "BRL",
      createdAt: sub.createdAt.toISOString(),
    }));

    return NextResponse.json({
      subscribers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[admin/subscribers] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar assinantes", detail: String(error) },
      { status: 500 },
    );
  }
}
