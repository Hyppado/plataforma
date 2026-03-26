/**
 * Tests: lib/echotik/cron/syncCreators.ts
 *
 * Full coverage: syncCreatorRanklistForRegion, syncCreatorRanklist
 * Covers: date discovery, pagination, upsert, empty pages, API errors,
 * currency mapping, BigInt fields, rank position calculation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const prismaMock = vi.hoisted(() => ({
  echotikCreatorTrendDaily: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  echotikRawResponse: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  region: {
    findMany: vi.fn().mockResolvedValue([{ code: "MX", sortOrder: 1 }]),
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
  CREATOR_RANK_FIELDS: [{ field: 2, key: "sales", label: "Mais vendidos" }],
}));

import {
  syncCreatorRanklistForRegion,
  syncCreatorRanklist,
} from "@/lib/echotik/cron/syncCreators";
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

function creatorItem(id: string, overrides = {}) {
  return {
    user_id: id,
    unique_id: `@creator_${id}`,
    nick_name: `Creator ${id}`,
    avatar: "https://img/avatar.jpg",
    category: "Beauty",
    ec_score: 85,
    total_followers_cnt: 50000,
    total_followers_history_cnt: 48000,
    total_sale_cnt: 300,
    total_sale_gmv_amt: 5000.0,
    total_sale_history_cnt: 280,
    total_sale_gmv_history_amt: 4500.0,
    total_digg_cnt: 10000,
    total_digg_history_cnt: 9500,
    total_product_cnt: 15,
    total_product_history_cnt: 12,
    total_video_cnt: 40,
    total_post_video_cnt: 38,
    total_live_cnt: 3,
    most_category_id: "cat-1",
    most_category_l2_id: "cat-2",
    most_category_l3_id: "cat-3",
    product_category_list: "[]",
    region: "MX",
    sales_flag: 1,
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
// syncCreatorRanklistForRegion
// ---------------------------------------------------------------------------
describe("syncCreatorRanklistForRegion()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discovers date, paginates, and upserts creators", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce(apiOk([creatorItem("c1"), creatorItem("c2")])) // page 1
      .mockResolvedValueOnce(apiEmpty()); // page 2

    const count = await syncCreatorRanklistForRegion(
      "run-1",
      "MX",
      1,
      2,
      stubLog(),
    );

    expect(count).toBe(2);
    expect(prismaMock.echotikCreatorTrendDaily.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.echotikRawResponse.upsert).toHaveBeenCalledTimes(2);
  });

  it("returns 0 when no date has data", async () => {
    echotikRequestMock.mockResolvedValue(apiEmpty());
    const log = stubLog();

    const count = await syncCreatorRanklistForRegion("run-1", "MX", 1, 2, log);

    expect(count).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(
      "No creator data available",
      expect.objectContaining({ region: "MX" }),
    );
  });

  it("uses MXN currency for MX region", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce(apiOk([creatorItem("c1")]))
      .mockResolvedValueOnce(apiEmpty());

    await syncCreatorRanklistForRegion("run-1", "MX", 1, 2, stubLog());

    const call = prismaMock.echotikCreatorTrendDaily.upsert.mock.calls[0][0];
    expect(call.create.currency).toBe("MXN");
  });

  it("converts gmv to cents (BigInt)", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce(
        apiOk([creatorItem("c1", { total_sale_gmv_amt: 99.99 })]),
      )
      .mockResolvedValueOnce(apiEmpty());

    await syncCreatorRanklistForRegion("run-1", "MX", 1, 2, stubLog());

    const call = prismaMock.echotikCreatorTrendDaily.upsert.mock.calls[0][0];
    expect(call.create.gmv).toBe(BigInt(9999));
  });

  it("stores followers as BigInt", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce(
        apiOk([creatorItem("c1", { total_followers_cnt: 1000000 })]),
      )
      .mockResolvedValueOnce(apiEmpty());

    await syncCreatorRanklistForRegion("run-1", "MX", 1, 2, stubLog());

    const call = prismaMock.echotikCreatorTrendDaily.upsert.mock.calls[0][0];
    expect(call.create.followersCount).toBe(BigInt(1000000));
  });

  it("skips items without user_id", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce(
        apiOk([
          creatorItem(""), // no id
          creatorItem("c2"),
        ]),
      )
      .mockResolvedValueOnce(apiEmpty());

    const count = await syncCreatorRanklistForRegion(
      "run-1",
      "MX",
      1,
      2,
      stubLog(),
    );
    expect(count).toBe(1);
  });

  it("throws on API error code", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce({
        code: 1001,
        message: "Limit",
        data: [],
        requestId: "r",
      });

    await expect(
      syncCreatorRanklistForRegion("run-1", "MX", 1, 2, stubLog()),
    ).rejects.toThrow("Creator API error");
  });

  it("throws on network failure", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      syncCreatorRanklistForRegion("run-1", "MX", 1, 2, stubLog()),
    ).rejects.toThrow("ECONNREFUSED");
  });

  it("calculates rank positions across pages", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce(
        apiOk(Array.from({ length: 10 }, (_, i) => creatorItem(`c${i + 1}`))),
      )
      .mockResolvedValueOnce(apiOk([creatorItem("c11")]))
      .mockResolvedValueOnce(apiEmpty());

    await syncCreatorRanklistForRegion("run-1", "MX", 1, 2, stubLog());

    const calls = prismaMock.echotikCreatorTrendDaily.upsert.mock.calls;
    expect(calls[0][0].create.rankPosition).toBe(1);
    expect(calls[10][0].create.rankPosition).toBe(11);
  });

  it("falls back to history counts when current counts are 0", async () => {
    echotikRequestMock
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce(
        apiOk([
          creatorItem("c1", {
            total_followers_cnt: 0,
            total_followers_history_cnt: 75000,
            total_digg_cnt: 0,
            total_digg_history_cnt: 8000,
          }),
        ]),
      )
      .mockResolvedValueOnce(apiEmpty());

    await syncCreatorRanklistForRegion("run-1", "MX", 1, 2, stubLog());

    const call = prismaMock.echotikCreatorTrendDaily.upsert.mock.calls[0][0];
    expect(call.create.followersCount).toBe(BigInt(75000));
    expect(call.create.diggCount).toBe(BigInt(8000));
  });
});

// ---------------------------------------------------------------------------
// syncCreatorRanklist
// ---------------------------------------------------------------------------
describe("syncCreatorRanklist()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("iterates cycles × fields and aggregates totals", async () => {
    // 3 cycles × 1 field = 3 iterations for region MX
    echotikRequestMock
      // Cycle 1
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // date check
      .mockResolvedValueOnce(apiOk([creatorItem("c1")])) // page 1
      .mockResolvedValueOnce(apiEmpty()) // page 2
      // Cycle 2
      .mockResolvedValueOnce(apiOk([creatorItem("c2")])) // date check
      .mockResolvedValueOnce(apiOk([creatorItem("c2")])) // page 1
      .mockResolvedValueOnce(apiEmpty())
      // Cycle 3
      .mockResolvedValueOnce(apiOk([creatorItem("c3")])) // date check
      .mockResolvedValueOnce(apiOk([creatorItem("c3")])) // page 1
      .mockResolvedValueOnce(apiEmpty());

    const count = await syncCreatorRanklist("run-1", "MX", stubLog());
    expect(count).toBe(3);
  });

  it("returns 0 when region has no data", async () => {
    echotikRequestMock.mockResolvedValue(apiEmpty());

    const count = await syncCreatorRanklist("run-1", "MX", stubLog());
    expect(count).toBe(0);
  });
});
