/**
 * Tests: lib/admin/notifications.ts — notification service
 *
 * Coverage: notification rules, dedup logic, template rendering,
 *           event-to-notification mapping, direct notification creation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";

vi.mock("@/lib/prisma");

import {
  createNotificationIfNeeded,
  createDirectNotification,
  buildDedupeKey,
  NOTIFICATION_RULES,
  type NotificationContext,
} from "@/lib/admin/notifications";

function makeCtx(
  overrides: Partial<NotificationContext> = {},
): NotificationContext {
  return {
    eventType: "PURCHASE_CHARGEBACK",
    email: "buyer@test.com",
    transactionId: "TXN-123",
    planCode: "pro_mensal",
    reason: null,
    userId: "user-1",
    subscriptionId: "sub-1",
    eventId: "event-1",
    metadata: { eventType: "PURCHASE_CHARGEBACK" },
    ...overrides,
  };
}

describe("createNotificationIfNeeded()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing notification (dedup check returns null)
    prismaMock.adminNotification.findUnique.mockResolvedValue(null);
    prismaMock.adminNotification.create.mockResolvedValue({
      id: "notif-1",
    });
  });

  it("creates CRITICAL notification for PURCHASE_CHARGEBACK", async () => {
    const result = await createNotificationIfNeeded(makeCtx());

    expect(result).toBe("notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "hotmart",
        type: "SUBSCRIPTION_CHARGEBACK",
        severity: "CRITICAL",
        title: "Chargeback detectado",
        userId: "user-1",
        subscriptionId: "sub-1",
        eventId: "event-1",
        status: "UNREAD",
        dedupeKey: expect.any(String),
      }),
    });
  });

  it("creates WARNING notification for PURCHASE_CANCELED", async () => {
    const result = await createNotificationIfNeeded(
      makeCtx({ eventType: "PURCHASE_CANCELED" }),
    );

    expect(result).toBe("notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "SUBSCRIPTION_CANCELED",
        severity: "WARNING",
      }),
    });
  });

  it("creates HIGH notification for PURCHASE_REFUNDED", async () => {
    const result = await createNotificationIfNeeded(
      makeCtx({ eventType: "PURCHASE_REFUNDED" }),
    );

    expect(result).toBe("notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "SUBSCRIPTION_REFUNDED",
        severity: "HIGH",
      }),
    });
  });

  it("creates INFO notification for PURCHASE_BILLET_PRINTED (awaiting payment)", async () => {
    const result = await createNotificationIfNeeded(
      makeCtx({ eventType: "PURCHASE_BILLET_PRINTED" }),
    );

    expect(result).toBe("notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "SUBSCRIPTION_AWAITING_PAYMENT",
        severity: "INFO",
      }),
    });
  });

  it("returns null for PURCHASE_APPROVED (no rule)", async () => {
    const result = await createNotificationIfNeeded(
      makeCtx({ eventType: "PURCHASE_APPROVED" }),
    );

    expect(result).toBeNull();
    expect(prismaMock.adminNotification.create).not.toHaveBeenCalled();
  });

  it("deduplicates notifications by dedupeKey", async () => {
    prismaMock.adminNotification.findUnique.mockResolvedValue({
      id: "existing-notif",
    });

    const result = await createNotificationIfNeeded(makeCtx());

    expect(result).toBeNull();
    expect(prismaMock.adminNotification.create).not.toHaveBeenCalled();
    expect(prismaMock.adminNotification.findUnique).toHaveBeenCalledWith({
      where: {
        dedupeKey: buildDedupeKey(
          "SUBSCRIPTION_CHARGEBACK",
          "event-1",
          "TXN-123",
        ),
      },
      select: { id: true },
    });
  });

  it("creates WEBHOOK_INVALID notification", async () => {
    const result = await createNotificationIfNeeded(
      makeCtx({
        eventType: "WEBHOOK_INVALID",
        reason: "192.168.1.1",
        userId: null,
      }),
    );

    expect(result).toBe("notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "WEBHOOK_INVALID",
        severity: "CRITICAL",
      }),
    });
  });

  it("creates PROCESSING_FAILED notification", async () => {
    const result = await createNotificationIfNeeded(
      makeCtx({
        eventType: "PROCESSING_FAILED",
        reason: "Connection timeout",
      }),
    );

    expect(result).toBe("notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "PROCESSING_FAILED",
        severity: "HIGH",
      }),
    });
  });

  it("fills template placeholders correctly", async () => {
    await createNotificationIfNeeded(
      makeCtx({
        eventType: "PURCHASE_CHARGEBACK",
        email: "john@example.com",
        transactionId: "txn-999",
      }),
    );

    const call = prismaMock.adminNotification.create.mock.calls[0][0];
    expect(call.data.message).toContain("john@example.com");
    expect(call.data.message).toContain("txn-999");
  });

  it("handles missing email gracefully", async () => {
    await createNotificationIfNeeded(makeCtx({ email: null }));

    const call = prismaMock.adminNotification.create.mock.calls[0][0];
    expect(call.data.message).toContain("desconhecido");
  });
});

describe("createDirectNotification()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.adminNotification.create.mockResolvedValue({
      id: "direct-notif-1",
    });
  });

  it("creates notification with rule defaults", async () => {
    const id = await createDirectNotification("PROCESSING_FAILED");

    expect(id).toBe("direct-notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "system",
        type: "PROCESSING_FAILED",
        severity: "HIGH",
        status: "UNREAD",
      }),
    });
  });

  it("allows overriding severity and message", async () => {
    const id = await createDirectNotification("PROCESSING_FAILED", {
      severity: "CRITICAL",
      message: "Custom message",
      userId: "user-abc",
      source: "cron",
    });

    expect(id).toBe("direct-notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "cron",
        severity: "CRITICAL",
        message: "Custom message",
        userId: "user-abc",
      }),
    });
  });

  it("handles unknown type gracefully", async () => {
    const id = await createDirectNotification("UNKNOWN_TYPE", {
      message: "Something happened",
    });

    expect(id).toBe("direct-notif-1");
    expect(prismaMock.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "UNKNOWN_TYPE",
        severity: "WARNING",
        title: "UNKNOWN_TYPE",
        message: "Something happened",
      }),
    });
  });
});

describe("NOTIFICATION_RULES", () => {
  it("has all expected notification types", () => {
    const expectedTypes = [
      "SUBSCRIPTION_CANCELED",
      "SUBSCRIPTION_REFUNDED",
      "SUBSCRIPTION_CHARGEBACK",
      "SUBSCRIPTION_DELAYED",
      "SUBSCRIPTION_CANCELLATION",
      "WEBHOOK_INVALID",
      "PROCESSING_FAILED",
      "IDENTITY_UNRESOLVED",
    ];

    for (const type of expectedTypes) {
      expect(NOTIFICATION_RULES[type]).toBeDefined();
      expect(NOTIFICATION_RULES[type].severity).toBeTruthy();
      expect(NOTIFICATION_RULES[type].title).toBeTruthy();
      expect(NOTIFICATION_RULES[type].messageTemplate).toBeTruthy();
    }
  });

  it("assigns correct severity levels", () => {
    expect(NOTIFICATION_RULES.SUBSCRIPTION_CHARGEBACK.severity).toBe(
      "CRITICAL",
    );
    expect(NOTIFICATION_RULES.WEBHOOK_INVALID.severity).toBe("CRITICAL");
    expect(NOTIFICATION_RULES.SUBSCRIPTION_REFUNDED.severity).toBe("HIGH");
    expect(NOTIFICATION_RULES.PROCESSING_FAILED.severity).toBe("HIGH");
    expect(NOTIFICATION_RULES.SUBSCRIPTION_CANCELED.severity).toBe("WARNING");
    expect(NOTIFICATION_RULES.SUBSCRIPTION_DELAYED.severity).toBe("WARNING");
  });
});

describe("buildDedupeKey()", () => {
  it("returns SHA-256 hash for eventId", () => {
    const key = buildDedupeKey("SUBSCRIPTION_CHARGEBACK", "evt-123", null);
    expect(key).toBeTruthy();
    expect(key).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it("returns SHA-256 hash for transactionId when no eventId", () => {
    const key = buildDedupeKey("SUBSCRIPTION_REFUNDED", null, "txn-456");
    expect(key).toBeTruthy();
    expect(key).toHaveLength(64);
  });

  it("prioritises eventId over transactionId", () => {
    const keyEvt = buildDedupeKey("TYPE", "evt-1", "txn-1");
    const keyEvtOnly = buildDedupeKey("TYPE", "evt-1", null);
    expect(keyEvt).toBe(keyEvtOnly);
  });

  it("returns null when no eventId and no transactionId", () => {
    expect(buildDedupeKey("TYPE", null, null)).toBeNull();
    expect(buildDedupeKey("TYPE", undefined, undefined)).toBeNull();
  });

  it("produces deterministic output for same input", () => {
    const a = buildDedupeKey("SUBSCRIPTION_CHARGEBACK", "evt-1", null);
    const b = buildDedupeKey("SUBSCRIPTION_CHARGEBACK", "evt-1", null);
    expect(a).toBe(b);
  });

  it("produces different keys for different types with same eventId", () => {
    const a = buildDedupeKey("SUBSCRIPTION_CHARGEBACK", "evt-1", null);
    const b = buildDedupeKey("SUBSCRIPTION_REFUNDED", "evt-1", null);
    expect(a).not.toBe(b);
  });
});
