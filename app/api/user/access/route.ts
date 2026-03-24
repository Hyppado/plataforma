/**
 * GET /api/user/access — Retorna o status de acesso do usuário logado
 *
 * Usa o AccessResolver para computar o acesso efetivo a partir de:
 *   UserStatus + AccessGrant + SubscriptionStatus
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveUserAccess } from "@/lib/access/resolver";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const access = await resolveUserAccess(userId);

  return NextResponse.json({
    status: access.status,
    source: access.source,
    plan: access.plan
      ? {
          name: access.plan.name,
          code: access.plan.code,
          displayPrice: access.plan.displayPrice,
        }
      : null,
    expiresAt: access.expiresAt?.toISOString() ?? null,
    reason: access.reason,
    quotas: access.quotas,
  });
}
