import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";

/**
 * GET /api/admin/subscribers
 * Lista assinantes a partir do banco de dados local (Subscription + User).
 * Independente de provider externo (Hotmart, Stripe, etc).
 *
 * Query params:
 *   status=active|canceled|past_due|pending|expired
 *   search=<termo>       busca por nome ou email
 *   limit=50             itens por página (max 200)
 *   page=1               número da página
 *   source=hotmart|manual|invite  (opcional) filtra por origem
 */

const STATUS_MAP: Record<string, string> = {
  ACTIVE: "ACTIVE",
  CANCELED: "CANCELLED",
  CANCELLED: "CANCELLED",
  PAST_DUE: "PAST_DUE",
  PENDING: "PENDING",
  EXPIRED: "EXPIRED",
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status")?.toUpperCase();
  const search = url.searchParams.get("search");
  const source = url.searchParams.get("source");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")),
  );

  try {
    // Build where clause
    const where: Record<string, unknown> = {};

    if (statusFilter && STATUS_MAP[statusFilter]) {
      where.status = STATUS_MAP[statusFilter];
    }

    if (source) {
      where.source = source;
    }

    if (search) {
      const q = search.toLowerCase();
      where.user = {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          plan: {
            select: {
              id: true,
              code: true,
              name: true,
              displayPrice: true,
              periodicity: true,
            },
          },
          hotmart: { select: { subscriberCode: true, externalStatus: true } },
          charges: {
            orderBy: { paidAt: "desc" },
            take: 1,
            select: { paidAt: true, amountCents: true, currency: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    const subscribers = subscriptions.map((sub) => ({
      id: sub.id,
      name: sub.user.name ?? null,
      email: sub.user.email ?? null,
      status: sub.status,
      plan: {
        id: sub.plan.id,
        code: sub.plan.code,
        name: sub.plan.name,
        displayPrice: sub.plan.displayPrice ?? null,
        periodicity: sub.plan.periodicity ?? null,
      },
      source: sub.source,
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
