/**
 * GET    /api/admin/access-grants — Lista access grants
 * POST   /api/admin/access-grants — Cria novo access grant
 * DELETE /api/admin/access-grants — Revoga access grant
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — Lista access grants
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  const activeOnly = searchParams.get("activeOnly") !== "false";

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (activeOnly) {
    where.isActive = true;
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  }

  const grants = await prisma.accessGrant.findMany({
    where: where as never,
    include: {
      user: { select: { id: true, email: true, name: true } },
      plan: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ grants });
}

// ---------------------------------------------------------------------------
// POST — Cria access grant
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { userId, reason, planId, expiresAt } = body as {
    userId?: string;
    reason?: string;
    planId?: string;
    expiresAt?: string;
  };

  if (!userId || !reason) {
    return NextResponse.json(
      { error: "userId and reason are required" },
      { status: 400 },
    );
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify plan if provided
  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
  }

  const adminId = auth.userId;

  const grant = await prisma.accessGrant.create({
    data: {
      userId,
      grantedBy: adminId,
      reason,
      planId: planId ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      plan: { select: { id: true, name: true, code: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      actorId: adminId,
      action: "ACCESS_GRANT_CREATED",
      entityType: "AccessGrant",
      entityId: grant.id,
      after: {
        reason,
        planId: planId ?? null,
        expiresAt: expiresAt ?? "permanent",
      },
    },
  });

  return NextResponse.json({ grant }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE — Revoga access grant
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { grantId } = body as { grantId?: string };

  if (!grantId) {
    return NextResponse.json({ error: "grantId is required" }, { status: 400 });
  }

  const grant = await prisma.accessGrant.findUnique({
    where: { id: grantId },
  });
  if (!grant) {
    return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  }

  const adminId = auth.userId;

  await prisma.accessGrant.update({
    where: { id: grantId },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedBy: adminId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: grant.userId,
      actorId: adminId,
      action: "ACCESS_GRANT_REVOKED",
      entityType: "AccessGrant",
      entityId: grantId,
      before: { isActive: true },
      after: { isActive: false },
    },
  });

  return NextResponse.json({ success: true });
}
