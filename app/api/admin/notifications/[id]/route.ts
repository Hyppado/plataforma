/**
 * PATCH /api/admin/notifications/[id] — Atualiza status de uma notificação
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { status } = body as { status: string };

  if (!["READ", "ARCHIVED", "UNREAD"].includes(status)) {
    return NextResponse.json(
      { error: "status deve ser UNREAD, READ ou ARCHIVED." },
      { status: 400 },
    );
  }

  const notification = await prisma.adminNotification.findUnique({
    where: { id: params.id },
  });

  if (!notification) {
    return NextResponse.json(
      { error: "Notificação não encontrada." },
      { status: 404 },
    );
  }

  const updated = await prisma.adminNotification.update({
    where: { id: params.id },
    data: {
      status: status as "UNREAD" | "READ" | "ARCHIVED",
      ...(status === "ARCHIVED"
        ? { resolvedAt: new Date(), resolvedBy: auth.session.user.id }
        : {}),
    },
  });

  return NextResponse.json(updated);
}
