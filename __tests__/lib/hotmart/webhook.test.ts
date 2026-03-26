/**
 * Tests: lib/hotmart/webhook.ts — signature verification, field extraction, idempotency keys
 *
 * Priority: #1 (Security — webhook authentication)
 * Coverage: valid signatures, invalid signatures, missing secret, field extraction,
 *           deterministic idempotency, malicious payloads, edge cases
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifySignature,
  extractWebhookFields,
  buildIdempotencyKey,
} from "@/lib/hotmart/webhook";
import { buildHotmartWebhookPayload } from "@tests/helpers/factories";

describe("verifySignature()", () => {
  beforeEach(() => {
    process.env.HOTMART_WEBHOOK_SECRET = "test-hottok-secret";
    delete process.env.HOTTOK;
  });

  it("accepts valid HOTTOK", () => {
    const headers = new Headers({ "x-hotmart-hottok": "test-hottok-secret" });
    expect(() => verifySignature(headers, Buffer.from(""))).not.toThrow();
  });

  it("rejects invalid HOTTOK", () => {
    const headers = new Headers({ "x-hotmart-hottok": "wrong-token" });
    expect(() => verifySignature(headers, Buffer.from(""))).toThrow(
      "HOTTOK inválido",
    );
  });

  it("rejects missing HOTTOK header", () => {
    const headers = new Headers();
    expect(() => verifySignature(headers, Buffer.from(""))).toThrow(
      "HOTTOK inválido",
    );
  });

  it("uses HOTTOK env var as fallback", () => {
    delete process.env.HOTMART_WEBHOOK_SECRET;
    process.env.HOTTOK = "fallback-secret";
    const headers = new Headers({ "x-hotmart-hottok": "fallback-secret" });
    expect(() => verifySignature(headers, Buffer.from(""))).not.toThrow();
  });

  it("accepts all requests when no secret is configured (dev mode)", () => {
    delete process.env.HOTMART_WEBHOOK_SECRET;
    delete process.env.HOTTOK;
    const headers = new Headers();
    // Should not throw — permissive mode
    expect(() => verifySignature(headers, Buffer.from(""))).not.toThrow();
  });

  // SECURITY: This is a documented gap — secret should be required in production
  it("SECURITY: without secret, any request is accepted (dev-only)", () => {
    delete process.env.HOTMART_WEBHOOK_SECRET;
    delete process.env.HOTTOK;
    const headers = new Headers({ "x-hotmart-hottok": "malicious-token" });
    expect(() => verifySignature(headers, Buffer.from(""))).not.toThrow();
  });

  it("does not leak full secret in error message", () => {
    const headers = new Headers({ "x-hotmart-hottok": "wrong" });
    try {
      verifySignature(headers, Buffer.from(""));
    } catch (e) {
      const msg = (e as Error).message;
      // Should only show first 4 chars of expected secret
      expect(msg).toContain("test…");
      expect(msg).not.toContain("test-hottok-secret");
    }
  });
});

describe("extractWebhookFields()", () => {
  it("extracts all fields from v2 payload", () => {
    const payload = buildHotmartWebhookPayload();
    const fields = extractWebhookFields(payload);

    expect(fields.eventType).toBe("PURCHASE_APPROVED");
    expect(fields.payloadVersion).toBe("2.0.0");
    expect(fields.eventExternalId).toBeDefined();
    expect(fields.buyerEmail).toBe("buyer@test.com");
    expect(fields.buyerName).toBe("Test Buyer");
    expect(fields.productId).toBe("7420891");
    expect(fields.productName).toBe("Hyppado");
    expect(fields.isSubscription).toBe(true);
    expect(fields.recurrenceNumber).toBe(1);
    expect(fields.purchaseStatus).toBe("APPROVED");
    expect(fields.amountCents).toBe(9990);
    expect(fields.currency).toBe("BRL");
    expect(fields.subscriptionStatus).toBe("ACTIVE");
  });

  it("handles missing data gracefully", () => {
    const fields = extractWebhookFields({});
    expect(fields.eventType).toBe("UNKNOWN");
    expect(fields.buyerEmail).toBeUndefined();
    expect(fields.transactionId).toBeUndefined();
  });

  it("handles v1 fallback structure", () => {
    const v1Payload = {
      event: "PURCHASE_APPROVED",
      transaction: "TXN-V1",
      subscriber: { code: "SC1", email: "sub@v1.com" },
      buyer: { email: "buy@v1.com", name: "V1 Buyer" },
      product: { id: "123", name: "V1 Product" },
    };
    const fields = extractWebhookFields(v1Payload);
    expect(fields.eventType).toBe("PURCHASE_APPROVED");
    expect(fields.transactionId).toBe("TXN-V1");
    expect(fields.subscriberCode).toBe("SC1");
  });

  it("handles null/undefined values without crashing", () => {
    const payload = {
      event: "TEST",
      data: {
        buyer: { email: null, name: undefined },
        purchase: { price: { value: null } },
      },
    };
    const fields = extractWebhookFields(payload);
    expect(fields.eventType).toBe("TEST");
    // null/undefined should not be converted to "null" string
    expect(fields.buyerEmail).toBeUndefined();
  });

  it("handles numeric epoch as occurredAt", () => {
    const epoch = 1700000000000;
    const payload = buildHotmartWebhookPayload({ creation_date: epoch });
    const fields = extractWebhookFields(payload);
    expect(fields.occurredAt).toBeInstanceOf(Date);
    expect(fields.occurredAt?.getTime()).toBe(epoch);
  });
});

describe("buildIdempotencyKey()", () => {
  it("produces deterministic key for same input", () => {
    const payload = buildHotmartWebhookPayload();
    const fields = extractWebhookFields(payload);
    const key1 = buildIdempotencyKey(fields, payload);
    const key2 = buildIdempotencyKey(fields, payload);
    expect(key1).toBe(key2);
  });

  it("produces different keys for different events", () => {
    const p1 = buildHotmartWebhookPayload({ event: "PURCHASE_APPROVED" });
    const p2 = buildHotmartWebhookPayload({ event: "PURCHASE_CANCELED" });
    const k1 = buildIdempotencyKey(extractWebhookFields(p1), p1);
    const k2 = buildIdempotencyKey(extractWebhookFields(p2), p2);
    expect(k1).not.toBe(k2);
  });

  it("returns a non-empty string", () => {
    const payload = buildHotmartWebhookPayload();
    const key = buildIdempotencyKey(extractWebhookFields(payload), payload);
    expect(key).toBeTruthy();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(10);
  });
});
