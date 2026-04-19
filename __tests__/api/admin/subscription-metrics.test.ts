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

/** Build a mock Hotmart API response with a given total_results count */
function mockCountResponse(totalResults: number) {
  return {
    items: totalResults > 0 ? [{ subscription_id: 1 }] : [],
    page_info: { total_results: totalResults, results_per_page: 1 },
  };
}

describe("GET /api/admin/subscription-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    mockGetSetting.mockResolvedValue("PROD123");
  });

  /**
   * Setup mocks for the 8 status count calls + 2 date-range calls.
   * Order: ACTIVE, CANCELLED_BY_CUSTOMER, CANCELLED_BY_SELLER,
   *        CANCELLED_BY_ADMIN, DELAYED, OVERDUE, INACTIVE, STARTED,
   *        newThisMonth, cancelledThisMonth
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
      .mockResolvedValueOnce(mockCountResponse(cancelledMonth));
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
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.activeSubscribers).toBe(5);
    expect(body.canceledSubscribers).toBe(2); // 1+1+0
    expect(body.pastDueSubscribers).toBe(1); // 1+0
    expect(body.totalSubscribers).toBe(11); // 5+2+0+1+2+1
  });

  it("retorna newThisMonth e cancelledThisMonth", async () => {
    setupCountMocks({ newMonth: 4, cancelledMonth: 2 });
    const { newThisMonth, cancelledThisMonth } = await (await GET()).json();
    expect(newThisMonth).toBe(4);
    expect(cancelledThisMonth).toBe(2);
  });

  it("retorna periodLabel com ano atual", async () => {
    setupCountMocks();
    const { periodLabel } = await (await GET()).json();
    const year = new Date().getFullYear().toString();
    expect(periodLabel).toMatch(year);
    expect(periodLabel).toMatch(/\d{4}$/);
  });

  it("retorna lastSyncAt null (API mode)", async () => {
    setupCountMocks();
    const { lastSyncAt } = await (await GET()).json();
    expect(lastSyncAt).toBeNull();
  });

  it("envia product_id do Setting em todas as chamadas", async () => {
    mockGetSetting.mockResolvedValue("MY_PROD");
    setupCountMocks();
    await GET();

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

  it("retorna 500 quando getSetting lança erro", async () => {
    mockGetSetting.mockRejectedValue(new Error("DB down"));
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(body.detail).toContain("DB down");
  });

  it("retorna zeros quando todas as chamadas Hotmart falham (graceful)", async () => {
    mockHotmartRequest.mockRejectedValue(new Error("API down"));
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.activeSubscribers).toBe(0);
    expect(body.canceledSubscribers).toBe(0);
    expect(body.totalSubscribers).toBe(0);
  });
});
