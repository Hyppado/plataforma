/**
 * POST /api/admin/hotmart/reset-resync
 *
 * Limpa todos os dados de planos e assinaturas do banco e reimporta da Hotmart.
 * Usa o HOTMART_PRODUCT_ID configurado no painel admin.
 *
 * ⚠️  Operação destrutiva — use apenas em preview/dev quando o product_id mudar.
 *
 * Fluxo:
 *   1. Delete SubscriptionCharge → HotmartSubscription → Subscription → Plan
 *   2. Sync plans da Hotmart para o novo product
 *   3. Paginar todos os subscribers da Hotmart e criar User + Subscription + HotmartSubscription
 *
 * Auth: requireAdmin()
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { hotmartRequest } from "@/lib/hotmart/client";
import {
  getProductByNumericId,
  syncPlansFromHotmart,
} from "@/lib/hotmart/plans";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const log = createLogger("api/admin/hotmart/reset-resync");

// ── Hotmart subscription types ──────────────────────────────────────────────

interface HotmartSubscriber {
  name: string;
  email: string;
  ucode: string;
}

interface HotmartPlan {
  id: number;
  name: string;
  recurrency_period?: string;
}

interface HotmartPrice {
  value: number;
  currency_code: string;
}

interface HotmartSubscriptionItem {
  subscriber_code: string;
  subscription_id: number;
  status: string;
  accession_date: number;
  end_date?: number;
  date_next_charge?: number;
  plan: HotmartPlan;
  price: HotmartPrice;
  subscriber: HotmartSubscriber;
}

interface HotmartSubscriptionsResponse {
  items: HotmartSubscriptionItem[];
  page_info: {
    total_results: number;
    next_page_token?: string;
    results_per_page: number;
  };
}

// ── Status mapping ──────────────────────────────────────────────────────────

function mapStatus(
  hotmartStatus: string,
): "ACTIVE" | "CANCELLED" | "PAST_DUE" | "EXPIRED" | "PENDING" {
  switch (hotmartStatus) {
    case "ACTIVE":
      return "ACTIVE";
    case "CANCELLED_BY_CUSTOMER":
    case "CANCELLED_BY_SELLER":
    case "CANCELLED_BY_ADMIN":
      return "CANCELLED";
    case "DELAYED":
    case "OVERDUE":
      return "PAST_DUE";
    case "INACTIVE":
      return "EXPIRED";
    case "STARTED":
    default:
      return "PENDING";
  }
}

// ── Step 1: Clear billing tables ────────────────────────────────────────────

async function clearBillingTables(): Promise<{
  charges: number;
  hotmartSubs: number;
  subscriptions: number;
  plans: number;
}> {
  // 1. Null out optional plan references in AccessGrant to avoid FK violation
  await prisma.accessGrant.updateMany({
    where: { planId: { not: null } },
    data: { planId: null },
  });

  // 2. Delete Subscription — HotmartSubscription and SubscriptionCharge cascade automatically
  const subscriptions = await prisma.subscription.deleteMany({});

  // 3. Delete Plans (no remaining FKs after step 1)
  const plans = await prisma.plan.deleteMany({});

  return {
    charges: 0, // cascaded from Subscription
    hotmartSubs: 0, // cascaded from Subscription
    subscriptions: subscriptions.count,
    plans: plans.count,
  };
}

// ── Step 3: Import all subscribers ─────────────────────────────────────────

async function importSubscribers(productId: string): Promise<{
  total: number;
  imported: number;
  skipped: number;
  errors: number;
}> {
  let pageToken: string | undefined;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let total = 0;
  let page = 0;

  do {
    page++;
    const params: Record<string, string | number> = {
      max_results: 200,
      product_id: productId,
    };
    if (pageToken) params.page_token = pageToken;

    const data = await hotmartRequest<HotmartSubscriptionsResponse>(
      "/payments/api/v1/subscriptions",
      { params },
    );

    const items = data.items ?? [];
    if (page === 1) total = data.page_info?.total_results ?? items.length;
    pageToken = data.page_info?.next_page_token;

    log.info(`Processing page ${page}`, {
      count: items.length,
      total,
      nextPage: !!pageToken,
    });

    for (const item of items) {
      try {
        await importOne(item, productId);
        imported++;
      } catch (err) {
        errors++;
        log.warn("Failed to import subscriber", {
          subscriberCode: item.subscriber_code,
          email: item.subscriber?.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } while (pageToken);

  return { total, imported, skipped, errors };
}

async function importOne(
  item: HotmartSubscriptionItem,
  productId: string,
): Promise<void> {
  const email = item.subscriber?.email;
  if (!email) {
    throw new Error("No email on subscriber");
  }

  const status = mapStatus(item.status);
  const planCode = String(item.plan?.id ?? "");
  const planName = item.plan?.name ?? planCode;

  // 1. Upsert User
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: item.subscriber?.name ?? email.split("@")[0],
      role: "USER",
      status: "ACTIVE",
    },
  });

  // 2. Upsert ExternalAccountLink
  const existingLink = await prisma.externalAccountLink.findFirst({
    where: { provider: "hotmart", OR: [{ externalEmail: email }] },
  });

  if (!existingLink) {
    await prisma.externalAccountLink.create({
      data: {
        userId: user.id,
        provider: "hotmart",
        externalCustomerId: item.subscriber_code ?? undefined,
        externalEmail: email,
        linkConfidence: "auto_email",
        linkMethod: "resync",
      },
    });
  } else if (item.subscriber_code && !existingLink.externalCustomerId) {
    await prisma.externalAccountLink.update({
      where: { id: existingLink.id },
      data: { externalCustomerId: item.subscriber_code },
    });
  }

  // 3. Find or create Plan by hotmartPlanCode (already synced in step 2)
  let plan = await prisma.plan.findUnique({
    where: { hotmartPlanCode: planCode },
    select: { id: true },
  });

  if (!plan) {
    // Create minimal plan if plan sync missed it (e.g., plan no longer active on Hotmart)
    const periodicity: "MONTHLY" | "ANNUAL" =
      item.plan?.recurrency_period === "ANNUAL" ? "ANNUAL" : "MONTHLY";
    plan = await prisma.plan.create({
      data: {
        code: `hotmart_${planCode}`,
        name: planName,
        hotmartPlanCode: planCode,
        priceAmount: Math.round(item.price?.value ?? 0),
        currency: item.price?.currency_code ?? "BRL",
        periodicity,
        isActive: true,
        sortOrder: 0,
        features: [],
      },
    });
  }

  // 4. Upsert Subscription + HotmartSubscription
  const subscriberCode = item.subscriber_code;
  const subscriptionExternalId = String(item.subscription_id);

  const existing = await prisma.hotmartSubscription.findFirst({
    where: {
      OR: [
        { hotmartSubscriptionId: subscriptionExternalId },
        { subscriberCode },
      ],
    },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.subscriptionId },
      data: { status: status as never },
    });
    await prisma.hotmartSubscription.update({
      where: { id: existing.id },
      data: { externalStatus: item.status },
    });
    return;
  }

  const startedAt = item.accession_date
    ? new Date(
        item.accession_date < 10_000_000_000
          ? item.accession_date * 1000
          : item.accession_date,
      )
    : undefined;
  const endedAt = item.end_date
    ? new Date(
        item.end_date < 10_000_000_000 ? item.end_date * 1000 : item.end_date,
      )
    : undefined;
  const cancelledAt = ["CANCELLED", "EXPIRED"].includes(status)
    ? (endedAt ?? new Date())
    : undefined;

  const newSub = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: status as never,
      startedAt,
      cancelledAt,
      endedAt: cancelledAt,
    },
  });

  await prisma.hotmartSubscription.create({
    data: {
      subscriptionId: newSub.id,
      hotmartSubscriptionId: subscriptionExternalId,
      hotmartProductId: productId,
      hotmartPlanCode: planCode,
      buyerEmail: email,
      subscriberCode,
      externalStatus: item.status,
    },
  });
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const productId = await getSetting(SETTING_KEYS.HOTMART_PRODUCT_ID);
    if (!productId) {
      return NextResponse.json(
        { error: "HOTMART_PRODUCT_ID not configured in admin settings" },
        { status: 400 },
      );
    }

    log.info("Starting reset-resync", { productId });

    // Step 1: Clear billing tables
    const cleared = await clearBillingTables();
    log.info("Billing tables cleared", cleared);

    // Step 2: Sync plans from Hotmart
    let planSync = {
      created: 0,
      updated: 0,
      deactivated: 0,
      plans: [] as unknown[],
    };
    try {
      const product = await getProductByNumericId(parseInt(productId, 10));
      if (product) {
        planSync = await syncPlansFromHotmart(product.ucode);
        log.info("Plans synced", {
          created: planSync.created,
          updated: planSync.updated,
        });
      } else {
        log.warn("Product not found in Hotmart API", { productId });
      }
    } catch (err) {
      log.warn(
        "Plan sync failed — will create plans on-demand during subscriber import",
        {
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }

    // Step 3: Import all subscribers
    const importResult = await importSubscribers(productId);
    log.info("Subscriber import complete", importResult);

    return NextResponse.json({
      ok: true,
      cleared,
      planSync: {
        created: planSync.created,
        updated: planSync.updated,
        deactivated: planSync.deactivated,
      },
      subscribers: importResult,
    });
  } catch (error) {
    log.error("reset-resync failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "Falha no reset-resync",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
