/**
 * Tests: app/api/me/collections/route.ts — Collections (user-scoped)
 *
 * Priority: #4 (Business rules — user content)
 * Coverage: auth, CRUD, ownership enforcement, validation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
  makePostRequest,
} from "@tests/helpers/auth";
import { buildCollection } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

import { GET, POST, DELETE } from "@/app/api/me/collections/route";

describe("GET /api/me/collections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/me/collections") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns collections for authenticated user", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const items = [
      { ...buildCollection(), _count: { items: 3 } },
      { ...buildCollection(), _count: { items: 0 } },
    ];
    prismaMock.$transaction.mockResolvedValue([items, 2]);

    const req = makeGetRequest("/api/me/collections") as any;
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

describe("POST /api/me/collections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires collection name", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/me/collections", {}) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects empty name", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/me/collections", {
      name: "   ",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates collection with trimmed name", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const col = { ...buildCollection(), _count: { items: 0 } };
    prismaMock.collection.create.mockResolvedValue(col);

    const req = makePostRequest("/api/me/collections", {
      name: "  My Col  ",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMock.collection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          name: "My Col",
        }),
      }),
    );
  });
});

describe("DELETE /api/me/collections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires collection id", async () => {
    mockAuthenticatedUser();
    const req = new Request("http://localhost/api/me/collections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("enforces ownership on delete", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.collection.deleteMany.mockResolvedValue({ count: 1 });

    const req = new Request("http://localhost/api/me/collections?id=col-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await DELETE(req);
    expect(prismaMock.collection.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "col-1", userId: "user-1" },
      }),
    );
  });
});
