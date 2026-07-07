/**
 * GET   /api/admin/users — Lista usuários com filtros
 * POST  /api/admin/users — Cria um novo usuário e envia senha temporária por email
 * PATCH /api/admin/users — Atualiza status ou role de um usuário
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import {
  sendEmail,
  buildWelcomePasswordEmail,
  getEmailBaseUrl,
} from "@/lib/email";
import { createLogger } from "@/lib/logger";
import {
  deriveAccountState,
  deriveAccountType,
  accountHasAccess,
  matchesFilterGroup,
  matchesTypeFilter,
  isAccountFilterGroup,
  isAccountTypeFilter,
  type AccountState,
  type AccountType,
} from "@/lib/admin/account-state";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — Lista paginada de usuários com estado de acesso efetivo
// ---------------------------------------------------------------------------

/** First day of the current month at 00:00 UTC — matches UsagePeriod.periodStart. */
function currentMonthStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
  const role = searchParams.get("role"); // ADMIN, USER
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const accessParam = searchParams.get("access"); // effective-state filter group
  const accessGroup = isAccountFilterGroup(accessParam) ? accessParam : "all";
  const typeParam = searchParams.get("type"); // account-type filter
  const typeFilter = isAccountTypeFilter(typeParam) ? typeParam : "all";

  // Exclude LGPD-deleted users. The effective access state and the aggregate
  // summary depend on subscription/grant/charge data that cannot be expressed
  // as a single Prisma `where`, so we fetch the (admin-scale) dataset once and
  // derive/aggregate/paginate in memory.
  const where: Record<string, unknown> = { deletedAt: null };
  if (role) where.role = role;

  const monthStart = currentMonthStartUtc();

  try {
    const rawUsers = await prisma.user.findMany({
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
            subscriptions: true,
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
          // Order by status ASC so ACTIVE sorts before CANCELLED/EXPIRED,
          // then by createdAt DESC to get the newest within each status.
          orderBy: [{ status: "asc" as const }, { createdAt: "desc" as const }],
          take: 1,
        },
        accessGrants: {
          select: {
            isActive: true,
            expiresAt: true,
            grantedBy: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" as const },
        },
        usagePeriods: {
          where: { periodStart: monthStart },
          select: {
            transcriptsUsed: true,
            scriptsUsed: true,
            insightsUsed: true,
            avatarVideosUsed: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    type RawUser = (typeof rawUsers)[number];

    const now = Date.now();

    // Resolve the admins who created/granted access (for the "Origem" column).
    const creatorIds = Array.from(
      new Set(
        rawUsers
          .map((u) => (u.accessGrants ?? [])[0]?.grantedBy)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const creators = creatorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorById = new Map(creators.map((c) => [c.id, c]));

    const enriched = rawUsers.map((u: RawUser) => {
      const subscriptions = u.subscriptions ?? [];
      const accessGrants = u.accessGrants ?? [];
      const usagePeriods = u.usagePeriods ?? [];
      const sub = subscriptions[0] ?? null;
      const latestChargeStatus = sub?.charges?.[0]?.status ?? null;
      const hasActiveGrant = accessGrants.some(
        (g) =>
          g.isActive &&
          (g.expiresAt == null || new Date(g.expiresAt).getTime() > now),
      );
      const accountState: AccountState = deriveAccountState({
        userStatus: u.status,
        subscriptionStatus: sub?.status ?? null,
        subscriptionEndedAt: sub?.endedAt ?? null,
        latestChargeStatus,
        hasActiveGrant,
      });
      // `createdByAdmin` includes revoked grants so the "admin origin" + creator
      // info persists even after a courtesy user subscribes (grant gets revoked).
      const createdByAdmin = accessGrants.length > 0;
      const hasSubscription = subscriptions.length > 0;
      const accountType: AccountType = deriveAccountType({
        role: u.role,
        hasSubscription,
        hasActiveGrant,
      });
      const firstGrant = accessGrants[0];
      const creator = firstGrant?.grantedBy
        ? (creatorById.get(firstGrant.grantedBy) ?? null)
        : null;
      const origin: "admin" | "hotmart" | "none" = createdByAdmin
        ? "admin"
        : sub
          ? "hotmart"
          : "none";
      const usagePeriod = usagePeriods[0] ?? null;
      const usage = usagePeriod
        ? {
            transcripts: usagePeriod.transcriptsUsed,
            scripts: usagePeriod.scriptsUsed,
            insights: usagePeriod.insightsUsed,
            avatarVideos: usagePeriod.avatarVideosUsed,
          }
        : { transcripts: 0, scripts: 0, insights: 0, avatarVideos: 0 };

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        _count: u._count ?? { subscriptions: 0, accessGrants: 0 },
        subscriptions,
        accountState,
        accountType,
        hasAccess: accountHasAccess(accountState),
        createdByAdmin,
        origin,
        creator: creator ? { name: creator.name, email: creator.email } : null,
        usage,
      };
    });

    // Aggregate summary across the whole (filtered-by-role) dataset.
    const summary = {
      total: enriched.length,
      withAccess: 0,
      // access states
      active: 0,
      courtesy: 0,
      pastDue: 0,
      cancelling: 0,
      refunded: 0,
      cancelled: 0,
      expired: 0,
      noAccess: 0,
      inactive: 0,
      suspended: 0,
      // account types
      typeAdmin: 0,
      typeSubscriber: 0,
      typeCourtesy: 0,
      typeLead: 0,
    };
    for (const u of enriched) {
      if (u.hasAccess) summary.withAccess += 1;
      switch (u.accountType) {
        case "admin":
          summary.typeAdmin += 1;
          break;
        case "subscriber":
          summary.typeSubscriber += 1;
          break;
        case "courtesy":
          summary.typeCourtesy += 1;
          break;
        case "lead":
          summary.typeLead += 1;
          break;
      }
      switch (u.accountState) {
        case "ACTIVE":
          summary.active += 1;
          break;
        case "COURTESY":
          summary.courtesy += 1;
          break;
        case "PAST_DUE":
          summary.pastDue += 1;
          break;
        case "CANCELLING":
          summary.cancelling += 1;
          break;
        case "REFUNDED":
          summary.refunded += 1;
          break;
        case "CANCELLED":
          summary.cancelled += 1;
          break;
        case "EXPIRED":
          summary.expired += 1;
          break;
        case "INACTIVE":
          summary.inactive += 1;
          break;
        case "SUSPENDED":
          summary.suspended += 1;
          break;
        case "NO_ACCESS":
          summary.noAccess += 1;
          break;
      }
    }

    // Apply effective-state + type + search filters, then paginate in memory.
    const filtered = enriched.filter((u) => {
      if (!matchesFilterGroup(accessGroup, u.accountState)) return false;
      if (!matchesTypeFilter(typeFilter, u.accountType)) return false;
      if (search) {
        const haystack = `${u.name ?? ""} ${u.email}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const pageUsers = filtered.slice(skip, skip + limit);

    return NextResponse.json({
      users: pageUsers,
      summary,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
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

  try {
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
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Cria novo usuário, envia senha temporária por email
// ---------------------------------------------------------------------------

const log = createLogger("api/admin/users");

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
    planId,
  } = body as {
    email?: string;
    name?: string;
    role?: string;
    planId?: string;
  };

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 },
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check for duplicates
  try {
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

    // Generate temporary password — user must change on first login
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Create user + AccessGrant atomically
    const [user, accessGrant] = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: name?.trim() || null,
          role: assignedRole,
          status: "ACTIVE",
          passwordHash,
          mustChangePassword: true,
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

      const newGrant = await tx.accessGrant.create({
        data: {
          userId: newUser.id,
          grantedBy: auth.userId,
          reason: "Acesso concedido pelo admin ao criar conta",
          planId: planId || null,
          expiresAt: null,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      return [newUser, newGrant];
    });

    // Send welcome email with temporary password
    const loginUrl = `${getEmailBaseUrl()}/login`;
    const displayName = user.name ?? user.email.split("@")[0];
    const emailTemplate = buildWelcomePasswordEmail({
      name: displayName,
      email: user.email,
      password: plainPassword,
      loginUrl,
    });

    const emailResult = await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!emailResult.success) {
      log.warn("Welcome email failed", {
        userId: user.id,
        email: user.email,
        error: emailResult.error,
      });
    }

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
          welcomeEmailSent: emailResult.success,
        },
      },
    });

    return NextResponse.json(
      {
        user,
        accessGrantId: accessGrant.id,
        emailSent: emailResult.success,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
