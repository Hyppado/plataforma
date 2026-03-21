import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/user/subscription?userId=<id>
 *   OR ?email=<email>
 *
 * Returns the active (or most recent) subscription for a user, including
 * plan details, member info, and billing history (last 12 charges).
 *
 * TODO: when auth is added, derive userId from the session cookie instead
 * of accepting it as a query param.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");

  if (!userId && !email) {
    return NextResponse.json(
      { error: "userId or email is required" },
      { status: 400 },
    );
  }

  // Resolve user
  let user: { id: string; name: string | null; email: string } | null = null;

  if (userId) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
  } else if (email) {
    user = await prisma.user.findUnique({
      where: { email: email! },
      select: { id: true, name: true, email: true },
    });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch most recent active subscription (falls back to any most recent)
  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: [
      // ACTIVE first, then by most recently started
      { status: "asc" },
      { startedAt: "desc" },
    ],
    include: {
      plan: true,
      hotmart: true,
      charges: {
        orderBy: { paidAt: "desc" },
        take: 12,
      },
    },
  });

  // Hotmart identity
  const hotmartIdentity = await prisma.hotmartIdentity.findUnique({
    where: { userId: user.id },
  });

  // Build status label
  const statusLabel = mapStatus(subscription?.status ?? null);

  // Build billing history
  const billingHistory = (subscription?.charges ?? []).map((charge) => ({
    id: charge.id,
    createdAt: (charge.paidAt ?? charge.createdAt).toISOString(),
    type: mapChargeType(charge.status),
    status: mapChargeStatus(charge.status),
    reference: charge.transactionId ?? charge.id,
    amountCents: charge.amountCents ?? 0,
    currency: charge.currency,
  }));

  // Hotmart integration state: "connected" if we have an identity record
  const hotmartConnected = !!hotmartIdentity;

  return NextResponse.json({
    member: {
      name: user.name,
      email: user.email,
    },
    subscription: subscription
      ? {
          planName: subscription.plan.name,
          planCode: subscription.plan.code,
          billingCycle:
            subscription.plan.periodicity === "ANNUAL" ? "Anual" : "Mensal",
          displayPrice: subscription.plan.displayPrice,
          status: statusLabel,
          startedAt: subscription.startedAt?.toISOString() ?? null,
          nextRenewalAt: subscription.nextChargeAt?.toISOString() ?? null,
          cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
          productName: `Hyppado — ${subscription.plan.name}`,
          // Quotas
          transcriptsPerMonth: subscription.plan.transcriptsPerMonth,
          scriptsPerMonth: subscription.plan.scriptsPerMonth,
          insightTokensMonthlyMax: subscription.plan.insightTokensMonthlyMax,
          scriptTokensMonthlyMax: subscription.plan.scriptTokensMonthlyMax,
        }
      : null,
    billingHistory,
    hotmartIntegration: {
      connected: hotmartConnected,
      webhookConfigured: true, // always true — webhook endpoint is always live
      subscriberCode: hotmartIdentity?.subscriberCode ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SubStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED"
  | null;

function mapStatus(
  status: SubStatus,
): "Ativa" | "Cancelada" | "Em atraso" | "Em análise" {
  switch (status) {
    case "ACTIVE":
      return "Ativa";
    case "CANCELLED":
    case "EXPIRED":
      return "Cancelada";
    case "PAST_DUE":
      return "Em atraso";
    default:
      return "Em análise";
  }
}

type ChargeStatus =
  | "PENDING"
  | "PAID"
  | "REFUNDED"
  | "CANCELLED"
  | "CHARGEBACK"
  | "FAILED";

function mapChargeType(
  status: ChargeStatus,
): "Cobrança" | "Renovação" | "Cancelamento" | "Reembolso" {
  switch (status) {
    case "REFUNDED":
    case "CHARGEBACK":
      return "Reembolso";
    case "CANCELLED":
      return "Cancelamento";
    case "PAID":
      return "Renovação";
    default:
      return "Cobrança";
  }
}

function mapChargeStatus(
  status: ChargeStatus,
): "Aprovado" | "Pendente" | "Recusado" | "Estornado" {
  switch (status) {
    case "PAID":
      return "Aprovado";
    case "REFUNDED":
      return "Estornado";
    case "CHARGEBACK":
      return "Estornado";
    case "CANCELLED":
      return "Recusado";
    case "FAILED":
      return "Recusado";
    default:
      return "Pendente";
  }
}
