/**
 * GET  /api/admin/erasure-requests — Lista pedidos LGPD
 * POST /api/admin/erasure-requests — Processa ou rejeita pedido
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processErasure, rejectErasure } from "@/lib/lgpd/erasure";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — Lista erasure requests
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const adminId = (session.user as { id?: string }).id ?? "unknown";

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
