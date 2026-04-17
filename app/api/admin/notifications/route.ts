/**
 * GET  /api/admin/notifications — Lista notificações admin com filtros
 * PATCH /api/admin/notifications — Bulk update de status
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — Lista notificações com filtros e paginação
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
  const status = searchParams.get("status"); // UNREAD, READ, ARCHIVED
  const severity = searchParams.get("severity"); // INFO, WARNING, HIGH, CRITICAL
  const type = searchParams.get("type");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (type) where.type = type;

  try {
    const [items, total] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true, status: true } },
          subscription: {
            select: {
              id: true,
              status: true,
              source: true,
              startedAt: true,
              plan: { select: { name: true, hotmartPlanCode: true } },
              hotmart: {
                select: {
                  subscriberCode: true,
                  hotmartSubscriptionId: true,
                  buyerEmail: true,
                  externalStatus: true,
                },
              },
            },
          },
          event: {
            select: {
              id: true,
              eventType: true,
              processingStatus: true,
              transactionId: true,
              subscriberCode: true,
              buyerEmail: true,
              productId: true,
              amountCents: true,
              occurredAt: true,
              receivedAt: true,
              processedAt: true,
              errorMessage: true,
            },
          },
        },
      }),
      prisma.adminNotification.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — Bulk update de status (marcar múltiplas como READ/ARCHIVED)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { ids, status } = body as { ids: string[]; status: string };

  if (
    !ids ||
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !["READ", "ARCHIVED", "UNREAD"].includes(status)
  ) {
    return NextResponse.json(
      {
        error: "ids (array) e status (UNREAD|READ|ARCHIVED) são obrigatórios.",
      },
      { status: 400 },
    );
  }

  try {
    const now = new Date();
    const result = await prisma.adminNotification.updateMany({
      where: { id: { in: ids } },
      data: {
        status: status as "UNREAD" | "READ" | "ARCHIVED",
        ...(status === "READ" ? { readAt: now } : {}),
        ...(status === "ARCHIVED" ? { archivedAt: now, resolvedAt: now } : {}),
        ...(status === "UNREAD" ? { readAt: null, archivedAt: null } : {}),
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
