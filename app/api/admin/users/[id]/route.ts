/**
 * GET  /api/admin/users/[id] — Detalhe completo de um usuário
 * POST /api/admin/users/[id] — Reset password (retorna senha one-time)
 * PATCH /api/admin/users/[id] — Atualiza nome/email de um usuário sem assinatura
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { resolveUserAccess } from "@/lib/access/resolver";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscriptions: {
        include: { plan: true, hotmart: true },
        orderBy: { createdAt: "desc" },
      },
      accessGrants: {
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      },
      externalAccounts: true,
      consentRecords: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      erasureRequests: {
        orderBy: { requestedAt: "desc" },
      },
      _count: {
        select: {
          savedItems: true,
          collections: true,
          notes: true,
          usageEvents: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Resolve current access status
  const access = await resolveUserAccess(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      lgpdConsentAt: user.lgpdConsentAt,
      lgpdConsentVersion: user.lgpdConsentVersion,
      deletedAt: user.deletedAt,
    },
    access: {
      status: access.status,
      source: access.source,
      planName: access.plan?.name ?? null,
      expiresAt: access.expiresAt,
      reason: access.reason,
      quotas: access.quotas,
    },
    subscriptions: user.subscriptions,
    accessGrants: user.accessGrants,
    externalAccounts: user.externalAccounts,
    consentRecords: user.consentRecords,
    erasureRequests: user.erasureRequests,
    counts: user._count,
  });
}

// ---------------------------------------------------------------------------
// POST — Reset password (retorna senha one-time)
// ---------------------------------------------------------------------------

function generatePassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const plainPassword = generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      userId: id,
      actorId: auth.userId,
      action: "USER_PASSWORD_RESET",
      entityType: "User",
      entityId: id,
    },
  });

  return NextResponse.json({ password: plainPassword });
}

// ---------------------------------------------------------------------------
// PATCH — Atualiza nome/email de um usuário sem assinatura
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { id } = await params;

  const body = await req.json();
  const { name, email } = body as { name?: string; email?: string };

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscriptions: { where: { status: "ACTIVE" }, take: 1 },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Block editing users that came from subscriptions
  if (user.subscriptions.length > 0) {
    return NextResponse.json(
      { error: "Cannot edit a subscription-provisioned user" },
      { status: 403 },
    );
  }

  const data: Record<string, unknown> = {};
  const before: Record<string, string | null> = {};

  if (name !== undefined) {
    before.name = user.name;
    data.name = name.trim() || null;
  }
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== user.email) {
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 409 },
        );
      }
      before.email = user.email;
      data.email = normalizedEmail;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: data as never,
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: id,
      actorId: auth.userId,
      action: "USER_EDITED",
      entityType: "User",
      entityId: id,
      before,
      after: data as Record<string, string>,
    },
  });

  return NextResponse.json({ user: updated });
}
