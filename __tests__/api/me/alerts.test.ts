/**
 * Tests: app/api/me/alerts/route.ts — Alerts (user-scoped)
 *
 * Priority: #4 (Business rules)
 * Coverage: auth, listing, unread count, mark read/unread, ownership
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
  makePatchRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

import { GET, PATCH } from "@/app/api/me/alerts/route";

describe("GET /api/me/alerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/me/alerts") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns alerts with unread count", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const alerts = [
      {
        id: "a1",
        title: "Info",
        description: null,
        severity: "INFO",
        type: "SYSTEM",
        payloadJson: null,
        read: false,
        createdAt: new Date(),
      },
    ];
    prismaMock.$transaction.mockResolvedValue([alerts, 1, 1]);

    const req = makeGetRequest("/api/me/alerts") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.unreadCount).toBeDefined();
  });
});

describe("PATCH /api/me/alerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires id and read boolean", async () => {
    mockAuthenticatedUser();
    const req = makePatchRequest("/api/me/alerts", { id: "a1" }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("marks alert as read with ownership check", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.alert.updateMany.mockResolvedValue({ count: 1 });

    const req = makePatchRequest("/api/me/alerts", {
      id: "a1",
      read: true,
    }) as any;
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(prismaMock.alert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a1", userId: "user-1" },
        data: { read: true },
      }),
    );
  });

  it("returns 404 when alert not found", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.alert.updateMany.mockResolvedValue({ count: 0 });

    const req = makePatchRequest("/api/me/alerts", {
      id: "nonexistent",
      read: true,
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });
});
