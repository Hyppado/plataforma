/**
 * Tests: app/api/admin/plans/route.ts — Plan CRUD (admin)
 *
 * Priority: #3 (Business rules — plan management)
 * Coverage: auth enforcement, CRUD operations, validation, duplicate handling
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  mockAuthenticatedUser,
  makeGetRequest,
  makePostRequest,
  makeDeleteRequest,
} from "@tests/helpers/auth";
import { buildPlan } from "@tests/helpers/factories";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma");

import { GET, POST, PUT, DELETE } from "@/app/api/admin/plans/route";

describe("GET /api/admin/plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated users", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/admin/plans") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockAuthenticatedUser();
    const req = makeGetRequest("/api/admin/plans") as any;
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("lists plans for admin", async () => {
    mockAuthenticatedAdmin();
    const plans = [buildPlan(), buildPlan({ name: "Pro Anual" })];
    prismaMock.plan.findMany.mockResolvedValue(plans);

    const req = makeGetRequest("/api/admin/plans") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.plans).toHaveLength(2);
  });
});

describe("POST /api/admin/plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires admin auth", async () => {
    mockUnauthenticated();
    const req = makePostRequest("/api/admin/plans", {}) as any;
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects when required fields missing", async () => {
    mockAuthenticatedAdmin();
    const req = makePostRequest("/api/admin/plans", {
      name: "Test",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates plan with valid data", async () => {
    mockAuthenticatedAdmin();
    const plan = buildPlan();
    prismaMock.plan.create.mockResolvedValue(plan);

    const req = makePostRequest("/api/admin/plans", {
      code: "test_plan",
      name: "Test Plan",
      priceAmount: 9990,
      periodicity: "MENSAL",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 409 on duplicate code", async () => {
    mockAuthenticatedAdmin();
    prismaMock.plan.create.mockRejectedValue(
      new Error("Unique constraint failed on code"),
    );

    const req = makePostRequest("/api/admin/plans", {
      code: "existing",
      name: "Dup",
      priceAmount: 100,
      periodicity: "MENSAL",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/admin/plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires id in body", async () => {
    mockAuthenticatedAdmin();
    const req = new NextRequest("http://localhost/api/admin/plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-deletes (deactivates) plan", async () => {
    mockAuthenticatedAdmin();
    prismaMock.plan.update.mockResolvedValue({});

    const req = makeDeleteRequest("/api/admin/plans", { id: "plan-1" }) as any;
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("deactivated");
    expect(prismaMock.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      }),
    );
  });

  it("requires id in body", async () => {
    mockAuthenticatedAdmin();

    const req = makeDeleteRequest("/api/admin/plans", {}) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
