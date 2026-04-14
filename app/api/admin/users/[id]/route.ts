/**
 * GET    /api/admin/users/[id] — Detalhe completo de um usuário
 * POST   /api/admin/users/[id] — Reset password (retorna senha one-time)
 * PATCH  /api/admin/users/[id] — Atualiza nome/email de um usuário sem assinatura
 * DELETE /api/admin/users/[id] — Exclui usuário sem assinatura (subscribers: 403)
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { resolveUserAccess } from "@/lib/access/resolver";
import { createLogger } from "@/lib/logger";
import { sendEmail, buildWelcomePasswordEmail } from "@/lib/email";

const log = createLogger("api/admin/users/[id]");

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
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const plainPassword = generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  // Send email with the new password
  const loginUrl = `${process.env.NEXTAUTH_URL ?? "https://hyppado.com"}/login`;
  const displayName = user.name || user.email.split("@")[0];
  const template = buildWelcomePasswordEmail({
    name: displayName,
    email: user.email,
    password: plainPassword,
    loginUrl,
  });

  const emailResult = await sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  }).catch((err) => {
    log.error("Failed to send password reset email", {
      userId: id,
      error: err instanceof Error ? err.message : "Unknown",
    });
    return { success: false } as const;
  });

  await prisma.auditLog.create({
    data: {
      userId: id,
      actorId: auth.userId,
      action: "USER_PASSWORD_RESET",
      entityType: "User",
      entityId: id,
      after: { emailSent: emailResult.success },
    },
  });

  log.info("Password reset by admin", {
    userId: id,
    adminId: auth.userId,
    emailSent: emailResult.success,
  });

  return NextResponse.json({
    ok: true,
    emailSent: emailResult.success,
  });
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

// ---------------------------------------------------------------------------
// DELETE — Exclui usuário sem assinatura
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { id } = await params;

  // Prevent self-deletion
  if (id === auth.userId) {
    return NextResponse.json(
      { error: "Não é possível excluir a própria conta" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscriptions: { take: 1 },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Subscribers cannot be deleted — only deactivated (via PATCH status)
  if (user.subscriptions.length > 0) {
    return NextResponse.json(
      {
        error:
          "Assinantes não podem ser excluídos. Use a opção de desativar para impedir o acesso.",
      },
      { status: 403 },
    );
  }

  // Hard delete non-subscriber user and related data.
  // Models with onDelete: Cascade (auto) — ExternalAccountLink, ConsentRecord,
  // DataErasureRequest, SavedItem, Collection (+items), Note, Alert, VideoInsight.
  // Models with onDelete: SetNull (auto) — AuditLog, AdminNotification.
  // Models with Restrict (manual cleanup required) — AccessGrant, UsagePeriod, UsageEvent.
  await prisma.$transaction(async (tx) => {
    await tx.usageEvent.deleteMany({ where: { userId: id } });
    await tx.usagePeriod.deleteMany({ where: { userId: id } });
    await tx.accessGrant.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });

  // Audit log (actor-level, not user-level since user is gone)
  await prisma.auditLog.create({
    data: {
      actorId: auth.userId,
      action: "USER_DELETED",
      entityType: "User",
      entityId: id,
      after: { email: user.email, name: user.name },
    },
  });

  log.info("User deleted by admin", {
    deletedUserId: id,
    deletedEmail: user.email,
    adminId: auth.userId,
  });

  return NextResponse.json({ success: true });
}
