/**
 * GET /api/user/access — Retorna o status de acesso do usuário logado
 *
 * Usa o AccessResolver para computar o acesso efetivo a partir de:
 *   UserStatus + AccessGrant + SubscriptionStatus
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { resolveUserAccess } from "@/lib/access/resolver";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const access = await resolveUserAccess(auth.userId);

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
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
