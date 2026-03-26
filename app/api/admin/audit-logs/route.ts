/**
 * GET /api/admin/audit-logs — Lista audit logs com filtros e paginação
 *
 * Filtros:
 *   ?page=1&limit=20
 *   ?action=WEBHOOK_PURCHASE_APPROVED
 *   ?userId=xxx
 *   ?entityType=Subscription
 *   ?actorId=system
 *   ?from=2025-01-01&to=2025-12-31
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const entityType = searchParams.get("entityType");
  const actorId = searchParams.get("actorId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (userId) where.userId = userId;
  if (entityType) where.entityType = entityType;
  if (actorId) where.actorId = actorId;
  if (from || to) {
    where.occurredAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
