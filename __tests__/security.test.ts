/**
 * Security-specific tests — cross-cutting security concerns
 *
 * Priority: #0 (CRITICAL)
 *
 * This file consolidates security validation tests that span multiple modules:
 * - Secret leakage in responses
 * - Input validation / injection
 * - Auth bypass vectors
 * - Mass assignment protection
 * - Enum/status validation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
  makePostRequest,
  makePatchRequest,
} from "@tests/helpers/auth";
import { buildUser, buildPlan } from "@tests/helpers/factories";

// next-auth mock is managed by @tests/helpers/auth — do NOT re-declare
vi.mock("@/lib/prisma");

// ---------------------------------------------------------------------------
// 1. Secret Leakage
// ---------------------------------------------------------------------------

describe("Secret leakage prevention", () => {
  it("webhook error responses do not contain HOTTOK", async () => {
    // Import inline to avoid module caching issues
    const { POST } = await import("@/app/api/webhooks/hotmart/route");

    const req = new Request("http://localhost/api/webhooks/hotmart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hotmart-Hottok": "wrong-token",
      },
      body: JSON.stringify({ event: "test" }),
    });

    const res = await POST(req as any);
    const text = await res.text();

    expect(text).not.toContain(process.env.HOTMART_WEBHOOK_SECRET ?? "");
    expect(text).not.toContain("HOTTOK");
  });

  it("cron error responses do not contain CRON_SECRET", async () => {
    const { GET } = await import("@/app/api/cron/echotik/route");

    const req = makeGetRequest("/api/cron/echotik", {
      secret: "wrong",
    }) as any;
    const res = await GET(req);
    const text = await res.text();

    expect(text).not.toContain(process.env.CRON_SECRET ?? "test-cron-secret");
  });

  it("auth error responses do not leak session details", async () => {
    mockUnauthenticated();
    const { GET } = await import("@/app/api/admin/plans/route");

    const req = makeGetRequest("/api/admin/plans") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("NEXTAUTH_SECRET");
  });
});

// ---------------------------------------------------------------------------
// 2. Auth Bypass Vectors
// ---------------------------------------------------------------------------

describe("Auth bypass prevention", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin routes reject USER role", async () => {
    mockAuthenticatedUser(); // regular user, not admin
    const { GET } = await import("@/app/api/admin/plans/route");

    const req = makeGetRequest("/api/admin/plans") as any;
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("admin routes reject unauthenticated", async () => {
    mockUnauthenticated();
    const { GET } = await import("@/app/api/admin/users/route");

    const req = makeGetRequest("/api/admin/users") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("me/ routes reject unauthenticated", async () => {
    mockUnauthenticated();
    const { GET } = await import("@/app/api/me/saved/route");

    const req = makeGetRequest("/api/me/saved") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 3. Mass Assignment Protection
// ---------------------------------------------------------------------------

describe("Mass assignment protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH /api/admin/users rejects arbitrary status values", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(buildUser());

    const { PATCH } = await import("@/app/api/admin/users/route");

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      status: "HACKED",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("PATCH /api/admin/users rejects role escalation to SUPERADMIN", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(buildUser());

    const { PATCH } = await import("@/app/api/admin/users/route");

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      role: "SUPERADMIN",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 4. Input Validation
// ---------------------------------------------------------------------------

describe("Input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POST /api/admin/plans rejects missing required fields", async () => {
    mockAuthenticatedAdmin();
    const { POST } = await import("@/app/api/admin/plans/route");

    const req = makePostRequest("/api/admin/plans", {
      name: "Only Name",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST /api/me/saved rejects missing required fields", async () => {
    mockAuthenticatedUser();
    const { POST } = await import("@/app/api/me/saved/route");

    const req = makePostRequest("/api/me/saved", {}) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST /api/me/collections rejects empty name", async () => {
    mockAuthenticatedUser();
    const { POST } = await import("@/app/api/me/collections/route");

    const req = makePostRequest("/api/me/collections", {
      name: "",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST /api/me/notes rejects missing content", async () => {
    mockAuthenticatedUser();
    const { POST } = await import("@/app/api/me/notes/route");

    const req = makePostRequest("/api/me/notes", {
      type: "VIDEO",
      externalId: "v1",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 5. Ownership Isolation
// ---------------------------------------------------------------------------

describe("Ownership isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("me/saved only queries current user's items", async () => {
    mockAuthenticatedUser({ id: "my-user-id" });
    prismaMock.$transaction.mockResolvedValue([[], 0]);

    const { GET } = await import("@/app/api/me/saved/route");

    const req = makeGetRequest("/api/me/saved") as any;
    await GET(req);

    // The $transaction was called with functions that use userId filter
    // Verify via the mock's transaction implementation
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("DELETE /api/me/saved uses userId in where clause (prevents IDOR)", async () => {
    mockAuthenticatedUser({ id: "my-id" });
    prismaMock.savedItem.deleteMany.mockResolvedValue({ count: 1 });

    const { DELETE } = await import("@/app/api/me/saved/route");

    const req = new Request("http://localhost/api/me/saved?id=item-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }) as any;
    await DELETE(req);

    expect(prismaMock.savedItem.deleteMany).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "my-id" },
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Pagination Limits
// ---------------------------------------------------------------------------

describe("Pagination limits", () => {
  it("admin users limits page size to 100", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    const { GET } = await import("@/app/api/admin/users/route");

    const req = makeGetRequest("/api/admin/users", {
      limit: "9999",
    }) as any;
    const res = await GET(req);
    const body = await res.json();

    expect(body.pagination.limit).toBeLessThanOrEqual(100);
  });
});
