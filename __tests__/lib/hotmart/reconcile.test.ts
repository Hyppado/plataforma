/**
 * Tests: lib/hotmart/reconcile.ts — Hotmart reconciliation service
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted keeps the mock available inside hoisted vi.mock factories
// ---------------------------------------------------------------------------
const prismaMock = vi.hoisted(() => ({
  hotmartWebhookEvent: {
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  subscription: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  adminNotification: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
}));

vi.mock("@/lib/hotmart/webhook", () => ({
  extractWebhookFields: vi.fn().mockReturnValue({
    eventType: "PURCHASE_APPROVED",
    email: "user@test.com",
    subscriberCode: "sub-123",
    hotmartTransactionId: "tx-1",
    productId: 123,
    planName: "Pro",
  }),
}));

vi.mock("@/lib/hotmart/processor", () => ({
  processHotmartEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/admin/notifications", () => ({
  createDirectNotification: vi.fn().mockResolvedValue({}),
}));

import { runHotmartReconcile } from "@/lib/hotmart/reconcile";
import { processHotmartEvent } from "@/lib/hotmart/processor";
import { createDirectNotification } from "@/lib/admin/notifications";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("runHotmartReconcile()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.hotmartWebhookEvent.findMany.mockResolvedValue([]);
    prismaMock.hotmartWebhookEvent.count.mockResolvedValue(0);
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.adminNotification.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("returns ok with empty stats when nothing to reconcile", async () => {
    const result = await runHotmartReconcile();

    expect(result.ok).toBe(true);
    expect(result.stats.retriedEvents).toBe(0);
    expect(result.stats.retriedSuccess).toBe(0);
    expect(result.stats.retriedFailed).toBe(0);
    expect(result.stats.staleSubscriptions).toBe(0);
    expect(result.stats.archivedNotifications).toBe(0);
  });

  it("retries failed events and counts successes", async () => {
    prismaMock.hotmartWebhookEvent.findMany.mockResolvedValueOnce([
      { id: "evt-1", payloadJson: { event: "PURCHASE_APPROVED" } },
      { id: "evt-2", payloadJson: { event: "PURCHASE_APPROVED" } },
    ]);

    const result = await runHotmartReconcile();

    expect(result.ok).toBe(true);
    expect(result.stats.retriedEvents).toBe(2);
    expect(result.stats.retriedSuccess).toBe(2);
    expect(result.stats.retriedFailed).toBe(0);
    expect(processHotmartEvent).toHaveBeenCalledTimes(2);
  });

  it("counts failures when event processing throws", async () => {
    prismaMock.hotmartWebhookEvent.findMany.mockResolvedValueOnce([
      { id: "evt-fail", payloadJson: { event: "PURCHASE_APPROVED" } },
    ]);
    vi.mocked(processHotmartEvent).mockRejectedValueOnce(new Error("DB error"));

    const result = await runHotmartReconcile();

    expect(result.ok).toBe(true);
    expect(result.stats.retriedEvents).toBe(1);
    expect(result.stats.retriedSuccess).toBe(0);
    expect(result.stats.retriedFailed).toBe(1);
  });

  it("notifies admin when permanently failed events exist", async () => {
    prismaMock.hotmartWebhookEvent.count.mockResolvedValueOnce(3);

    const result = await runHotmartReconcile();

    expect(result.ok).toBe(true);
    expect(createDirectNotification).toHaveBeenCalledWith(
      "PROCESSING_FAILED",
      expect.objectContaining({
        severity: "HIGH",
        metadata: { permanentlyFailed: 3 },
      }),
    );
  });

  it("detects stale subscriptions and notifies admin", async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      { id: "sub-1", userId: "u1", user: { email: "a@b.com" } },
    ]);

    const result = await runHotmartReconcile();

    expect(result.ok).toBe(true);
    expect(result.stats.staleSubscriptions).toBe(1);
    expect(createDirectNotification).toHaveBeenCalledWith(
      "IDENTITY_UNRESOLVED",
      expect.objectContaining({ severity: "WARNING" }),
    );
  });

  it("archives old notifications", async () => {
    prismaMock.adminNotification.deleteMany.mockResolvedValueOnce({
      count: 5,
    });

    const result = await runHotmartReconcile();

    expect(result.ok).toBe(true);
    expect(result.stats.archivedNotifications).toBe(5);
  });

  it("returns error result when top-level exception occurs", async () => {
    prismaMock.hotmartWebhookEvent.findMany.mockRejectedValueOnce(
      new Error("Connection lost"),
    );

    const result = await runHotmartReconcile();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Connection lost");
  });
});
