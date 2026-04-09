/**
 * GET   /api/admin/users — Lista usuários com filtros
 * POST  /api/admin/users — Cria um novo usuário (retorna senha one-time)
 * PATCH /api/admin/users — Atualiza status ou role de um usuário
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { sendOnboardingEmail } from "@/lib/email/onboarding";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — Lista paginada de usuários
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
  const status = searchParams.get("status"); // ACTIVE, INACTIVE, SUSPENDED
  const role = searchParams.get("role"); // ADMIN, USER
  const search = searchParams.get("search"); // email or name partial match
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  // Exclude LGPD-deleted users by default
  where.deletedAt = null;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: where as never,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            subscriptions: { where: { status: "ACTIVE" } },
            accessGrants: true,
          },
        },
        subscriptions: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            cancelledAt: true,
            endedAt: true,
            plan: { select: { name: true } },
            charges: {
              select: { status: true, paidAt: true, chargeAt: true },
              orderBy: { createdAt: "desc" as const },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" as const },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: where as never }),
  ]);

  return NextResponse.json({
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ---------------------------------------------------------------------------
// PATCH — Atualiza status ou role de um usuário
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { userId, status, role } = body as {
    userId?: string;
    status?: string;
    role?: string;
  };

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const adminId = auth.userId;
  const before = { status: user.status, role: user.role };
  const data: Record<string, unknown> = {};

  if (status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
    data.status = status;
  }
  if (role && ["ADMIN", "USER"].includes(role)) {
    data.role = role;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: data as never,
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      actorId: adminId,
      action: "USER_STATUS_CHANGED",
      entityType: "User",
      entityId: userId,
      before,
      after: data as Record<string, string>,
    },
  });

  return NextResponse.json({ user: updated });
}

// ---------------------------------------------------------------------------
// POST — Cria novo usuário com senha aleatória (one-time see)
// ---------------------------------------------------------------------------

function generatePassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const {
    email,
    name,
    role: userRole,
    sendEmail: shouldSendEmail,
  } = body as {
    email?: string;
    name?: string;
    role?: string;
    sendEmail?: boolean;
  };

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 },
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check for duplicates
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 },
    );
  }

  const assignedRole =
    userRole === "ADMIN" ? "ADMIN" : ("USER" as "ADMIN" | "USER");

  // When sendEmail is true, create user without password and send onboarding email.
  // Otherwise, generate a random password and return it once (legacy flow).
  let plainPassword: string | null = null;
  let passwordHash: string | null = null;

  if (!shouldSendEmail) {
    plainPassword = generatePassword();
    passwordHash = await bcrypt.hash(plainPassword, 10);
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || null,
      role: assignedRole,
      status: "ACTIVE",
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      actorId: auth.userId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      after: {
        email: user.email,
        role: user.role,
        onboardingEmailSent: !!shouldSendEmail,
      },
    },
  });

  // Send onboarding email if requested
  let emailSent = false;
  if (shouldSendEmail) {
    const result = await sendOnboardingEmail({
      userId: user.id,
      force: true, // User just created, always send
    });
    emailSent = result.sent;
  }

  // Return password once (legacy) or email status (new flow)
  return NextResponse.json(
    {
      user,
      ...(plainPassword ? { password: plainPassword } : {}),
      ...(shouldSendEmail ? { emailSent } : {}),
    },
    { status: 201 },
  );
}
