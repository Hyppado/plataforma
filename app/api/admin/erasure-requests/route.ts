/**
 * GET  /api/admin/erasure-requests — Lista pedidos LGPD
 * POST /api/admin/erasure-requests — Processa ou rejeita pedido
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { processErasure, rejectErasure } from "@/lib/lgpd/erasure";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — Lista erasure requests
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status"); // PENDING, IN_PROGRESS, COMPLETED, REJECTED

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const requests = await prisma.dataErasureRequest.findMany({
    where: where as never,
    include: {
      user: { select: { id: true, email: true, name: true, status: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json({ requests });
}

// ---------------------------------------------------------------------------
// POST — Processa ou rejeita pedido
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { requestId, action, reason } = body as {
    requestId?: string;
    action?: "approve" | "reject";
    reason?: string;
  };

  if (!requestId || !action) {
    return NextResponse.json(
      { error: "requestId and action are required" },
      { status: 400 },
    );
  }

  const adminId = auth.userId;

  if (action === "approve") {
    try {
      const result = await processErasure(requestId, adminId);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  if (action === "reject") {
    if (!reason) {
      return NextResponse.json(
        { error: "reason is required when rejecting" },
        { status: 400 },
      );
    }
    await rejectErasure(requestId, adminId, reason);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
