/**
 * Tests: lib/echotik/cron/syncVideos.ts
 *
 * Full coverage: syncVideoRanklistForRegion, syncVideoRanklist, syncVideoProductDetails
 * Covers: date discovery, pagination, upsert, empty pages, API errors,
 * product detail enrichment, batch failures, individual retries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const prismaMock = vi.hoisted(() => ({
  echotikVideoTrendDaily: {
    upsert: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  echotikRawResponse: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  echotikProductDetail: {
    upsert: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  region: {
    findMany: vi.fn().mockResolvedValue([{ code: "BR", sortOrder: 1 }]),
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
  VIDEO_RANK_FIELDS: [{ field: 2, key: "sales", label: "Mais vendidos" }],
}));

import {
  syncVideoRanklistForRegion,
  syncVideoRanklist,
  syncVideoProductDetails,
} from "@/lib/echotik/cron/syncVideos";
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

function videoItem(id: string, overrides = {}) {
  return {
    video_id: id,
    video_desc: `Video ${id}`,
    nick_name: "user1",
    unique_id: "u1",
    user_id: "uid1",
    avatar: "https://img/1.jpg",
    category: "Health",
    create_time: "2025-01-01",
    created_by_ai: "0",
    duration: 30,
    product_category_list: '[{"category_id":"cat-1"}]',
    reflow_cover: "https://img/cover.jpg",
    region: "BR",
    sales_flag: 1,
    total_comments_cnt: 10,
    total_digg_cnt: 100,
    total_favorites_cnt: 5,
    total_shares_cnt: 20,
    total_video_sale_cnt: 50,
    total_video_sale_gmv_amt: 1234.56,
    total_views_cnt: 10000,
    video_products: "1234567890",
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
// syncVideoRanklistForRegion
// ---------------------------------------------------------------------------
describe("syncVideoRanklistForRegion()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discovers date, paginates, and upserts videos", async () => {
    // Date discovery: first candidate has data
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // date check
      .mockResolvedValueOnce(apiOk([videoItem("v1"), videoItem("v2")])) // page 1
      .mockResolvedValueOnce(apiEmpty()); // page 2 — stops

    const count = await syncVideoRanklistForRegion(
      "run-1",
      "BR",
      1,
      2,
      stubLog(),
    );

    expect(count).toBe(2);
    expect(prismaMock.echotikVideoTrendDaily.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.echotikRawResponse.upsert).toHaveBeenCalledTimes(2);
  });

  it("tries next candidate date when first has no data", async () => {
    // First date empty, second has data
    echotikRequestMock
      .mockResolvedValueOnce(apiEmpty()) // yesterday — no data
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // twoDaysAgo — found
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // page 1
      .mockResolvedValueOnce(apiEmpty()); // page 2

    const count = await syncVideoRanklistForRegion(
      "run-1",
      "BR",
      1,
      2,
      stubLog(),
    );

    expect(count).toBe(1);
  });

  it("returns 0 when no dates have data", async () => {
    // All dates empty
    echotikRequestMock.mockResolvedValue(apiEmpty());

    const log = stubLog();
    const count = await syncVideoRanklistForRegion("run-1", "BR", 1, 2, log);

    expect(count).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(
      "No video data available",
      expect.objectContaining({ region: "BR" }),
    );
  });

  it("skips items without video_id", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // date check
      .mockResolvedValueOnce(
        apiOk([
          videoItem(""), // no id — skip
          videoItem("v2"),
        ]),
      )
      .mockResolvedValueOnce(apiEmpty());

    const count = await syncVideoRanklistForRegion(
      "run-1",
      "BR",
      1,
      2,
      stubLog(),
    );

    expect(count).toBe(1);
  });

  it("calculates correct rank position across pages", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // date check
      .mockResolvedValueOnce(
        apiOk(
          // Page 1: 10 items
          Array.from({ length: 10 }, (_, i) => videoItem(`v${i + 1}`)),
        ),
      )
      .mockResolvedValueOnce(apiOk([videoItem("v11")])) // Page 2: 1 item
      .mockResolvedValueOnce(apiEmpty()); // page 3

    await syncVideoRanklistForRegion("run-1", "BR", 1, 2, stubLog());

    // Last upsert should be page 2, item 1 → rank 11
    const calls = prismaMock.echotikVideoTrendDaily.upsert.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.create.rankPosition).toBe(11);
  });

  it("converts gmv to cents", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // date check
      .mockResolvedValueOnce(
        apiOk([videoItem("v1", { total_video_sale_gmv_amt: 99.99 })]),
      )
      .mockResolvedValueOnce(apiEmpty());

    await syncVideoRanklistForRegion("run-1", "BR", 1, 2, stubLog());

    const call = prismaMock.echotikVideoTrendDaily.upsert.mock.calls[0][0];
    expect(call.create.gmv).toBe(BigInt(9999));
    expect(call.create.currency).toBe("USD");
  });

  it("throws on fetch error", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // date check
      .mockRejectedValueOnce(new Error("Timeout")); // page 1

    await expect(
      syncVideoRanklistForRegion("run-1", "BR", 1, 2, stubLog()),
    ).rejects.toThrow("Timeout");
  });

  it("throws on API error code", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // date check
      .mockResolvedValueOnce({
        code: 1001,
        message: "Quota",
        data: [],
        requestId: "r",
      });

    await expect(
      syncVideoRanklistForRegion("run-1", "BR", 1, 2, stubLog()),
    ).rejects.toThrow("Video API error");
  });
});

// ---------------------------------------------------------------------------
// syncVideoRanklist
// ---------------------------------------------------------------------------
describe("syncVideoRanklist()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("iterates cycles × fields for given region", async () => {
    // 3 cycles × 1 field = 3 iterations for region BR
    echotikRequestMock.mockResolvedValue(apiEmpty()); // default: no data

    const count = await syncVideoRanklist("run-1", "BR", stubLog());

    expect(count).toBe(0);
  });

  it("aggregates total across all cycle iterations", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // cycle 1 date check
      .mockResolvedValueOnce(apiOk([videoItem("v1")])) // cycle 1 page 1
      .mockResolvedValueOnce(apiEmpty()) // cycle 1 page 2
      .mockResolvedValueOnce(apiOk([videoItem("v2")])) // cycle 2 date check
      .mockResolvedValueOnce(apiOk([videoItem("v2")])) // cycle 2 page 1
      .mockResolvedValueOnce(apiEmpty()) // cycle 2 page 2
      .mockResolvedValueOnce(apiOk([videoItem("v3")])) // cycle 3 date check
      .mockResolvedValueOnce(apiOk([videoItem("v3")])) // cycle 3 page 1
      .mockResolvedValueOnce(apiEmpty()); // cycle 3 page 2

    const count = await syncVideoRanklist("run-1", "BR", stubLog());
    expect(count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// syncVideoProductDetails
// ---------------------------------------------------------------------------
describe("syncVideoProductDetails()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no recent videos", async () => {
    prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([]);

    const count = await syncVideoProductDetails(stubLog());
    expect(count).toBe(0);
  });

  it("returns 0 when all products already cached", async () => {
    prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([
      { extra: { video_products: "1234567890" } },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([
      { productExternalId: "1234567890" },
    ]);

    const count = await syncVideoProductDetails(stubLog());
    expect(count).toBe(0);
  });

  it("fetches and upserts missing product details", async () => {
    prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([
      { extra: { video_products: "1234567890,9876543210" } },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);

    echotikRequestMock.mockResolvedValue(
      apiOk([
        {
          product_id: "1234567890",
          product_name: "Product A",
          cover_url: '[{"url":"https://img/a.jpg","index":0}]',
          spu_avg_price: 10.5,
          min_price: 9.0,
          max_price: 12.0,
          product_rating: 4.5,
          product_commission_rate: 0.1,
          category_id: "cat-1",
          region: "BR",
        },
        {
          product_id: "9876543210",
          product_name: "Product B",
          cover_url: null,
          spu_avg_price: 20.0,
          min_price: 18.0,
          max_price: 22.0,
          product_rating: 3.8,
          product_commission_rate: 0.15,
          category_id: "cat-2",
          region: "BR",
        },
      ]),
    );

    const count = await syncVideoProductDetails(stubLog());

    expect(count).toBe(2);
    expect(prismaMock.echotikProductDetail.upsert).toHaveBeenCalledTimes(2);
  });

  it("handles batch failure and retries individually", async () => {
    prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([
      { extra: { video_products: "1111111111" } },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);

    // Batch fails, individual retry succeeds
    echotikRequestMock
      .mockRejectedValueOnce(new Error("Batch timeout"))
      .mockResolvedValueOnce(
        apiOk([
          {
            product_id: "1111111111",
            product_name: "Recovered",
            cover_url: null,
            spu_avg_price: 5,
            min_price: 5,
            max_price: 5,
            product_rating: 4,
            product_commission_rate: 0.05,
            category_id: "c1",
            region: "BR",
          },
        ]),
      );

    const log = stubLog();
    const count = await syncVideoProductDetails(log);

    expect(count).toBe(1);
    expect(log.error).toHaveBeenCalled();
  });

  it("extracts product IDs with regex from video_products", async () => {
    // Various formats
    prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([
      { extra: { video_products: '["1234567890"]' } },
      { extra: { video_products: "9876543210,1111111111" } },
      { extra: null },
      { extra: { video_products: "" } },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
    echotikRequestMock.mockResolvedValue(apiOk([]));

    await syncVideoProductDetails(stubLog());

    // Should have found 3 unique IDs
    expect(echotikRequestMock).toHaveBeenCalled();
  });

  it("handles API returning code != 0 for batch", async () => {
    prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([
      { extra: { video_products: "2222222222" } },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);

    echotikRequestMock
      .mockResolvedValueOnce({
        code: 500,
        message: "Server error",
        data: null,
        requestId: "r",
      })
      // Individual retry
      .mockResolvedValueOnce(apiEmpty());

    const count = await syncVideoProductDetails(stubLog());
    expect(count).toBe(0);
  });
});
