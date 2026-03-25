/**
 * Tests: /api/admin/notifications — notification API routes
 *
 * Coverage: GET list w/ filters, PATCH bulk, GET summary, PATCH single,
 *           auth protection (admin-only)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
  makePatchRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

// Route imports
import { GET, PATCH } from "@/app/api/admin/notifications/route";
import { GET as GET_SUMMARY } from "@/app/api/admin/notifications/summary/route";

// ---------------------------------------------------------------------------
// GET /api/admin/notifications
// ---------------------------------------------------------------------------

describe("GET /api/admin/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
  });

  it("returns paginated notifications", async () => {
    const mockItems = [
      {
        id: "notif-1",
        type: "SUBSCRIPTION_CHARGEBACK",
        severity: "CRITICAL",
        title: "Chargeback",
        message: "test",
        status: "UNREAD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prismaMock.adminNotification.findMany.mockResolvedValue(mockItems);
    prismaMock.adminNotification.count.mockResolvedValue(1);

    const req = makeGetRequest("/api/admin/notifications");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(json.page).toBe(1);
    expect(json.totalPages).toBe(1);
  });

  it("filters by status", async () => {
    prismaMock.adminNotification.findMany.mockResolvedValue([]);
    prismaMock.adminNotification.count.mockResolvedValue(0);

    const req = makeGetRequest("/api/admin/notifications", {
      status: "UNREAD",
    });
    await GET(req);

    expect(prismaMock.adminNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "UNREAD" }),
      }),
    );
  });

  it("filters by severity", async () => {
    prismaMock.adminNotification.findMany.mockResolvedValue([]);
    prismaMock.adminNotification.count.mockResolvedValue(0);

    const req = makeGetRequest("/api/admin/notifications", {
      severity: "CRITICAL",
    });
    await GET(req);

    expect(prismaMock.adminNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "CRITICAL" }),
      }),
    );
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/admin/notifications");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/notifications (bulk)
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/notifications (bulk)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
  });

  it("bulk updates notification status", async () => {
    prismaMock.adminNotification.updateMany.mockResolvedValue({ count: 3 });

    const req = makePatchRequest("/api/admin/notifications", {
      ids: ["n1", "n2", "n3"],
      status: "READ",
    });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updated).toBe(3);
    expect(prismaMock.adminNotification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["n1", "n2", "n3"] } },
      data: expect.objectContaining({ status: "READ" }),
    });
  });

  it("sets resolvedAt when archiving", async () => {
    prismaMock.adminNotification.updateMany.mockResolvedValue({ count: 1 });

    const req = makePatchRequest("/api/admin/notifications", {
      ids: ["n1"],
      status: "ARCHIVED",
    });
    await PATCH(req);

    expect(prismaMock.adminNotification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["n1"] } },
      data: expect.objectContaining({
        status: "ARCHIVED",
        resolvedAt: expect.any(Date),
      }),
    });
  });

  it("rejects invalid status", async () => {
    const req = makePatchRequest("/api/admin/notifications", {
      ids: ["n1"],
      status: "INVALID",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("rejects empty ids array", async () => {
    const req = makePatchRequest("/api/admin/notifications", {
      ids: [],
      status: "READ",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makePatchRequest("/api/admin/notifications", {
      ids: ["n1"],
      status: "READ",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/notifications/summary
// ---------------------------------------------------------------------------

describe("GET /api/admin/notifications/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
  });

  it("returns unread, critical, and total counts", async () => {
    // count is called 3 times: unread, critical, total
    prismaMock.adminNotification.count
      .mockResolvedValueOnce(5) // unread
      .mockResolvedValueOnce(2) // critical
      .mockResolvedValueOnce(10); // total

    const res = await GET_SUMMARY();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ unread: 5, critical: 2, total: 10 });
  });

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const res = await GET_SUMMARY();
    expect(res.status).toBe(401);
  });
});
