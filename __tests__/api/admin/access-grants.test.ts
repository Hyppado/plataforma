/**
 * Tests: app/api/admin/access-grants/route.ts — Access grant management
 *
 * Priority: #2 (Security — manual access control)
 * Coverage: auth, CRUD, validation, user/plan verification, audit trail
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
  makePostRequest,
  makeDeleteRequest,
} from "@tests/helpers/auth";
import {
  buildUser,
  buildPlan,
  buildAccessGrant,
} from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

import { GET, POST, DELETE } from "@/app/api/admin/access-grants/route";

describe("GET /api/admin/access-grants", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/admin/access-grants") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("lists active grants for admin", async () => {
    mockAuthenticatedAdmin();
    const grants = [buildAccessGrant(), buildAccessGrant()];
    prismaMock.accessGrant.findMany.mockResolvedValue(grants);

    const req = makeGetRequest("/api/admin/access-grants") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.grants).toHaveLength(2);
  });
});

describe("POST /api/admin/access-grants", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires userId and reason", async () => {
    mockAuthenticatedAdmin();
    const req = makePostRequest("/api/admin/access-grants", {
      userId: "u1",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = makePostRequest("/api/admin/access-grants", {
      userId: "missing",
      reason: "Test grant",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 when plan not found", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.plan.findUnique.mockResolvedValue(null);

    const req = makePostRequest("/api/admin/access-grants", {
      userId: "u1",
      reason: "Comp",
      planId: "bad-plan",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("creates grant with audit log (201)", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.create.mockResolvedValue(buildAccessGrant());
    prismaMock.auditLog.create.mockResolvedValue({});

    const req = makePostRequest("/api/admin/access-grants", {
      userId: "u1",
      reason: "Trial extension",
    }) as any;
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ACCESS_GRANT_CREATED",
        }),
      }),
    );
  });
});

describe("DELETE /api/admin/access-grants", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires grantId", async () => {
    mockAuthenticatedAdmin();
    const req = makeDeleteRequest("/api/admin/access-grants", {}) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when grant not found", async () => {
    mockAuthenticatedAdmin();
    prismaMock.accessGrant.findUnique.mockResolvedValue(null);

    const req = makeDeleteRequest("/api/admin/access-grants", {
      grantId: "missing",
    }) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("revokes grant with audit log", async () => {
    mockAuthenticatedAdmin();
    prismaMock.accessGrant.findUnique.mockResolvedValue(
      buildAccessGrant({ id: "g1", userId: "u1" }),
    );
    prismaMock.accessGrant.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const req = makeDeleteRequest("/api/admin/access-grants", {
      grantId: "g1",
    }) as any;
    const res = await DELETE(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(prismaMock.accessGrant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });
});
