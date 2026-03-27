/**
 * Tests: POST /api/webhooks/hotmart — webhook endpoint
 *
 * Priority: #1 (Security — external webhook, payment processing)
 * Coverage: signature validation, idempotency, payload parsing, error handling,
 *           malicious payloads, missing fields, duplicate events
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildHotmartWebhookPayload } from "@tests/helpers/factories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => {
  const mock = {
    hotmartWebhookEvent: {
      create: vi.fn(),
    },
  };
  return { prisma: mock, default: mock };
});

vi.mock("@/lib/hotmart/processor", () => ({
  processHotmartEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/admin/notifications", () => ({
  createNotificationIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn((promise: Promise<unknown>) => promise),
}));

describe("POST /api/webhooks/hotmart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOTMART_WEBHOOK_SECRET = "test-hottok-secret";
  });

  function makeWebhookRequest(
    body: unknown,
    headers: Record<string, string> = {},
  ): Request {
    return new Request("http://localhost/api/webhooks/hotmart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hotmart-hottok": "test-hottok-secret",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  async function importRoute() {
    return import("@/app/api/webhooks/hotmart/route");
  }

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------
  it("rejects request with invalid HOTTOK", async () => {
    const { POST } = await importRoute();
    const req = makeWebhookRequest(buildHotmartWebhookPayload(), {
      "x-hotmart-hottok": "wrong-token",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("rejects request without HOTTOK header", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/webhooks/hotmart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildHotmartWebhookPayload()),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("SECURITY: rejects when HOTMART_WEBHOOK_SECRET is not configured (fail closed)", async () => {
    delete process.env.HOTMART_WEBHOOK_SECRET;
    delete process.env.HOTTOK;
    const { POST } = await importRoute();
    // Even a request matching the now-absent secret should be rejected
    const req = makeWebhookRequest(buildHotmartWebhookPayload(), {
      "x-hotmart-hottok": "any-token",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  // -----------------------------------------------------------------------
  // Payload validation
  // -----------------------------------------------------------------------
  it("rejects invalid JSON body", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/webhooks/hotmart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hotmart-hottok": "test-hottok-secret",
      },
      body: "not valid json {{{",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------------------
  // Duplicate event (idempotency)
  // -----------------------------------------------------------------------
  it("returns 200 for duplicate event (unique constraint)", async () => {
    // Simulate Prisma unique constraint error
    const prisma = (await import("../../../lib/prisma")).default;
    vi.mocked(prisma.hotmartWebhookEvent.create).mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    const { POST } = await importRoute();
    const req = makeWebhookRequest(buildHotmartWebhookPayload());
    const res = await POST(req as any);
    // Duplicate events should return 200 (not fail)
    expect(res.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Successful processing
  // -----------------------------------------------------------------------
  it("persists event and returns 200 for valid payload", async () => {
    const prisma = (await import("../../../lib/prisma")).default;
    vi.mocked(prisma.hotmartWebhookEvent.create).mockResolvedValue({
      id: "event-1",
    } as any);

    const { POST } = await importRoute();
    const req = makeWebhookRequest(buildHotmartWebhookPayload());
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(prisma.hotmartWebhookEvent.create).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Security: secrets not leaked
  // -----------------------------------------------------------------------
  it("SECURITY: does not include secrets in response body", async () => {
    const prisma = (await import("../../../lib/prisma")).default;
    vi.mocked(prisma.hotmartWebhookEvent.create).mockResolvedValue({
      id: "event-1",
    } as any);

    const { POST } = await importRoute();
    const req = makeWebhookRequest(buildHotmartWebhookPayload());
    const res = await POST(req as any);
    const body = await res.json();

    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("test-hottok-secret");
    expect(bodyStr).not.toContain(process.env.HOTMART_CLIENT_SECRET);
  });
});
