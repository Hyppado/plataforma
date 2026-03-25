/**
 * Tests: /api/admin/audit-logs — audit log viewer API
 *
 * Coverage: paginated list, filters (action, userId, date range),
 *           auth protection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

import { GET } from "@/app/api/admin/audit-logs/route";

describe("GET /api/admin/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
  });

  it("returns paginated audit logs", async () => {
    const mockItems = [
      {
        id: "log-1",
        actorId: "system",
        action: "WEBHOOK_PURCHASE_APPROVED",
        entityType: "Subscription",
        entityId: "sub-1",
        createdAt: new Date(),
      },
    ];

    prismaMock.auditLog.findMany.mockResolvedValue(mockItems);
    prismaMock.auditLog.count.mockResolvedValue(1);

    const req = makeGetRequest("/api/admin/audit-logs");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(json.page).toBe(1);
  });

  it("filters by action", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);

    const req = makeGetRequest("/api/admin/audit-logs", {
      action: "WEBHOOK_PURCHASE",
    });
    await GET(req);

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { contains: "WEBHOOK_PURCHASE", mode: "insensitive" },
        }),
      }),
    );
  });

  it("filters by userId", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);

    const req = makeGetRequest("/api/admin/audit-logs", { userId: "user-1" });
    await GET(req);

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });

  it("filters by date range", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);

    const req = makeGetRequest("/api/admin/audit-logs", {
      from: "2025-01-01",
      to: "2025-12-31",
    });
    await GET(req);

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      }),
    );
  });

  it("filters by entityType", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);

    const req = makeGetRequest("/api/admin/audit-logs", {
      entityType: "Subscription",
    });
    await GET(req);

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: "Subscription" }),
      }),
    );
  });

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/admin/audit-logs");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
