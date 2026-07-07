/**
 * Tests: app/api/admin/subscription-metrics/route.ts
 *
 * Route now queries Hotmart API instead of local DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthenticatedAdmin } from "@tests/helpers/auth";
import { GET } from "@/app/api/admin/subscription-metrics/route";

vi.mock("@/lib/hotmart/client");
vi.mock("@/lib/settings");

import { hotmartRequest } from "@/lib/hotmart/client";
import { getSetting } from "@/lib/settings";

const mockHotmartRequest = vi.mocked(hotmartRequest);
const mockGetSetting = vi.mocked(getSetting);

/** Build a Request for the route (optional month/year query params). */
function buildRequest(params?: { month?: number; year?: number }): Request {
  const url = new URL("http://localhost/api/admin/subscription-metrics");
  if (params?.month != null) url.searchParams.set("month", String(params.month));
  if (params?.year != null) url.searchParams.set("year", String(params.year));
  return new Request(url);
}

/** Build a mock Hotmart API response with a given total_results count */
function mockCountResponse(totalResults: number) {
  return {
    items: totalResults > 0 ? [{ subscription_id: 1 }] : [],
    page_info: { total_results: totalResults, results_per_page: 1 },
  };
}

describe("GET /api/admin/subscription-metrics", () => {
  /** Build a mock Sales Summary response with a given BRL total (main currency unit) */
  function mockSalesSummaryResponse(totalBRL = 0) {
    return {
      items:
        totalBRL > 0
          ? [
              {
                total_items: 1,
                total_value: { value: totalBRL, currency_code: "BRL" },
              },
            ]
          : [],
      page_info: { total_results: totalBRL > 0 ? 1 : 0, results_per_page: 1 },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    mockGetSetting.mockResolvedValue("PROD123");
  });

  /**
   * Setup mocks for all hotmartRequest calls in order:
   * 1-8: status counts (parallel Promise.all)
   *      ACTIVE, CANCELLED_BY_CUSTOMER, CANCELLED_BY_SELLER, CANCELLED_BY_ADMIN,
   *      DELAYED, OVERDUE, INACTIVE, STARTED
   * 9:   newThisMonth (accession_date filter)
   * 10:  cancelledThisMonth (end_date filter)
   * 11:  sales summary APPROVED (faturado — compras do mês)
   * 12:  sales summary COMPLETE (liquidado)
   * 13:  sales summary APPROVED previsto (data+7d no mês)
   */
  function setupCountMocks({
    active = 5,
    cancelledByCustomer = 1,
    cancelledBySeller = 0,
    cancelledByAdmin = 1,
    delayed = 1,
    overdue = 0,
    inactive = 2,
    started = 0,
    newMonth = 3,
    cancelledMonth = 1,
    revenueBRL = 0,
    revenueCompletedBRL = 0,
    revenuePrevistooBRL = 0,
  } = {}) {
    mockHotmartRequest
      .mockResolvedValueOnce(mockCountResponse(active))
      .mockResolvedValueOnce(mockCountResponse(cancelledByCustomer))
      .mockResolvedValueOnce(mockCountResponse(cancelledBySeller))
      .mockResolvedValueOnce(mockCountResponse(cancelledByAdmin))
      .mockResolvedValueOnce(mockCountResponse(delayed))
      .mockResolvedValueOnce(mockCountResponse(overdue))
      .mockResolvedValueOnce(mockCountResponse(inactive))
      .mockResolvedValueOnce(mockCountResponse(started))
      .mockResolvedValueOnce(mockCountResponse(newMonth))
      .mockResolvedValueOnce(mockCountResponse(cancelledMonth))
      .mockResolvedValueOnce(mockSalesSummaryResponse(revenueBRL))
      .mockResolvedValueOnce(mockSalesSummaryResponse(revenueCompletedBRL))
      .mockResolvedValueOnce(mockSalesSummaryResponse(revenuePrevistooBRL));
  }

  it("retorna contagens corretas para cada status agrupado", async () => {
    setupCountMocks({
      active: 5,
      cancelledByCustomer: 1,
      cancelledBySeller: 1,
      cancelledByAdmin: 0,
      delayed: 1,
      overdue: 0,
      inactive: 2,
      started: 1,
    });
    const res = await GET(buildRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.activeSubscribers).toBe(5);
    expect(body.canceledSubscribers).toBe(2); // 1+1+0
    expect(body.pastDueSubscribers).toBe(1); // 1+0
    expect(body.totalSubscribers).toBe(11); // 5+2+0+1+2+1
  });

  it("retorna newThisMonth e cancelledThisMonth", async () => {
    setupCountMocks({ newMonth: 4, cancelledMonth: 2 });
    const { newThisMonth, cancelledThisMonth } = await (
      await GET(buildRequest())
    ).json();
    expect(newThisMonth).toBe(4);
    expect(cancelledThisMonth).toBe(2);
  });

  it("retorna periodLabel com ano atual", async () => {
    setupCountMocks();
    const { periodLabel } = await (await GET(buildRequest())).json();
    const year = new Date().getFullYear().toString();
    expect(periodLabel).toMatch(year);
    expect(periodLabel).toMatch(/\d{4}$/);
  });

  it("retorna lastSyncAt null (API mode)", async () => {
    setupCountMocks();
    const { lastSyncAt } = await (await GET(buildRequest())).json();
    expect(lastSyncAt).toBeNull();
  });

  it("envia product_id do Setting em todas as chamadas", async () => {
    mockGetSetting.mockResolvedValue("MY_PROD");
    setupCountMocks();
    await GET(buildRequest());

    // The first 8 calls are status counts; each should include product_id
    for (let i = 0; i < 8; i++) {
      const call = mockHotmartRequest.mock.calls[i];
      expect(call[1]).toEqual(
        expect.objectContaining({
          params: expect.objectContaining({ product_id: "MY_PROD" }),
        }),
      );
    }
  });

  it("retorna revenueThisMonthCents a partir da Sales Summary da Hotmart (APPROVED)", async () => {
    // 197.0 BRL APPROVED + 50.0 BRL COMPLETE = 24700 cents total
    setupCountMocks({ revenueBRL: 197, revenueCompletedBRL: 50 });
    const { revenueThisMonthCents } = await (await GET(buildRequest())).json();
    expect(revenueThisMonthCents).toBe(24700); // 19700 + 5000
  });

  it("retorna revenueApprovedCents (previsto) com janela de -7 dias", async () => {
    setupCountMocks({ revenueBRL: 197, revenueCompletedBRL: 50, revenuePrevistooBRL: 30 });
    const { revenueApprovedCents } = await (await GET(buildRequest())).json();
    expect(revenueApprovedCents).toBe(3000); // previsto = 30 BRL
  });

  it("a chamada de previsto usa start_date e end_date com -7 dias", async () => {
    setupCountMocks({ revenueBRL: 100, revenuePrevistooBRL: 20 });
    // Usa abril/2026 (mês passado) — endOfMonth é determinístico (new Date(2026, 4, 1))
    await GET(buildRequest({ month: 4, year: 2026 }));
    // call 12 (0-based) = previsto
    const provistoCall = mockHotmartRequest.mock.calls[12];
    expect(provistoCall[0]).toBe("/payments/api/v1/sales/summary");
    expect(provistoCall[1]?.params).toMatchObject({ transaction_status: "APPROVED" });
    const SETTLE_MS = 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(2026, 3, 1).getTime(); // April 1
    const monthEnd = new Date(2026, 4, 1).getTime();   // May 1 (exclusive)
    expect(provistoCall[1]?.params?.start_date).toBe(monthStart - SETTLE_MS);
    expect(provistoCall[1]?.params?.end_date).toBe(monthEnd - SETTLE_MS);
  });

  it("retorna revenueCompletedCents a partir da Sales Summary da Hotmart (COMPLETE)", async () => {
    setupCountMocks({ revenueBRL: 197, revenueCompletedBRL: 50 });
    const { revenueCompletedCents } = await (await GET(buildRequest())).json();
    expect(revenueCompletedCents).toBe(5000);
  });

  it("retorna revenueThisMonthCents como 0 quando não há transações APPROVED nem COMPLETE", async () => {
    setupCountMocks({ revenueBRL: 0, revenueCompletedBRL: 0 });
    const { revenueThisMonthCents } = await (await GET(buildRequest())).json();
    expect(revenueThisMonthCents).toBe(0);
  });

  it("envia transaction_status=APPROVED e COMPLETE com filtros de data para a Sales Summary", async () => {
    setupCountMocks({ revenueBRL: 100 });
    await GET(buildRequest());
    // call index 10 = APPROVED (faturado), 11 = COMPLETE, 12 = APPROVED (previsto)
    const approvedCall = mockHotmartRequest.mock.calls[10];
    const completeCall = mockHotmartRequest.mock.calls[11];
    expect(approvedCall[0]).toBe("/payments/api/v1/sales/summary");
    expect(approvedCall[1]?.params).toMatchObject({
      transaction_status: "APPROVED",
      product_id: "PROD123",
    });
    expect(approvedCall[1]?.params).toHaveProperty("start_date");
    expect(approvedCall[1]?.params).toHaveProperty("end_date");
    expect(completeCall[1]?.params).toMatchObject({
      transaction_status: "COMPLETE",
      product_id: "PROD123",
    });
  });

  it("usa month/year da query para o periodLabel", async () => {
    setupCountMocks();
    const { periodLabel } = await (
      await GET(buildRequest({ month: 1, year: 2025 }))
    ).json();
    expect(periodLabel).toBe("Janeiro 2025");
  });

  it("retorna 500 quando getSetting lança erro", async () => {
    mockGetSetting.mockRejectedValue(new Error("DB down"));
    const res = await GET(buildRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(body.detail).toContain("DB down");
  });

  it("retorna zeros quando todas as chamadas Hotmart falham (graceful)", async () => {
    mockHotmartRequest.mockRejectedValue(new Error("API down"));
    const res = await GET(buildRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.activeSubscribers).toBe(0);
    expect(body.canceledSubscribers).toBe(0);
    expect(body.totalSubscribers).toBe(0);
  });
});
