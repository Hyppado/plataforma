/**
 * scripts/import-subscribers.ts
 *
 * Fetches all subscribers from Hotmart API and provisions them
 * in the local database (User + ExternalAccountLink + Subscription + HotmartSubscription).
 *
 * Usage:
 *   npx tsx scripts/import-subscribers.ts
 *
 * Environment variables required:
 *   DATABASE_URL               — target database (preview or production)
 *   DATABASE_URL_UNPOOLED      — direct connection (optional, for Prisma)
 *   HOTMART_CLIENTE_ID         — Hotmart client ID
 *   HOTMART_CLIENT_SECRET      — Hotmart client secret
 *   HOTMART_BASIC              — Base64(client_id:client_secret)
 *   HOTMART_PRODUCT_ID         — Hotmart product ID (numeric)
 *
 * Optional:
 *   DRY_RUN=true               — log what would happen without writing to DB
 *   HOTMART_SANDBOX=true       — use Hotmart sandbox environment
 *
 * What it does:
 *   1. Fetches all subscriptions from Hotmart (paginated, all statuses)
 *   2. For each subscriber:
 *      - Upserts User by email
 *      - Upserts ExternalAccountLink (hotmart provider)
 *      - Resolves local Plan by planCode (auto-syncs from Hotmart if missing)
 *      - Upserts Subscription + HotmartSubscription
 *   3. Reports summary: created vs updated vs skipped
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "true";

// ---------------------------------------------------------------------------
// Hotmart API helpers (self-contained — no lib imports for script portability)
// ---------------------------------------------------------------------------

interface HotmartTokenResponse {
  access_token: string;
  expires_in: number;
}

async function getHotmartToken(): Promise<string> {
  const clientId = requireEnv("HOTMART_CLIENTE_ID");
  const clientSecret = requireEnv("HOTMART_CLIENT_SECRET");
  const basic = requireEnv("HOTMART_BASIC");

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(
    `https://api-sec-vlc.hotmart.com/security/oauth/token?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Hotmart OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as HotmartTokenResponse;
  return data.access_token;
}

async function hotmartGet<T>(
  token: string,
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  let url = `https://developers.hotmart.com${path}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const str = qs.toString();
    if (str) url += `?${str}`;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Hotmart API ${path}: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

function requireEnv(key: string): string {
  const v = process.env[key]?.trim();
  if (!v) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Hotmart API types
// ---------------------------------------------------------------------------

interface HotmartSubscriber {
  name: string;
  email: string;
  ucode: string;
}

interface HotmartPlan {
  name: string;
  id: number;
  recurrency_period?: string;
}

interface HotmartPrice {
  value: number;
  currency_code: string;
}

interface HotmartSubscription {
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
  items: HotmartSubscription[];
  page_info: {
    total_results: number;
    next_page_token?: string;
    results_per_page: number;
  };
}

interface HotmartProduct {
  id: number;
  ucode: string;
  name: string;
}

interface HotmartProductListResponse {
  items: HotmartProduct[];
}

interface HotmartPlanDetail {
  code: string;
  name: string;
  periodicity: string;
  price: { value: number; currency_code: string };
}

interface HotmartPlanListResponse {
  items: HotmartPlanDetail[];
}

// ---------------------------------------------------------------------------
// Plan resolution
// ---------------------------------------------------------------------------

/** Map Hotmart periodicity to our enum */
function mapPeriodicity(p: string): "MONTHLY" | "ANNUAL" {
  return p === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

/** Fetch Hotmart plans for a product and sync locally */
async function syncHotmartPlans(
  token: string,
  productUcode: string,
): Promise<void> {
  const data = await hotmartGet<HotmartPlanListResponse>(
    token,
    `/products/api/v1/products/${productUcode}/plans`,
  );

  for (const hp of data.items ?? []) {
    const existing = await prisma.plan.findUnique({
      where: { hotmartPlanCode: hp.code },
    });

    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          name: hp.name,
          priceAmount: Math.round(hp.price.value * 100),
          currency: hp.price.currency_code,
          periodicity: mapPeriodicity(hp.periodicity),
        },
      });
      console.log(`  📋 Plan updated: ${hp.name} (${hp.code})`);
    } else {
      await prisma.plan.create({
        data: {
          code: `hotmart_${hp.code}`,
          name: hp.name,
          priceAmount: Math.round(hp.price.value * 100),
          currency: hp.price.currency_code,
          periodicity: mapPeriodicity(hp.periodicity),
          hotmartPlanCode: hp.code,
          isActive: true,
          sortOrder: 0,
          features: [],
          transcriptsPerMonth: 40,
          scriptsPerMonth: 70,
          insightTokensMonthlyMax: 50000,
          scriptTokensMonthlyMax: 20000,
          insightMaxOutputTokens: 800,
          scriptMaxOutputTokens: 1500,
        },
      });
      console.log(`  ✅ Plan created: ${hp.name} (${hp.code})`);
    }
  }
}

/** Resolve local plan by Hotmart plan ID (numeric). Falls back to first active plan. */
async function resolveLocalPlan(
  token: string,
  hotmartPlanId: number | undefined,
  productId: string,
): Promise<{ id: string; name: string } | null> {
  // We don't have hotmartPlanCode from subscription API — it uses plan.id (numeric).
  // Try to find a plan that was synced from Hotmart.
  // If we have plans synced, match by name or just use the first one.
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  if (plans.length === 0) {
    // Auto-sync plans first
    const products = await hotmartGet<HotmartProductListResponse>(
      token,
      "/products/api/v1/products",
      { id: Number(productId) },
    );
    const product = products.items?.[0];
    if (product) {
      await syncHotmartPlans(token, product.ucode);
      const synced = await prisma.plan.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      return synced ? { id: synced.id, name: synced.name } : null;
    }
    return null;
  }

  return { id: plans[0].id, name: plans[0].name };
}

// ---------------------------------------------------------------------------
// Subscriber status mapping
// ---------------------------------------------------------------------------

function mapStatus(
  hotmartStatus: string,
): "ACTIVE" | "CANCELLED" | "PAST_DUE" | "PENDING" | "EXPIRED" {
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
    case "STARTED":
      return "PENDING";
    case "INACTIVE":
    default:
      return "EXPIRED";
  }
}

// ---------------------------------------------------------------------------
// Fetch all subscriptions from Hotmart (paginated)
// ---------------------------------------------------------------------------

async function fetchAllSubscriptions(
  token: string,
  productId: string,
): Promise<HotmartSubscription[]> {
  const all: HotmartSubscription[] = [];
  let pageToken: string | undefined;
  let page = 0;

  while (true) {
    page++;
    const params: Record<string, string | number> = {
      product_id: productId,
      max_results: 200,
    };
    if (pageToken) {
      params.page_token = pageToken;
    }

    console.log(`📄 Fetching page ${page}...`);
    const data = await hotmartGet<HotmartSubscriptionsResponse>(
      token,
      "/payments/api/v1/subscriptions",
      params,
    );

    const items = data.items ?? [];
    all.push(...items);
    console.log(
      `   Got ${items.length} subscriptions (total so far: ${all.length})`,
    );

    if (!data.page_info?.next_page_token || items.length === 0) {
      break;
    }

    pageToken = data.page_info.next_page_token;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Provision a single subscriber
// ---------------------------------------------------------------------------

interface ProvisionResult {
  email: string;
  subscriberCode: string;
  action: "created" | "updated" | "skipped" | "error";
  detail?: string;
}

async function provisionSubscriber(
  token: string,
  sub: HotmartSubscription,
  productId: string,
): Promise<ProvisionResult> {
  const email = sub.subscriber?.email?.toLowerCase().trim();
  const subscriberCode = sub.subscriber_code;
  const name = sub.subscriber?.name ?? email?.split("@")[0] ?? "Subscriber";
  const status = mapStatus(sub.status);

  if (!email) {
    return {
      email: "(no email)",
      subscriberCode,
      action: "skipped",
      detail: "No email in subscriber data",
    };
  }

  if (DRY_RUN) {
    return {
      email,
      subscriberCode,
      action: "skipped",
      detail: `[DRY_RUN] Would provision as ${status}`,
    };
  }

  try {
    // 1. Upsert User
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        // Only update name if user has the default name
        name: undefined, // don't overwrite
      },
      create: {
        email,
        name,
        role: "USER",
        status: "ACTIVE",
      },
    });

    // 2. Upsert ExternalAccountLink
    const existingLink = await prisma.externalAccountLink.findFirst({
      where: {
        provider: "hotmart",
        OR: [{ externalEmail: email }, { externalCustomerId: subscriberCode }],
      },
    });

    if (existingLink) {
      await prisma.externalAccountLink.update({
        where: { id: existingLink.id },
        data: {
          externalCustomerId: subscriberCode,
          externalEmail: email,
          isActive: true,
        },
      });
    } else {
      await prisma.externalAccountLink.create({
        data: {
          userId: user.id,
          provider: "hotmart",
          externalCustomerId: subscriberCode,
          externalEmail: email,
          linkConfidence: "auto_email",
          linkMethod: "sync",
        },
      });
    }

    // 3. Resolve plan
    const plan = await resolveLocalPlan(token, sub.plan?.id, productId);
    if (!plan) {
      return {
        email,
        subscriberCode,
        action: "error",
        detail: "No active plan found",
      };
    }

    // 4. Upsert Subscription + HotmartSubscription
    const hotmartSubId = String(sub.subscription_id);
    const existingHotmart = await prisma.hotmartSubscription.findFirst({
      where: {
        OR: [{ hotmartSubscriptionId: hotmartSubId }, { subscriberCode }],
      },
    });

    if (existingHotmart) {
      // Update existing subscription
      await prisma.subscription.update({
        where: { id: existingHotmart.subscriptionId },
        data: {
          status: status as never,
          planId: plan.id,
          ...(status === "ACTIVE" && { renewedAt: new Date() }),
          ...(status === "CANCELLED" &&
            sub.end_date && { cancelledAt: new Date(sub.end_date) }),
        },
      });

      await prisma.hotmartSubscription.update({
        where: { id: existingHotmart.id },
        data: {
          externalStatus: sub.status,
          subscriberCode,
          buyerEmail: email,
        },
      });

      return { email, subscriberCode, action: "updated", detail: status };
    }

    // Create new Subscription + HotmartSubscription
    const newSub = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: status as never,
        source: "hotmart",
        startedAt: sub.accession_date
          ? new Date(sub.accession_date)
          : new Date(),
        ...(status === "CANCELLED" &&
          sub.end_date && { cancelledAt: new Date(sub.end_date) }),
      },
    });

    await prisma.hotmartSubscription.create({
      data: {
        subscriptionId: newSub.id,
        hotmartSubscriptionId: hotmartSubId,
        hotmartProductId: productId,
        subscriberCode,
        buyerEmail: email,
        externalStatus: sub.status,
      },
    });

    return { email, subscriberCode, action: "created", detail: status };
  } catch (err) {
    return {
      email,
      subscriberCode,
      action: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const productId = process.env.HOTMART_PRODUCT_ID ?? "";
  if (!productId) {
    console.error("❌ Set HOTMART_PRODUCT_ID env var");
    process.exit(1);
  }

  console.log("🔄 Hotmart Subscriber Import");
  console.log(`   Product ID: ${productId}`);
  console.log(
    `   Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, "//***@")}`,
  );
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log("");

  // 1. Authenticate
  console.log("🔑 Authenticating with Hotmart...");
  const token = await getHotmartToken();
  console.log("   ✅ Token obtained\n");

  // 2. Auto-sync plans
  console.log("📋 Syncing plans from Hotmart...");
  const products = await hotmartGet<HotmartProductListResponse>(
    token,
    "/products/api/v1/products",
    { id: Number(productId) },
  );
  const product = products.items?.[0];
  if (product) {
    await syncHotmartPlans(token, product.ucode);
  } else {
    console.warn("⚠️  Product not found in Hotmart — plans won't be synced");
  }
  console.log("");

  // 3. Fetch all subscriptions
  console.log("📡 Fetching all subscriptions from Hotmart...");
  const subscriptions = await fetchAllSubscriptions(token, productId);
  console.log(`   Total: ${subscriptions.length}\n`);

  if (subscriptions.length === 0) {
    console.log("No subscriptions found. Done.");
    return;
  }

  // 4. Provision each subscriber
  console.log("🔧 Provisioning subscribers...\n");
  const results: ProvisionResult[] = [];

  for (let i = 0; i < subscriptions.length; i++) {
    const sub = subscriptions[i];
    const result = await provisionSubscriber(token, sub, productId);
    results.push(result);

    const icon =
      result.action === "created"
        ? "✅"
        : result.action === "updated"
          ? "🔄"
          : result.action === "skipped"
            ? "⏭️"
            : "❌";
    console.log(
      `  ${icon} [${i + 1}/${subscriptions.length}] ${result.email} → ${result.action}${result.detail ? ` (${result.detail})` : ""}`,
    );
  }

  // 5. Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const skipped = results.filter((r) => r.action === "skipped").length;
  const errors = results.filter((r) => r.action === "error").length;
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  console.log("=".repeat(60));

  if (errors > 0) {
    console.log("\n❌ Errors:");
    results
      .filter((r) => r.action === "error")
      .forEach((r) => console.log(`   ${r.email}: ${r.detail}`));
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
