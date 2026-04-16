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
import {
  buildHotmartWebhookPayload,
  buildCancellationPayload,
} from "@tests/helpers/factories";

describe("verifySignature()", () => {
  const SECRET = "test-hottok-secret";

  it("accepts valid HOTTOK", () => {
    const headers = new Headers({ "x-hotmart-hottok": SECRET });
    expect(() =>
      verifySignature(headers, Buffer.from(""), SECRET),
    ).not.toThrow();
  });

  it("rejects invalid HOTTOK", () => {
    const headers = new Headers({ "x-hotmart-hottok": "wrong-token" });
    expect(() => verifySignature(headers, Buffer.from(""), SECRET)).toThrow(
      "Token inválido",
    );
  });

  it("rejects missing HOTTOK header", () => {
    const headers = new Headers();
    expect(() => verifySignature(headers, Buffer.from(""), SECRET)).toThrow(
      "Token inválido",
    );
  });

  it("SECURITY: fails closed when secret is not provided", () => {
    const headers = new Headers({ "x-hotmart-hottok": "any-token" });
    // Must reject — fail closed, never permissive
    expect(() => verifySignature(headers, Buffer.from(""), "")).toThrow(
      "Webhook secret não configurado",
    );
  });

  it("SECURITY: rejects even empty header when no secret provided", () => {
    const headers = new Headers();
    expect(() => verifySignature(headers, Buffer.from(""), "")).toThrow(
      "Webhook secret não configurado",
    );
  });

  it("SECURITY: rejects token with correct prefix but wrong suffix", () => {
    // Regression: timing-safe comparison must not leak prefix match
    const headers = new Headers({ "x-hotmart-hottok": "test-" });
    expect(() => verifySignature(headers, Buffer.from(""), SECRET)).toThrow();
  });

  it("does not leak secret in error message", () => {
    const headers = new Headers({ "x-hotmart-hottok": "wrong" });
    try {
      verifySignature(headers, Buffer.from(""), SECRET);
    } catch (e) {
      const msg = (e as Error).message;
      // Must not contain any portion of the secret
      expect(msg).not.toContain(SECRET);
      expect(msg).not.toContain("test-");
      expect(msg).not.toContain("test");
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

  // ── SUBSCRIPTION_CANCELLATION payload structure ─────────────────────

  it("extracts cancellationDate from data.cancellation_date", () => {
    const epoch = 1744130948000;
    const payload = buildCancellationPayload({
      data: {
        ...buildCancellationPayload().data,
        cancellation_date: epoch,
      },
    });
    const fields = extractWebhookFields(payload);
    expect(fields.cancellationDate).toBeInstanceOf(Date);
    expect(fields.cancellationDate?.getTime()).toBe(epoch);
  });

  it("returns undefined cancellationDate when not present", () => {
    const payload = buildHotmartWebhookPayload();
    const fields = extractWebhookFields(payload);
    expect(fields.cancellationDate).toBeUndefined();
  });

  it("extracts subscriber fields from data.subscriber (no buyer block)", () => {
    const payload = buildCancellationPayload();
    const fields = extractWebhookFields(payload);
    expect(fields.subscriberCode).toBe("SUB_CODE_1");
    expect(fields.subscriberEmail).toBe("subscriber@test.com");
    expect(fields.subscriptionExternalId).toBe("SUB-CANCEL-1");
    expect(fields.subscriptionStatus).toBe("CANCELLED");
  });

  it("falls back buyerName to subscriber.name when no buyer block", () => {
    const payload = buildCancellationPayload();
    const fields = extractWebhookFields(payload);
    // No data.buyer → buyerName should come from data.subscriber.name
    expect(fields.buyerName).toBe("Test Subscriber");
  });

  it("falls back buyerEmail to subscriberEmail when no buyer block", () => {
    const payload = buildCancellationPayload();
    const fields = extractWebhookFields(payload);
    // No data.buyer → buyerEmail should fall back to subscriberEmail
    expect(fields.buyerEmail).toBe("subscriber@test.com");
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
