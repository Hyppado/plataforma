/**
 * Tests: lib/echotik/cron/syncProducts.ts
 *
 * Full coverage: syncProductRanklistForRegion, syncProductRanklist, syncRanklistProductDetails
 * Covers: date discovery, pagination, upsert, empty pages, API errors,
 * product detail enrichment, batch failures, individual retries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const prismaMock = vi.hoisted(() => ({
  echotikProductTrendDaily: {
    upsert: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  echotikRawResponse: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  echotikProductDetail: {
    upsert: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  region: {
    findMany: vi.fn().mockResolvedValue([{ code: "US", sortOrder: 1 }]),
  },
}));

const echotikRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@/lib/echotik/client", () => ({
  echotikRequest: echotikRequestMock,
}));

vi.mock("@/lib/echotik/rankFields", () => ({
  PRODUCT_RANK_FIELDS: [{ field: 1, key: "sales", label: "Mais vendidos" }],
}));

import {
  syncProductRanklistForRegion,
  syncProductRanklist,
  syncRanklistProductDetails,
} from "@/lib/echotik/cron/syncProducts";
import type { Logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function stubLog(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => stubLog(),
    correlationId: "test-corr",
  };
}

function productItem(id: string, overrides = {}) {
  return {
    product_id: id,
    product_name: `Product ${id}`,
    category_id: "cat-1",
    category_l2_id: "cat-2",
    category_l3_id: "cat-3",
    min_price: 10.0,
    max_price: 20.0,
    spu_avg_price: 15.0,
    product_commission_rate: 0.05,
    total_sale_cnt: 500,
    total_sale_gmv_amt: 7500.0,
    total_ifl_cnt: 20,
    total_video_cnt: 30,
    total_live_cnt: 5,
    region: "US",
    ...overrides,
  };
}

function apiOk(data: unknown[]) {
  return { code: 0, message: "ok", data, requestId: "r" };
}

function apiEmpty() {
  return { code: 0, message: "ok", data: [], requestId: "r" };
}

// ---------------------------------------------------------------------------
// syncProductRanklistForRegion
// ---------------------------------------------------------------------------
describe("syncProductRanklistForRegion()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discovers date, paginates, and upserts products", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([productItem("p1")])) // date check
      .mockResolvedValueOnce(apiOk([productItem("p1"), productItem("p2")])) // page 1
      .mockResolvedValueOnce(apiEmpty()); // page 2

    const count = await syncProductRanklistForRegion(
      "run-1",
      "US",
      1,
      1,
      stubLog(),
    );

    expect(count).toBe(2);
    expect(prismaMock.echotikProductTrendDaily.upsert).toHaveBeenCalledTimes(2);
  });

  it("returns 0 when no date has data", async () => {
    echotikRequestMock.mockResolvedValue(apiEmpty());
    const log = stubLog();

    const count = await syncProductRanklistForRegion("run-1", "US", 1, 1, log);

    expect(count).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(
      "No product data available",
      expect.objectContaining({ region: "US" }),
    );
  });

  it("converts gmv to cents and uses correct currency", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([productItem("p1")])) // date check
      .mockResolvedValueOnce(
        apiOk([productItem("p1", { total_sale_gmv_amt: 49.99 })]),
      )
      .mockResolvedValueOnce(apiEmpty());

    await syncProductRanklistForRegion("run-1", "US", 1, 1, stubLog());

    const call = prismaMock.echotikProductTrendDaily.upsert.mock.calls[0][0];
    expect(call.create.gmv).toBe(BigInt(4999));
    expect(call.create.currency).toBe("USD");
  });

  it("skips items without product_id", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([productItem("p1")])) // date check
      .mockResolvedValueOnce(
        apiOk([
          productItem(""), // no id
          productItem("p2"),
        ]),
      )
      .mockResolvedValueOnce(apiEmpty());

    const count = await syncProductRanklistForRegion(
      "run-1",
      "US",
      1,
      1,
      stubLog(),
    );
    expect(count).toBe(1);
  });

  it("throws on API error code", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([productItem("p1")])) // date check
      .mockResolvedValueOnce({
        code: 1001,
        message: "Limit",
        data: [],
        requestId: "r",
      });

    await expect(
      syncProductRanklistForRegion("run-1", "US", 1, 1, stubLog()),
    ).rejects.toThrow("Product API error");
  });

  it("throws on network failure", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([productItem("p1")])) // date check
      .mockRejectedValueOnce(new Error("ETIMEDOUT"));

    await expect(
      syncProductRanklistForRegion("run-1", "US", 1, 1, stubLog()),
    ).rejects.toThrow("ETIMEDOUT");
  });

  it("calculates rank positions correctly across pages", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([productItem("p1")])) // date check
      .mockResolvedValueOnce(
        apiOk(Array.from({ length: 10 }, (_, i) => productItem(`p${i + 1}`))),
      ) // page 1
      .mockResolvedValueOnce(apiOk([productItem("p11")])) // page 2
      .mockResolvedValueOnce(apiEmpty()); // page 3

    await syncProductRanklistForRegion("run-1", "US", 1, 1, stubLog());

    const calls = prismaMock.echotikProductTrendDaily.upsert.mock.calls;
    expect(calls[0][0].create.rankPosition).toBe(1);
    expect(calls[10][0].create.rankPosition).toBe(11);
  });

  it("uses weekly candidate dates for cycle=2", async () => {
    // Cycle 2 tries thisMonday, lastMonday, yesterday (3 dates)
    echotikRequestMock
      .mockResolvedValueOnce(apiEmpty()) // thisMonday
      .mockResolvedValueOnce(apiEmpty()) // lastMonday
      .mockResolvedValueOnce(apiEmpty()); // yesterday

    const count = await syncProductRanklistForRegion(
      "run-1",
      "US",
      2,
      1,
      stubLog(),
    );
    expect(count).toBe(0);
    // Should have tried 3 dates
    expect(echotikRequestMock).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// syncProductRanklist
// ---------------------------------------------------------------------------
describe("syncProductRanklist()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("iterates cycles × fields for given region", async () => {
    echotikRequestMock.mockResolvedValue(apiEmpty());

    const count = await syncProductRanklist("run-1", "US", stubLog());
    expect(count).toBe(0);
    // 3 cycles × 1 field = 3 iterations, each trying candidate dates
    expect(echotikRequestMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// syncRanklistProductDetails
// ---------------------------------------------------------------------------
describe("syncRanklistProductDetails()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no recent ranklist items", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);

    const count = await syncRanklistProductDetails(stubLog());
    expect(count).toBe(0);
  });

  it("returns 0 when all products already cached", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "p1" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([
      { productExternalId: "p1" },
    ]);

    const count = await syncRanklistProductDetails(stubLog());
    expect(count).toBe(0);
  });

  it("fetches and upserts missing product details", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "p1" },
      { productExternalId: "p2" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);

    echotikRequestMock.mockResolvedValue(
      apiOk([
        {
          product_id: "p1",
          product_name: "Product 1",
          cover_url: null,
          spu_avg_price: 10,
          min_price: 8,
          max_price: 12,
          product_rating: 4.0,
          product_commission_rate: 0.05,
          category_id: "c1",
          region: "US",
        },
        {
          product_id: "p2",
          product_name: "Product 2",
          cover_url: null,
          spu_avg_price: 20,
          min_price: 18,
          max_price: 22,
          product_rating: 3.5,
          product_commission_rate: 0.08,
          category_id: "c2",
          region: "US",
        },
      ]),
    );

    const count = await syncRanklistProductDetails(stubLog());
    expect(count).toBe(2);
    expect(prismaMock.echotikProductDetail.upsert).toHaveBeenCalledTimes(2);
  });

  it("handles batch failure and retries individually", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "p1" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);

    echotikRequestMock
      .mockRejectedValueOnce(new Error("Batch error"))
      .mockResolvedValueOnce(
        apiOk([
          {
            product_id: "p1",
            product_name: "Recovered",
            cover_url: null,
            spu_avg_price: 5,
            min_price: 5,
            max_price: 5,
            product_rating: 4,
            product_commission_rate: 0.05,
            category_id: "c1",
            region: "US",
          },
        ]),
      );

    const log = stubLog();
    const count = await syncRanklistProductDetails(log);

    expect(count).toBe(1);
    expect(log.error).toHaveBeenCalled();
  });

  it("filters out null productExternalId values", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: null },
      { productExternalId: "p1" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);

    echotikRequestMock.mockResolvedValue(
      apiOk([
        {
          product_id: "p1",
          product_name: "Product",
          cover_url: null,
          spu_avg_price: 10,
          min_price: 10,
          max_price: 10,
          product_rating: 4,
          product_commission_rate: 0.05,
          category_id: "c1",
          region: "US",
        },
      ]),
    );

    const count = await syncRanklistProductDetails(stubLog());
    expect(count).toBe(1);
  });
});
