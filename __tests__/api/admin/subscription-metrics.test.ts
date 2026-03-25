/**
 * Tests: app/api/admin/subscription-metrics/route.ts
 *
 * Route now queries local DB instead of Hotmart API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthenticatedAdmin } from "@tests/helpers/auth";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { GET } from "@/app/api/admin/subscription-metrics/route";

vi.mock("@/lib/prisma");

describe("GET /api/admin/subscription-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
  });

  function setupCountMocks({
    active = 5,
    cancelled = 2,
    pastDue = 1,
    total = 10,
    newMonth = 3,
    cancelledMonth = 1,
    revenueSum = 49900,
  } = {}) {
    prismaMock.subscription.count
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(cancelled)
      .mockResolvedValueOnce(pastDue)
      .mockResolvedValueOnce(total)
      .mockResolvedValueOnce(newMonth)
      .mockResolvedValueOnce(cancelledMonth);

    prismaMock.subscriptionCharge.aggregate.mockResolvedValue({
      _sum: { amountCents: revenueSum },
    });

    prismaMock.subscription.findFirst.mockResolvedValue({
      updatedAt: new Date("2024-06-15"),
    });
  }

  it("retorna contagens corretas para cada status", async () => {
    setupCountMocks({ active: 5, cancelled: 2, pastDue: 1, total: 10 });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.activeSubscribers).toBe(5);
    expect(body.canceledSubscribers).toBe(2);
    expect(body.pastDueSubscribers).toBe(1);
    expect(body.totalSubscribers).toBe(10);
  });

  it("retorna newThisMonth e cancelledThisMonth", async () => {
    setupCountMocks({ newMonth: 4, cancelledMonth: 2 });
    const { newThisMonth, cancelledThisMonth } = await (await GET()).json();
    expect(newThisMonth).toBe(4);
    expect(cancelledThisMonth).toBe(2);
  });

  it("retorna revenueThisMonthCents da agregacao de charges", async () => {
    setupCountMocks({ revenueSum: 99800 });
    const { revenueThisMonthCents } = await (await GET()).json();
    expect(revenueThisMonthCents).toBe(99800);
  });

  it("retorna 0 quando nao ha cobranças no mes", async () => {
    setupCountMocks();
    prismaMock.subscriptionCharge.aggregate.mockResolvedValue({
      _sum: { amountCents: null },
    });
    const { revenueThisMonthCents } = await (await GET()).json();
    expect(revenueThisMonthCents).toBe(0);
  });

  it("retorna periodLabel com ano atual", async () => {
    setupCountMocks();
    const { periodLabel } = await (await GET()).json();
    const year = new Date().getFullYear().toString();
    expect(periodLabel).toMatch(year);
    expect(periodLabel).toMatch(/\d{4}$/);
  });

  it("retorna lastSyncAt quando ha subscriptions", async () => {
    setupCountMocks();
    const { lastSyncAt } = await (await GET()).json();
    expect(lastSyncAt).toBe("2024-06-15T00:00:00.000Z");
  });

  it("retorna lastSyncAt null quando nao ha subscriptions", async () => {
    setupCountMocks();
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    const { lastSyncAt } = await (await GET()).json();
    expect(lastSyncAt).toBeNull();
  });

  it("retorna 500 quando DB lanca erro", async () => {
    prismaMock.subscription.count.mockRejectedValue(new Error("DB down"));
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(body.detail).toContain("DB down");
  });
});
