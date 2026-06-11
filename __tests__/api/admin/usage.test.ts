/**
 * Tests: app/api/admin/usage/route.ts — Usage aggregation by period (admin)
 *
 * Coverage: auth enforcement, aggregation from UsageEvent, totals, search.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  mockAuthenticatedUser,
  makeGetRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");
vi.mock("@/lib/exchange/fetchRate", () => ({
  getStoredUsdRate: vi.fn().mockResolvedValue({
    rate: 5,
    date: "2026-06-03",
    fetchedAt: "2026-06-03T00:00:00.000Z",
  }),
}));

import { GET } from "@/app/api/admin/usage/route";

/** Default mocks for the auxiliary queries the route always runs. */
function setupDefaults() {
  prismaMock.subscription.findMany.mockResolvedValue([] as never);
  prismaMock.accessGrant.findMany.mockResolvedValue([] as never);
  prismaMock.user.findMany.mockResolvedValue([] as never);
  prismaMock.usageEvent.aggregate.mockResolvedValue({
    _min: { occurredAt: null },
  } as never);
}

describe("GET /api/admin/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/admin/usage") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuthenticatedUser();
    const req = makeGetRequest("/api/admin/usage") as any;
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("aggregates usage by user and type", async () => {
    mockAuthenticatedAdmin();
    prismaMock.usageEvent.groupBy.mockResolvedValue([
      {
        userId: "u1",
        type: "TRANSCRIPT",
        _count: { _all: 3 },
        _sum: { tokensUsed: 100 },
      },
      {
        userId: "u1",
        type: "SCRIPT",
        _count: { _all: 2 },
        _sum: { tokensUsed: 50 },
      },
      {
        userId: "u2",
        type: "INSIGHT",
        _count: { _all: 1 },
        _sum: { tokensUsed: 10 },
      },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@test.com" },
      { id: "u2", name: "Bob", email: "bob@test.com" },
    ] as never);

    const req = makeGetRequest("/api/admin/usage?period=all") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.period).toBe("all");
    expect(body.totals.transcripts).toBe(3);
    expect(body.totals.scripts).toBe(2);
    expect(body.totals.insights).toBe(1);
    expect(body.totals.tokens).toBe(160);
    expect(body.totals.users).toBe(2);
    // AI cost is computed and positive (transcripts dominate).
    expect(body.totals.aiCostBrl).toBeGreaterThan(0);

    // Sorted by total desc — u1 (5) before u2 (1)
    expect(body.users[0].id).toBe("u1");
    expect(body.users[0].total).toBe(5);
    expect(body.users[0].situacao).toBe("cadastro");
    expect(body.users[1].id).toBe("u2");
  });

  it("computes real revenue and profit from active subscriptions", async () => {
    mockAuthenticatedAdmin();
    prismaMock.usageEvent.groupBy.mockResolvedValue([
      {
        userId: "u1",
        type: "TRANSCRIPT",
        _count: { _all: 2 },
        _sum: { tokensUsed: 0 },
      },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@test.com" },
    ] as never);
    // One monthly subscriber at R$100,00 and one annual at R$1200,00 (=R$100/mês).
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        userId: "u1",
        plan: { name: "Pro", priceAmount: 10000, periodicity: "MONTHLY" },
      },
      {
        userId: "u2",
        plan: { name: "Anual", priceAmount: 120000, periodicity: "ANNUAL" },
      },
    ] as never);

    const req = makeGetRequest("/api/admin/usage?period=current_month") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.finance.activeSubscribers).toBe(2);
    // MRR = 100 (monthly) + 1200/12 (annual) = 200
    expect(body.finance.mrrBrl).toBeCloseTo(200, 5);
    // Hotmart fee = 9.9% of 200 = 19.8
    expect(body.finance.hotmartFeeBrl).toBeCloseTo(19.8, 5);
    expect(body.finance.netRevenueBrl).toBeCloseTo(180.2, 5);
    // Profit = net revenue − monthly AI cost (small) → close to net revenue
    expect(body.finance.profitMonthlyBrl).toBeLessThan(
      body.finance.netRevenueBrl,
    );
    expect(body.finance.profitMonthlyBrl).toBeGreaterThan(170);
    // The subscriber row reflects its plan and situação.
    expect(body.users[0].planName).toBe("Pro");
    expect(body.users[0].situacao).toBe("assinante");
    expect(body.users[0].monthlyRevenueBrl).toBeCloseTo(100, 5);
  });

  it("labels users with an active grant as cortesia", async () => {
    mockAuthenticatedAdmin();
    prismaMock.usageEvent.groupBy.mockResolvedValue([
      {
        userId: "u1",
        type: "INSIGHT",
        _count: { _all: 1 },
        _sum: { tokensUsed: 500 },
      },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", name: "Carol", email: "carol@test.com" },
    ] as never);
    prismaMock.accessGrant.findMany.mockResolvedValue([
      { userId: "u1" },
    ] as never);

    const req = makeGetRequest("/api/admin/usage") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users[0].situacao).toBe("cortesia");
    expect(body.users[0].planName).toBeNull();
  });

  it("filters by search term", async () => {
    mockAuthenticatedAdmin();
    prismaMock.usageEvent.groupBy.mockResolvedValue([
      {
        userId: "u1",
        type: "TRANSCRIPT",
        _count: { _all: 3 },
        _sum: { tokensUsed: 100 },
      },
      {
        userId: "u2",
        type: "INSIGHT",
        _count: { _all: 1 },
        _sum: { tokensUsed: 10 },
      },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@test.com" },
      { id: "u2", name: "Bob", email: "bob@test.com" },
    ] as never);

    const req = makeGetRequest("/api/admin/usage?search=alice") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Totals reflect the whole period (pre-search)
    expect(body.totals.users).toBe(2);
    // Rows are filtered to the matching user
    expect(body.users).toHaveLength(1);
    expect(body.users[0].id).toBe("u1");
  });

  it("defaults to current_month for invalid period", async () => {
    mockAuthenticatedAdmin();
    prismaMock.usageEvent.groupBy.mockResolvedValue([] as never);

    const req = makeGetRequest("/api/admin/usage?period=bogus") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.period).toBe("current_month");
    expect(body.users).toHaveLength(0);
    expect(body.finance.mrrBrl).toBe(0);
  });
});
