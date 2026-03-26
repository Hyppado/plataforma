/**
 * GET /api/admin/notifications/summary — Resumo de notificações
 * Retorna contadores: unread, critical, total
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const [unread, critical, total] = await Promise.all([
    prisma.adminNotification.count({
      where: { status: "UNREAD" },
    }),
    prisma.adminNotification.count({
      where: { severity: "CRITICAL", status: { not: "ARCHIVED" } },
    }),
    prisma.adminNotification.count(),
  ]);

  return NextResponse.json({ unread, critical, total });
}
