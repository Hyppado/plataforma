/**
 * Test data factories
 *
 * Provides realistic test data builders for all Prisma models.
 * Each factory returns a plain object matching the model shape.
 */
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    email: `user-${Date.now()}@test.com`,
    name: "Test User",
    role: "USER" as const,
    status: "ACTIVE" as const,
    passwordHash: "$2a$10$fakebcrypthash",
    lastLoginAt: new Date(),
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildAdminUser(overrides: Record<string, unknown> = {}) {
  return buildUser({ role: "ADMIN", email: "admin@test.com", ...overrides });
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export function buildPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    name: "Pro Mensal",
    slug: "pro-mensal",
    period: "MONTHLY" as const,
    priceCents: 9990,
    isActive: true,
    sortOrder: 1,
    hotmartPlanCode: null as string | null,
    transcriptsPerMonth: 100,
    scriptsPerMonth: 50,
    insightTokensMonthlyMax: 500000,
    scriptTokensMonthlyMax: 500000,
    insightMaxOutputTokens: 4096,
    scriptMaxOutputTokens: 4096,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export function buildSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    planId: randomUUID(),
    status: "ACTIVE" as const,
    startedAt: new Date(),
    nextChargeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: buildPlan(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AccessGrant
// ---------------------------------------------------------------------------

export function buildAccessGrant(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    planId: randomUUID(),
    reason: "Test grant",
    isActive: true,
    startsAt: new Date(Date.now() - 86400000),
    expiresAt: new Date(Date.now() + 30 * 86400000),
    grantedBy: "admin-id",
    createdAt: new Date(),
    plan: buildPlan(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// UsagePeriod / UsageEvent
// ---------------------------------------------------------------------------

export function buildUsagePeriod(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: randomUUID(),
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    ),
    transcriptsUsed: 0,
    scriptsUsed: 0,
    insightsUsed: 0,
    tokensUsed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildUsageEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    periodId: randomUUID(),
    type: "TRANSCRIPT" as const,
    tokensUsed: 100,
    refTable: null,
    refId: null,
    idempotencyKey: `key-${randomUUID()}`,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Hotmart Webhook Event
// ---------------------------------------------------------------------------

export function buildHotmartWebhookPayload(
  overrides: Record<string, unknown> = {},
) {
  return {
    event: "PURCHASE_APPROVED",
    id: randomUUID(),
    version: "2.0.0",
    creation_date: Date.now(),
    data: {
      buyer: {
        email: "buyer@test.com",
        name: "Test Buyer",
      },
      product: {
        id: "7420891",
        name: "Hyppado",
      },
      purchase: {
        transaction: `TXN-${randomUUID().slice(0, 8)}`,
        status: "APPROVED",
        is_subscription: true,
        recurrence_number: 1,
        offer: { code: "offer123" },
        price: { value: 9990, currency_value: "BRL" },
        payment: { type: "CREDIT_CARD" },
      },
      subscription: {
        id: `SUB-${randomUUID().slice(0, 8)}`,
        plan: { name: "Pro Mensal", id: "plan-123" },
        subscriber: { code: "SUB_CODE_1", email: "buyer@test.com" },
        status: "ACTIVE",
      },
    },
    ...overrides,
  };
}

/**
 * Builds a realistic SUBSCRIPTION_CANCELLATION payload.
 * Matches the real Hotmart v2 structure for this event:
 *   - subscriber at data level (NOT under data.subscription.subscriber)
 *   - data.cancellation_date (epoch ms)
 *   - data.subscription.id and data.subscription.plan
 *   - NO data.buyer, NO data.purchase blocks
 */
export function buildCancellationPayload(
  overrides: Record<string, unknown> = {},
) {
  const cancellationDate = Date.now();
  return {
    event: "SUBSCRIPTION_CANCELLATION",
    id: randomUUID(),
    version: "2.0.0",
    creation_date: cancellationDate - 5000, // webhook sent slightly before
    data: {
      subscriber: {
        code: "SUB_CODE_1",
        name: "Test Subscriber",
        email: "subscriber@test.com",
      },
      product: {
        id: "7420891",
        name: "Hyppado",
      },
      subscription: {
        id: "SUB-CANCEL-1",
        plan: { name: "Pro Mensal", id: "plan-123" },
        status: "CANCELLED",
      },
      cancellation_date: cancellationDate,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Echotik
// ---------------------------------------------------------------------------

export function buildEchotikCategoryItem(
  overrides: Record<string, unknown> = {},
) {
  return {
    category_id: `cat-${randomUUID().slice(0, 8)}`,
    category_level: "1",
    category_name: "Test Category",
    language: "en-US",
    parent_id: "0",
    ...overrides,
  };
}

export function buildEchotikProductListItem(
  overrides: Record<string, unknown> = {},
) {
  return {
    product_id: `prod-${randomUUID().slice(0, 8)}`,
    product_name: "Test Product",
    cover_url: JSON.stringify([
      { url: "https://cdn.test.com/img.jpg", index: 0 },
    ]),
    category_id: "cat-123",
    min_price: 1990,
    max_price: 2990,
    spu_avg_price: 2490,
    product_commission_rate: 10,
    product_rating: 4.5,
    first_crawl_dt: 20260322,
    total_sale_cnt: 150,
    total_sale_gmv_amt: 373500,
    total_ifl_cnt: 12,
    total_video_sale_gmv_amt: 200000,
    total_live_sale_gmv_amt: 100000,
    region: "BR",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Ingestion Run
// ---------------------------------------------------------------------------

export function buildIngestionRun(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    status: "SUCCESS" as const,
    startedAt: new Date(),
    completedAt: new Date(),
    stats: {},
    error: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Saved Items / Collections / Notes
// ---------------------------------------------------------------------------

export function buildSavedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    externalId: `ext-${randomUUID().slice(0, 8)}`,
    type: "VIDEO" as const,
    title: "Saved Video",
    imageUrl: "https://cdn.test.com/thumb.jpg",
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

export function buildCollection(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    name: "Test Collection",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildNote(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    externalId: `ext-${randomUUID().slice(0, 8)}`,
    type: "VIDEO" as const,
    content: "Test note content",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DataErasureRequest
// ---------------------------------------------------------------------------

export function buildErasureRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    status: "PENDING" as const,
    processedBy: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
