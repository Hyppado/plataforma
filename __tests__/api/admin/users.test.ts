/**
 * Tests: app/api/admin/users/route.ts — User management (admin)
 *
 * Priority: #2 (Security — user status/role changes)
 * Coverage: auth enforcement, pagination, filters, status/role updates, audit trail
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  mockAuthenticatedUser,
  makeGetRequest,
  makePatchRequest,
} from "@tests/helpers/auth";
import { buildUser } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

import { GET, PATCH } from "@/app/api/admin/users/route";

describe("GET /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/admin/users") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuthenticatedUser();
    const req = makeGetRequest("/api/admin/users") as any;
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns paginated users for admin", async () => {
    mockAuthenticatedAdmin();
    const users = [buildUser(), buildUser()];
    prismaMock.user.findMany.mockResolvedValue(users);
    prismaMock.user.count.mockResolvedValue(2);

    const req = makeGetRequest("/api/admin/users") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toHaveLength(2);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBe(2);
  });

  it("limits page size to 100", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    const req = makeGetRequest("/api/admin/users", {
      limit: "999",
    }) as any;
    const res = await GET(req);
    const body = await res.json();

    // Should cap at 100
    expect(body.pagination.limit).toBeLessThanOrEqual(100);
  });
});

describe("PATCH /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      status: "SUSPENDED",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when userId missing", async () => {
    mockAuthenticatedAdmin();
    const req = makePatchRequest("/api/admin/users", {
      status: "ACTIVE",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = makePatchRequest("/api/admin/users", {
      userId: "missing",
      status: "ACTIVE",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it("updates user status and creates audit log", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.user.update.mockResolvedValue({
      ...user,
      status: "SUSPENDED",
    });
    prismaMock.auditLog.create.mockResolvedValue({});

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      status: "SUSPENDED",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
  });

  it("rejects invalid status values", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue(user);

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      status: "HACKED",
    }) as any;
    const res = await PATCH(req);
    // Invalid status → "Nothing to update" → 400
    expect(res.status).toBe(400);
  });

  it("rejects invalid role values", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue(user);

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      role: "SUPERADMIN",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("allows valid role change (USER → ADMIN)", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "u1", role: "USER" });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.user.update.mockResolvedValue({ ...user, role: "ADMIN" });
    prismaMock.auditLog.create.mockResolvedValue({});

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      role: "ADMIN",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });
});
