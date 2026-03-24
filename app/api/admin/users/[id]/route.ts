/**
 * GET /api/admin/users/[id] — Detalhe completo de um usuário
 *
 * Retorna: User + subscriptions + accessGrants + usage + hotmart identity
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveUserAccess } from "@/lib/access/resolver";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      hotmartIdentity: true,
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
    hotmartIdentity: user.hotmartIdentity,
    consentRecords: user.consentRecords,
    erasureRequests: user.erasureRequests,
    counts: user._count,
  });
}
