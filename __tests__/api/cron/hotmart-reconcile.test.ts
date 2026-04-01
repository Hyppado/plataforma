/**
 * Tests: /api/cron/hotmart-reconcile — reconciliation cron
 *
 * Coverage: CRON_SECRET auth, retry of failed events,
 *           stale subscription detection, notification cleanup
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma");
vi.mock("@/lib/hotmart/webhook", () => ({
  extractWebhookFields: vi.fn().mockReturnValue({
    eventType: "PURCHASE_APPROVED",
    payloadVersion: "2.0.0",
    eventExternalId: "evt-retry",
    transactionId: "TXN-R1",
    purchaseStatus: "APPROVED",
    isSubscription: true,
    recurrenceNumber: 1,
    amountCents: 9990,
    currency: "BRL",
    paymentType: "CREDIT_CARD",
    offerCode: null,
    subscriptionExternalId: "SUB-R1",
    subscriberCode: "SC-R1",
    subscriberEmail: "retry@test.com",
    planCode: "pro_mensal",
    planId: null,
    subscriptionStatus: "ACTIVE",
    buyerEmail: "retry@test.com",
    buyerName: "Retry User",
    productId: "7420891",
    productName: "Hyppado",
    occurredAt: new Date(),
  }),
}));
vi.mock("@/lib/hotmart/processor", () => ({
  processHotmartEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/admin/notifications", () => ({
  createDirectNotification: vi.fn().mockResolvedValue("notif-1"),
}));

import { GET } from "@/app/api/cron/hotmart-reconcile/route";
import { createDirectNotification } from "@/lib/admin/notifications";

function makeCronRequest(
  cronSecret?: string,
  params: Record<string, string> = {},
): NextRequest {
  const url = new URL("http://localhost/api/cron/hotmart-reconcile");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = {};
  if (cronSecret) {
    headers["authorization"] = `Bearer ${cronSecret}`;
  }
  return new NextRequest(url, { headers });
}

describe("GET /api/cron/hotmart-reconcile", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-secret" };

    // Default mocks
    prismaMock.hotmartWebhookEvent.findMany.mockResolvedValue([]);
    prismaMock.hotmartWebhookEvent.count.mockResolvedValue(0);
    prismaMock.hotmartWebhookEvent.update.mockResolvedValue({});
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.adminNotification.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 with invalid CRON_SECRET", async () => {
    const req = makeCronRequest("wrong-secret");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid CRON_SECRET and no failed events", async () => {
    const req = makeCronRequest("test-secret");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.stats.retriedEvents).toBe(0);
    expect(json.stats.staleSubscriptions).toBe(0);
    expect(json.stats.archivedNotifications).toBe(0);
  });

  it("retries failed events", async () => {
    const failedEvent = {
      id: "event-fail-1",
      eventType: "PURCHASE_APPROVED",
      retryCount: 1,
      processingStatus: "FAILED",
      payloadJson: { event: "PURCHASE_APPROVED" },
    };

    prismaMock.hotmartWebhookEvent.findMany.mockResolvedValue([failedEvent]);

    const req = makeCronRequest("test-secret");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.stats.retriedEvents).toBe(1);
    expect(prismaMock.hotmartWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: "event-fail-1" },
      data: expect.objectContaining({
        processingStatus: "RECEIVED",
        retryCount: { increment: 1 },
      }),
    });
  });

  it("notifies admin when events are permanently failed", async () => {
    prismaMock.hotmartWebhookEvent.count.mockResolvedValue(5);

    const req = makeCronRequest("test-secret");
    await GET(req);

    expect(createDirectNotification).toHaveBeenCalledWith(
      "PROCESSING_FAILED",
      expect.objectContaining({
        severity: "HIGH",
        metadata: { permanentlyFailed: 5 },
      }),
    );
  });

  it("detects stale active subscriptions", async () => {
    const staleSub = {
      id: "sub-stale-1",
      userId: "user-1",
      user: { email: "stale@test.com" },
    };

    prismaMock.subscription.findMany.mockResolvedValue([staleSub]);

    const req = makeCronRequest("test-secret");
    const res = await GET(req);
    const json = await res.json();

    expect(json.stats.staleSubscriptions).toBe(1);
    expect(createDirectNotification).toHaveBeenCalledWith(
      "IDENTITY_UNRESOLVED",
      expect.objectContaining({
        severity: "WARNING",
        metadata: expect.objectContaining({
          count: 1,
          subscriptionIds: ["sub-stale-1"],
        }),
      }),
    );
  });

  it("cleans up old archived notifications", async () => {
    prismaMock.adminNotification.deleteMany.mockResolvedValue({ count: 15 });

    const req = makeCronRequest("test-secret");
    const res = await GET(req);
    const json = await res.json();

    expect(json.stats.archivedNotifications).toBe(15);
    expect(prismaMock.adminNotification.deleteMany).toHaveBeenCalledWith({
      where: {
        status: "ARCHIVED",
        archivedAt: { lt: expect.any(Date) },
      },
    });
  });
});
