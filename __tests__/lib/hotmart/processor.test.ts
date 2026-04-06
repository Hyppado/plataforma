/**
 * Tests: lib/hotmart/processor.ts — webhook event processing state machine
 *
 * Priority: #2 (Business rules — subscription lifecycle)
 * Coverage: informational events, activation, cancellation, delayed,
 *           chargeback auto-suspension, plan/identity resolution, audit trail
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { buildPlan, buildUser } from "@tests/helpers/factories";
import type { HotmartWebhookFields } from "@/lib/hotmart/webhook";
import { createNotificationIfNeeded } from "@/lib/admin/notifications";

vi.mock("@/lib/prisma");

// Mock notification service (processor now calls createNotificationIfNeeded)
vi.mock("@/lib/admin/notifications", () => ({
  createNotificationIfNeeded: vi.fn().mockResolvedValue(null),
}));

// Use fake timers to skip retry delays
vi.useFakeTimers();

import { processHotmartEvent } from "@/lib/hotmart/processor";

function makeFields(
  overrides: Partial<HotmartWebhookFields> = {},
): HotmartWebhookFields {
  return {
    eventType: "PURCHASE_APPROVED",
    payloadVersion: "2.0.0",
    eventExternalId: "evt-1",
    transactionId: "TXN-1",
    purchaseStatus: "APPROVED",
    isSubscription: true,
    recurrenceNumber: 1,
    amountCents: 9990,
    currency: "BRL",
    paymentType: "CREDIT_CARD",
    offerCode: "offer123",
    subscriptionExternalId: "SUB-1",
    subscriberCode: "SC1",
    subscriberEmail: "buyer@test.com",
    planCode: "pro_mensal",
    planId: "plan-123",
    subscriptionStatus: "ACTIVE",
    buyerEmail: "buyer@test.com",
    buyerName: "Test Buyer",
    productId: "7420891",
    productName: "Hyppado",
    occurredAt: new Date(),
    ...overrides,
  };
}

const mockUser = buildUser({ id: "user-1", email: "buyer@test.com" });
const mockPlan = buildPlan({
  id: "plan-1",
  hotmartProductId: "7420891",
  hotmartPlanCode: "pro_mensal",
});
const mockIdentity = {
  id: "ident-1",
  userId: "user-1",
  provider: "hotmart",
  externalEmail: "buyer@test.com",
  externalCustomerId: "SC1",
  externalReference: "SC1",
  user: mockUser,
};

function setupFullMocks() {
  // Webhook event update (mark PROCESSING, then PROCESSED)
  prismaMock.hotmartWebhookEvent.update.mockResolvedValue({});

  // Identity resolution
  prismaMock.externalAccountLink.findFirst.mockResolvedValue(mockIdentity);
  prismaMock.externalAccountLink.update.mockResolvedValue({});
  prismaMock.externalAccountLink.create.mockResolvedValue(mockIdentity);

  // Plan resolution
  prismaMock.plan.findFirst.mockResolvedValue(mockPlan);

  // User
  prismaMock.user.upsert.mockResolvedValue(mockUser);
  prismaMock.user.update.mockResolvedValue(mockUser);

  // Subscription upsert flow
  prismaMock.hotmartSubscription.findFirst.mockResolvedValue(null);
  prismaMock.subscription.create.mockResolvedValue({ id: "sub-1" });
  prismaMock.subscription.update.mockResolvedValue({});
  prismaMock.hotmartSubscription.create.mockResolvedValue({});
  prismaMock.hotmartSubscription.update.mockResolvedValue({});

  // Charge
  prismaMock.subscriptionCharge.upsert.mockResolvedValue({});

  // Audit
  prismaMock.auditLog.create.mockResolvedValue({});
}

describe("processHotmartEvent()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFullMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  it("processes informational event (PURCHASE_BILLET_PRINTED)", async () => {
    const fields = makeFields({ eventType: "PURCHASE_BILLET_PRINTED" });

    const promise = processHotmartEvent("event-1", fields);
    // Advance timers in case of retry
    await vi.runAllTimersAsync();
    await promise;

    // Should create audit log with informational action
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "WEBHOOK_PURCHASE_BILLET_PRINTED",
        }),
      }),
    );
    // Should NOT try to resolve identity (informationals skip this)
    expect(prismaMock.externalAccountLink.findFirst).not.toHaveBeenCalled();
  });

  it("processes PURCHASE_APPROVED and creates subscription", async () => {
    const fields = makeFields({ eventType: "PURCHASE_APPROVED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Should resolve identity
    expect(prismaMock.externalAccountLink.findFirst).toHaveBeenCalled();
    // Should create subscription
    expect(prismaMock.subscription.create).toHaveBeenCalled();
  });

  it("processes SUBSCRIPTION_CANCELLATION", async () => {
    const fields = makeFields({ eventType: "SUBSCRIPTION_CANCELLATION" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Resolved identity and plan
    expect(prismaMock.externalAccountLink.findFirst).toHaveBeenCalled();
    expect(prismaMock.plan.findFirst).toHaveBeenCalled();
  });

  it("auto-suspends user on PURCHASE_CHARGEBACK", async () => {
    const fields = makeFields({ eventType: "PURCHASE_CHARGEBACK" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Should suspend user
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { status: "SUSPENDED" },
      }),
    );

    // Should create auto-suspension audit log
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "AUTO_SUSPENSION_CHARGEBACK",
        }),
      }),
    );
  });

  it("handles PURCHASE_DELAYED → sets PAST_DUE status", async () => {
    const fields = makeFields({ eventType: "PURCHASE_DELAYED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Subscription should be created with PAST_DUE status
    expect(prismaMock.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAST_DUE",
        }),
      }),
    );
  });

  it("resolves plan by productId and planCode", async () => {
    const fields = makeFields({
      productId: "7420891",
      planCode: "pro_mensal",
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.plan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hotmartProductId: "7420891",
          hotmartPlanCode: "pro_mensal",
        }),
      }),
    );
  });

  it("creates audit log for unresolved identity", async () => {
    prismaMock.externalAccountLink.findFirst.mockResolvedValue(null);
    // Remove email so we can't create user
    const fields = makeFields({
      buyerEmail: undefined as any,
      subscriberEmail: undefined as any,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "WEBHOOK_PURCHASE_APPROVED_UNRESOLVED",
        }),
      }),
    );
  });

  it("upserts charge for transactional events", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      transactionId: "TXN-ABC",
      amountCents: 9990,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.subscriptionCharge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: "TXN-ABC" },
      }),
    );
  });

  it("marks event as PROCESSED on success", async () => {
    const fields = makeFields({ eventType: "PURCHASE_BILLET_PRINTED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Should update webhook event to PROCESSED
    const updateCalls = prismaMock.hotmartWebhookEvent.update.mock.calls;
    const processedCall = updateCalls.find(
      (call: any) => call[0]?.data?.processingStatus === "PROCESSED",
    );
    expect(processedCall).toBeTruthy();
  });

  it("marks event as FAILED after all retries exhausted", async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error("DB down"));

    const fields = makeFields({ eventType: "PURCHASE_BILLET_PRINTED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    const updateCalls = prismaMock.hotmartWebhookEvent.update.mock.calls;
    const failedCall = updateCalls.find(
      (call: any) => call[0]?.data?.processingStatus === "FAILED",
    );
    expect(failedCall).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// handleApproved() — PURCHASE_APPROVED provisioning handler
// ---------------------------------------------------------------------------

describe("handleApproved() — PURCHASE_APPROVED provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFullMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  // ── A. User creation / linking ─────────────────────────────────────────

  it("creates new user and external link when none exists", async () => {
    prismaMock.externalAccountLink.findFirst.mockResolvedValue(null);
    prismaMock.user.upsert.mockResolvedValue(mockUser);
    prismaMock.externalAccountLink.create.mockResolvedValue({
      ...mockIdentity,
      user: mockUser,
    });

    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: 1,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.user.upsert).toHaveBeenCalled();
    expect(prismaMock.externalAccountLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "hotmart",
          externalEmail: "buyer@test.com",
        }),
      }),
    );
  });

  it("links to existing user when ExternalAccountLink found", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: 1,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Should NOT upsert user (existing link has user)
    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect(prismaMock.externalAccountLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ provider: "hotmart" }),
      }),
    );
    // Subscription still created
    expect(prismaMock.subscription.create).toHaveBeenCalled();
  });

  // ── B. User status handling ────────────────────────────────────────────

  it("reactivates INACTIVE user on purchase", async () => {
    const inactiveUser = buildUser({
      id: "user-1",
      email: "buyer@test.com",
      status: "INACTIVE",
    });
    prismaMock.externalAccountLink.findFirst.mockResolvedValue({
      ...mockIdentity,
      user: inactiveUser,
    });

    const fields = makeFields({ eventType: "PURCHASE_APPROVED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { status: "ACTIVE" },
      }),
    );

    // Audit log for reactivation
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "USER_REACTIVATED_BY_PURCHASE",
          after: expect.objectContaining({
            previousStatus: "INACTIVE",
            newStatus: "ACTIVE",
          }),
        }),
      }),
    );
  });

  it("does NOT reactivate SUSPENDED user — notifies admin instead", async () => {
    const suspendedUser = buildUser({
      id: "user-1",
      email: "buyer@test.com",
      status: "SUSPENDED",
    });
    prismaMock.externalAccountLink.findFirst.mockResolvedValue({
      ...mockIdentity,
      user: suspendedUser,
    });

    const fields = makeFields({ eventType: "PURCHASE_APPROVED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Should NOT change status to ACTIVE
    const statusUpdateCalls = (
      prismaMock.user.update as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: any) => call[0]?.data?.status === "ACTIVE");
    expect(statusUpdateCalls).toHaveLength(0);

    // Should still create subscription (commercial record, access blocked at runtime)
    expect(prismaMock.subscription.create).toHaveBeenCalled();

    // Should notify admin about suspended user purchase
    expect(createNotificationIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "SUSPENDED_USER_PURCHASE",
        userId: "user-1",
      }),
    );
  });

  // ── C+D. Plan resolution + Subscription creation ──────────────────────

  it("creates subscription with ACTIVE status on first purchase", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: 1,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          planId: "plan-1",
          status: "ACTIVE",
          startedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("updates existing subscription on renewal (recurrenceNumber > 1)", async () => {
    prismaMock.hotmartSubscription.findFirst.mockResolvedValue({
      id: "hs-1",
      subscriptionId: "sub-existing",
      hotmartSubscriptionId: "SUB-1",
      subscriberCode: "SC1",
      hotmartPlanCode: "pro_mensal",
      hotmartOfferCode: null,
    });

    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: 3,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Should update existing subscription, NOT create new
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-existing" },
        data: expect.objectContaining({
          status: "ACTIVE",
          renewedAt: expect.any(Date),
        }),
      }),
    );
    expect(prismaMock.subscription.create).not.toHaveBeenCalled();
  });

  // ── E. Charge record ──────────────────────────────────────────────────

  it("creates charge record with PAID status", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      transactionId: "TXN-APPROVED-1",
      amountCents: 5990,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.subscriptionCharge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: "TXN-APPROVED-1" },
        create: expect.objectContaining({
          status: "PAID",
          amountCents: 5990,
          paidAt: expect.any(Date),
        }),
      }),
    );
  });

  it("skips charge record if no transactionId", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      transactionId: undefined,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.subscriptionCharge.upsert).not.toHaveBeenCalled();
  });

  // ── G. Audit trail ────────────────────────────────────────────────────

  it("creates audit log with WEBHOOK_PURCHASE_APPROVED on first purchase", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: 1,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "WEBHOOK_PURCHASE_APPROVED",
          after: expect.objectContaining({
            isRenewal: false,
            status: "ACTIVE",
          }),
        }),
      }),
    );
  });

  it("creates audit log with WEBHOOK_PURCHASE_RENEWED on renewal", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: 5,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "WEBHOOK_PURCHASE_RENEWED",
          after: expect.objectContaining({
            isRenewal: true,
            recurrenceNumber: 5,
          }),
        }),
      }),
    );
  });

  // ── H. Admin notification ─────────────────────────────────────────────

  it("creates SUBSCRIPTION_ACTIVATED notification for first purchase", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: 1,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(createNotificationIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "SUBSCRIPTION_ACTIVATED",
        userId: "user-1",
      }),
    );
  });

  it("does NOT create SUBSCRIPTION_ACTIVATED notification for renewals", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: 3,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    const activationCalls = (
      createNotificationIfNeeded as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      (call: any) => call[0]?.eventType === "SUBSCRIPTION_ACTIVATED",
    );
    expect(activationCalls).toHaveLength(0);
  });

  // ── Unresolved paths ──────────────────────────────────────────────────

  it("handles missing identity gracefully (no email, no subscriberCode)", async () => {
    prismaMock.externalAccountLink.findFirst.mockResolvedValue(null);

    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      buyerEmail: undefined as any,
      subscriberEmail: undefined as any,
      subscriberCode: undefined,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "WEBHOOK_PURCHASE_APPROVED_UNRESOLVED",
          after: expect.objectContaining({
            reason: "identity_not_found",
          }),
        }),
      }),
    );
    expect(prismaMock.subscription.create).not.toHaveBeenCalled();
  });

  it("handles unresolved plan gracefully", async () => {
    prismaMock.plan.findFirst.mockResolvedValue(null);

    const fields = makeFields({ eventType: "PURCHASE_APPROVED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "WEBHOOK_PURCHASE_APPROVED_UNRESOLVED",
          after: expect.objectContaining({
            reason: "plan_not_found",
          }),
        }),
      }),
    );
    expect(prismaMock.subscription.create).not.toHaveBeenCalled();
  });

  // ── Idempotency / duplicate safety ────────────────────────────────────

  it("updates existing subscription on duplicate (idempotent)", async () => {
    prismaMock.hotmartSubscription.findFirst.mockResolvedValue({
      id: "hs-1",
      subscriptionId: "sub-1",
      hotmartSubscriptionId: "SUB-1",
      subscriberCode: "SC1",
      hotmartPlanCode: "pro_mensal",
      hotmartOfferCode: null,
    });

    const fields = makeFields({ eventType: "PURCHASE_APPROVED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // Should update, not create
    expect(prismaMock.subscription.update).toHaveBeenCalled();
    expect(prismaMock.subscription.create).not.toHaveBeenCalled();
  });

  it("charge upsert is idempotent on same transactionId", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      transactionId: "TXN-DUP-1",
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    // upsert uses where: { transactionId } — safe for duplicates
    expect(prismaMock.subscriptionCharge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: "TXN-DUP-1" },
      }),
    );
  });

  // ── Event marked as PROCESSED ─────────────────────────────────────────

  it("marks event as PROCESSED on success", async () => {
    const fields = makeFields({ eventType: "PURCHASE_APPROVED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    const updateCalls = prismaMock.hotmartWebhookEvent.update.mock.calls;
    const processedCall = updateCalls.find(
      (call: any) => call[0]?.data?.processingStatus === "PROCESSED",
    );
    expect(processedCall).toBeTruthy();
  });

  it("marks event as PROCESSED even when identity is unresolved", async () => {
    prismaMock.externalAccountLink.findFirst.mockResolvedValue(null);
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      buyerEmail: undefined as any,
      subscriberEmail: undefined as any,
      subscriberCode: undefined,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    const updateCalls = prismaMock.hotmartWebhookEvent.update.mock.calls;
    const processedCall = updateCalls.find(
      (call: any) => call[0]?.data?.processingStatus === "PROCESSED",
    );
    expect(processedCall).toBeTruthy();
  });

  // ── Security: no sensitive data in audit log ──────────────────────────

  it("does not log secrets or raw payloads in audit log", async () => {
    const fields = makeFields({ eventType: "PURCHASE_APPROVED" });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    const auditCalls = prismaMock.auditLog.create.mock.calls;
    for (const call of auditCalls) {
      const after = (call as any)[0]?.data?.after;
      if (after) {
        // Should NOT contain raw payload, passwords, tokens, or secrets
        expect(after).not.toHaveProperty("payloadJson");
        expect(after).not.toHaveProperty("password");
        expect(after).not.toHaveProperty("token");
        expect(after).not.toHaveProperty("secret");
      }
    }
  });

  // ── recurrenceNumber edge cases ───────────────────────────────────────

  it("treats undefined recurrenceNumber as first purchase (not renewal)", async () => {
    const fields = makeFields({
      eventType: "PURCHASE_APPROVED",
      recurrenceNumber: undefined,
    });

    const promise = processHotmartEvent("event-1", fields);
    await vi.runAllTimersAsync();
    await promise;

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "WEBHOOK_PURCHASE_APPROVED",
          after: expect.objectContaining({
            isRenewal: false,
          }),
        }),
      }),
    );

    // Should trigger first-purchase notification
    expect(createNotificationIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "SUBSCRIPTION_ACTIVATED",
      }),
    );
  });
});
