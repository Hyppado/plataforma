/**
 * Tests: lib/echotik/cron/syncCategories.ts
 *
 * Full coverage: syncCategoriesForLevel, syncAllCategories
 * Covers: API success, API error codes, fetch failures, L2/L3 skip logic,
 * slug generation, parentExternalId handling, empty data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const prismaMock = vi.hoisted(() => ({
  echotikCategory: {
    upsert: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  echotikRawResponse: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  ingestionRun: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "run-1" }),
  },
  setting: {
    // return null → translateCategories skips (no API key configured)
    findUnique: vi.fn().mockResolvedValue(null),
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

import {
  syncCategoriesForLevel,
  syncAllCategories,
} from "@/lib/echotik/cron/syncCategories";
import type { Logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Logger stub
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const categoryItems = [
  {
    category_id: "cat-1",
    category_name: "Electronics",
    category_level: "1",
    language: "en-US",
    parent_id: "0",
  },
  {
    category_id: "cat-2",
    category_name: "Health & Beauty",
    category_level: "1",
    language: "en-US",
    parent_id: "0",
  },
];

function apiOk(data: unknown[] = categoryItems) {
  return { code: 0, message: "ok", data, requestId: "req-1" };
}

function apiError(code = 1001) {
  return { code, message: "Quota exceeded", data: [], requestId: "req-1" };
}

// ---------------------------------------------------------------------------
// syncCategoriesForLevel
// ---------------------------------------------------------------------------
describe("syncCategoriesForLevel()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts each category and returns count", async () => {
    echotikRequestMock.mockResolvedValueOnce(apiOk());

    const count = await syncCategoriesForLevel(1, "run-1", stubLog());

    expect(count).toBe(2);
    expect(prismaMock.echotikCategory.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.echotikRawResponse.upsert).toHaveBeenCalledTimes(1);
  });

  it("generates correct slug from category name", async () => {
    echotikRequestMock.mockResolvedValueOnce(apiOk());

    await syncCategoriesForLevel(1, "run-1", stubLog());

    const firstCall = prismaMock.echotikCategory.upsert.mock.calls[0][0];
    expect(firstCall.create.slug).toBe("electronics");

    const secondCall = prismaMock.echotikCategory.upsert.mock.calls[1][0];
    expect(secondCall.create.slug).toBe("health-beauty");
  });

  it("handles non-zero parent_id", async () => {
    const items = [
      {
        category_id: "cat-10",
        category_name: "Laptops",
        category_level: "2",
        language: "en-US",
        parent_id: "cat-1",
      },
    ];
    echotikRequestMock.mockResolvedValueOnce(apiOk(items));

    await syncCategoriesForLevel(2, "run-1", stubLog());

    const call = prismaMock.echotikCategory.upsert.mock.calls[0][0];
    expect(call.create.parentExternalId).toBe("cat-1");
    expect(call.create.level).toBe(2);
  });

  it("treats parent_id '0' as null", async () => {
    echotikRequestMock.mockResolvedValueOnce(apiOk());

    await syncCategoriesForLevel(1, "run-1", stubLog());

    const call = prismaMock.echotikCategory.upsert.mock.calls[0][0];
    expect(call.create.parentExternalId).toBeNull();
  });

  it("throws on API error code", async () => {
    echotikRequestMock.mockResolvedValueOnce(apiError());

    await expect(syncCategoriesForLevel(1, "run-1", stubLog())).rejects.toThrow(
      "API returned error for L1",
    );
  });

  it("throws on network error and logs it", async () => {
    echotikRequestMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    const log = stubLog();

    await expect(syncCategoriesForLevel(1, "run-1", log)).rejects.toThrow(
      "ECONNRESET",
    );
    expect(log.error).toHaveBeenCalledWith(
      "Failed to fetch L1 categories",
      expect.objectContaining({ error: "ECONNRESET" }),
    );
  });

  it("returns 0 for empty data array", async () => {
    echotikRequestMock.mockResolvedValueOnce(apiOk([]));

    const count = await syncCategoriesForLevel(1, "run-1", stubLog());
    expect(count).toBe(0);
    expect(prismaMock.echotikCategory.upsert).not.toHaveBeenCalled();
  });

  it("skips items without category_id", async () => {
    const items = [
      {
        category_id: "",
        category_name: "Bad",
        category_level: "1",
        language: "en-US",
        parent_id: "0",
      },
      {
        category_id: "cat-5",
        category_name: "Good",
        category_level: "1",
        language: "en-US",
        parent_id: "0",
      },
    ];
    echotikRequestMock.mockResolvedValueOnce(apiOk(items));

    const count = await syncCategoriesForLevel(1, "run-1", stubLog());
    expect(count).toBe(1);
  });

  it("falls back to param level when category_level is invalid", async () => {
    const items = [
      {
        category_id: "cat-6",
        category_name: "Test",
        category_level: "abc",
        language: "en-US",
        parent_id: "0",
      },
    ];
    echotikRequestMock.mockResolvedValueOnce(apiOk(items));

    await syncCategoriesForLevel(3, "run-1", stubLog());

    const call = prismaMock.echotikCategory.upsert.mock.calls[0][0];
    expect(call.create.level).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// syncAllCategories
// ---------------------------------------------------------------------------
describe("syncAllCategories()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always syncs L1, skips L2/L3 when recently synced", async () => {
    // shouldSkip for echotik:categories:l2l3 returns true (recently synced)
    prismaMock.ingestionRun.findFirst.mockResolvedValueOnce({
      id: "recent-l2l3",
      source: "echotik:categories:l2l3",
      status: "SUCCESS",
      startedAt: new Date(),
    });

    // L1 response
    echotikRequestMock.mockResolvedValueOnce(apiOk());

    const log = stubLog();
    const count = await syncAllCategories("run-1", log);

    // Only 2 from L1, no L2/L3 calls
    expect(count).toBe(2);
    expect(echotikRequestMock).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      "L2/L3 categories: skip (recently synced)",
    );
  });

  it("syncs L1 + L2 + L3 when L2/L3 is stale", async () => {
    // shouldSkip returns null (no recent run)
    prismaMock.ingestionRun.findFirst.mockResolvedValue(null);

    echotikRequestMock
      .mockResolvedValueOnce(apiOk()) // L1
      .mockResolvedValueOnce(apiOk([categoryItems[0]])) // L2
      .mockResolvedValueOnce(apiOk([categoryItems[1]])); // L3

    const count = await syncAllCategories("run-1", stubLog());

    // 2 + 1 + 1
    expect(count).toBe(4);
    // L1 + L2 + L3 API calls
    expect(echotikRequestMock).toHaveBeenCalledTimes(3);
    // Creates the l2l3 success marker
    expect(prismaMock.ingestionRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: "echotik:categories:l2l3" }),
      }),
    );
  });

  it("propagates errors from L1 sync", async () => {
    prismaMock.ingestionRun.findFirst.mockResolvedValue(null);
    echotikRequestMock.mockRejectedValueOnce(new Error("Network down"));

    await expect(syncAllCategories("run-1", stubLog())).rejects.toThrow(
      "Network down",
    );
  });
});
