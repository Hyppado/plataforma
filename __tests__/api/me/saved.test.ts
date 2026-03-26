/**
 * Tests: app/api/me/saved/route.ts — Saved items (user-scoped)
 *
 * Priority: #4 (Business rules — user content with ownership enforcement)
 * Coverage: auth, listing, upsert, delete, ownership enforcement
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
  makePostRequest,
  makeDeleteRequest,
} from "@tests/helpers/auth";
import { buildSavedItem } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

import { GET, POST, DELETE } from "@/app/api/me/saved/route";

describe("GET /api/me/saved", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/me/saved") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns saved items for authenticated user", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const items = [buildSavedItem(), buildSavedItem()];
    prismaMock.$transaction.mockResolvedValue([items, 2]);

    const req = makeGetRequest("/api/me/saved") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

describe("POST /api/me/saved", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires type, externalId, title", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/me/saved", {
      type: "VIDEO",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("upserts saved item with ownership", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const item = buildSavedItem({ userId: "user-1" });
    prismaMock.savedItem.upsert.mockResolvedValue(item);

    const req = makePostRequest("/api/me/saved", {
      type: "VIDEO",
      externalId: "v123",
      title: "Test Video",
    }) as any;
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(prismaMock.savedItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId_type_externalId: expect.objectContaining({
            userId: "user-1",
          }),
        }),
      }),
    );
  });
});

describe("DELETE /api/me/saved", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires item id", async () => {
    mockAuthenticatedUser();
    const req = makeGetRequest("/api/me/saved") as any;
    // Override to DELETE without id
    const deleteReq = new Request("http://localhost/api/me/saved", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await DELETE(deleteReq);
    expect(res.status).toBe(400);
  });

  it("enforces ownership on delete (userId in where clause)", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.savedItem.deleteMany.mockResolvedValue({ count: 1 });

    const req = new Request("http://localhost/api/me/saved?id=item-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await DELETE(req);

    expect(prismaMock.savedItem.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1", userId: "user-1" },
      }),
    );
  });

  it("returns 404 when item not found", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.savedItem.deleteMany.mockResolvedValue({ count: 0 });

    const req = new Request("http://localhost/api/me/saved?id=nonexistent", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });
});
