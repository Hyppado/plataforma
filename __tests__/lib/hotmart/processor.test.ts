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

vi.mock("@/lib/prisma");

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
