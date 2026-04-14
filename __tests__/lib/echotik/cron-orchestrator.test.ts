/**
 * Tests: lib/echotik/cron/orchestrator.ts
 *
 * Full coverage: detectNextTask, runEchotikCron (all task types, all regions)
 * Covers: auto task selection with region detection, explicit tasks (with and
 * without region), force mode, skipped state, SUCCESS and FAILED outcomes,
 * details-only path, IngestionRun lifecycle, region-scoped shouldSkip keys.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const prismaMock = vi.hoisted(() => ({
  ingestionRun: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "run-1" }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  },
}));

const shouldSkipMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
const getConfiguredRegionsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(["BR", "US"]),
);
const cleanupStaleRunsMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const hasExcessiveFailuresMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(false),
);
const syncAllCategoriesMock = vi.hoisted(() => vi.fn().mockResolvedValue(10));
const syncVideoRanklistMock = vi.hoisted(() => vi.fn().mockResolvedValue(50));
const syncProductRanklistMock = vi.hoisted(() => vi.fn().mockResolvedValue(30));
const syncCreatorRanklistMock = vi.hoisted(() => vi.fn().mockResolvedValue(20));
const syncVideoProductDetailsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(5),
);
const syncRanklistProductDetailsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(3),
);

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
      correlationId: "child-corr",
    }),
    correlationId: "test-corr",
  }),
}));

vi.mock("@/lib/echotik/cron/helpers", () => ({
  shouldSkip: shouldSkipMock,
  getConfiguredRegions: getConfiguredRegionsMock,
  cleanupStaleRuns: cleanupStaleRunsMock,
  hasExcessiveFailures: hasExcessiveFailuresMock,
}));

vi.mock("@/lib/echotik/cron/syncCategories", () => ({
  syncAllCategories: syncAllCategoriesMock,
}));

vi.mock("@/lib/echotik/cron/syncVideos", () => ({
  syncVideoRanklist: syncVideoRanklistMock,
  syncVideoProductDetails: syncVideoProductDetailsMock,
}));

vi.mock("@/lib/echotik/cron/syncProducts", () => ({
  syncProductRanklist: syncProductRanklistMock,
  syncRanklistProductDetails: syncRanklistProductDetailsMock,
}));

vi.mock("@/lib/echotik/cron/syncCreators", () => ({
  syncCreatorRanklist: syncCreatorRanklistMock,
}));

const getEchotikConfigMock = vi.hoisted(() => vi.fn());

const DEFAULT_ECHOTIK_CONFIG = {
  intervals: { categories: 24, videos: 24, products: 24, creators: 24 },
  pages: { videos: 10, products: 10, creators: 10 },
  detail: { batchSize: 5, maxAgeDays: 7 },
  enabledTasksRaw: "categories,videos,products,creators,details",
  enabledTasks: ["categories", "videos", "products", "creators", "details"],
};

vi.mock("@/lib/echotik/cron/config", () => ({
  getEchotikConfig: getEchotikConfigMock,
}));

import {
  runEchotikCron,
  detectNextTask,
} from "@/lib/echotik/cron/orchestrator";

// ---------------------------------------------------------------------------
// detectNextTask — now returns { task, region } | null
// ---------------------------------------------------------------------------
describe("detectNextTask()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: nothing is fresh → categories first
    shouldSkipMock.mockResolvedValue(false);
    getConfiguredRegionsMock.mockResolvedValue(["BR", "US"]);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
  });

  it("returns { task: 'categories', region: null } when nothing synced", async () => {
    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "categories", region: null });
  });

  it("returns videos:BR when categories are fresh", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // echotik:categories → skip
      .mockResolvedValueOnce(false); // echotik:videos:BR → needs sync

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "videos", region: "BR" });
  });

  it("returns videos:US when BR videos are fresh but US is not", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(true) // videos:BR
      .mockResolvedValueOnce(false); // videos:US

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "videos", region: "US" });
  });

  it("returns products:BR when all videos are fresh", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(true) // videos:BR
      .mockResolvedValueOnce(true) // videos:US
      .mockResolvedValueOnce(false); // products:BR

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "products", region: "BR" });
  });

  it("returns creators:BR when categories, videos, products are all fresh", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(true) // videos:BR
      .mockResolvedValueOnce(true) // videos:US
      .mockResolvedValueOnce(true) // products:BR
      .mockResolvedValueOnce(true) // products:US
      .mockResolvedValueOnce(false); // creators:BR

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "creators", region: "BR" });
  });

  it("returns { task: 'details', region: null } when all main tasks are fresh", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(true) // videos:BR
      .mockResolvedValueOnce(true) // videos:US
      .mockResolvedValueOnce(true) // products:BR
      .mockResolvedValueOnce(true) // products:US
      .mockResolvedValueOnce(true) // creators:BR
      .mockResolvedValueOnce(true) // creators:US
      .mockResolvedValueOnce(false); // echotik:details → not stale, run it

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "details", region: null });
  });

  it("returns categories when force=true regardless of shouldSkip", async () => {
    shouldSkipMock.mockResolvedValue(true);

    const sel = await detectNextTask(true);
    expect(sel).toEqual({ task: "categories", region: null });
    // shouldSkip is not called when force=true
    expect(shouldSkipMock).not.toHaveBeenCalled();
  });

  it("uses getConfiguredRegions to determine region order", async () => {
    getConfiguredRegionsMock.mockResolvedValueOnce(["MX", "GB"]);
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(false); // videos:MX

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "videos", region: "MX" });
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — auto mode
// ---------------------------------------------------------------------------
describe("runEchotikCron() — auto mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldSkipMock.mockResolvedValue(false);
    getConfiguredRegionsMock.mockResolvedValue(["BR"]);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-auto" });
  });

  it("picks categories (first needed) and runs it alone", async () => {
    const result = await runEchotikCron({ task: "auto" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.categoriesSynced).toBe(10);
    expect(syncAllCategoriesMock).toHaveBeenCalledTimes(1);
    // ONE task per invocation — no other tasks
    expect(syncVideoRanklistMock).not.toHaveBeenCalled();
    expect(syncProductRanklistMock).not.toHaveBeenCalled();
    expect(syncCreatorRanklistMock).not.toHaveBeenCalled();
  });

  it("defaults to auto when no task specified", async () => {
    const result = await runEchotikCron();

    expect(result.status).toBe("SUCCESS");
    expect(syncAllCategoriesMock).toHaveBeenCalledTimes(1);
  });

  it("picks videos:BR when categories are fresh", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(false); // videos:BR

    const result = await runEchotikCron({ task: "auto" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.videosSynced).toBe(50);
    expect(syncVideoRanklistMock).toHaveBeenCalledWith(
      expect.any(String),
      "BR",
      expect.anything(),
      expect.any(Number),
      undefined,
    );
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — explicit tasks
// ---------------------------------------------------------------------------
describe("runEchotikCron() — explicit tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfiguredRegionsMock.mockResolvedValue(["BR"]);
    shouldSkipMock.mockResolvedValue(false); // BR not fresh → pick BR
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-explicit" });
  });

  it("runs categories when task=categories", async () => {
    const result = await runEchotikCron({ task: "categories" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.categoriesSynced).toBe(10);
    expect(syncAllCategoriesMock).toHaveBeenCalledTimes(1);
    expect(result.runId).toBe("run-explicit");
  });

  it("runs videos with explicit region when task=videos&region=BR", async () => {
    const result = await runEchotikCron({ task: "videos", region: "BR" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.videosSynced).toBe(50);
    expect(syncVideoRanklistMock).toHaveBeenCalledWith(
      "run-explicit",
      "BR",
      expect.anything(),
      expect.any(Number),
      undefined,
    );
  });

  it("auto-picks region when task=videos&region omitted", async () => {
    const result = await runEchotikCron({ task: "videos" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.videosSynced).toBe(50);
    expect(syncVideoRanklistMock).toHaveBeenCalledWith(
      "run-explicit",
      "BR",
      expect.anything(),
      expect.any(Number),
      undefined,
    );
  });

  it("runs products with explicit region when task=products&region=BR", async () => {
    const result = await runEchotikCron({ task: "products", region: "BR" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.productsSynced).toBe(30);
    expect(syncProductRanklistMock).toHaveBeenCalledWith(
      "run-explicit",
      "BR",
      expect.anything(),
      expect.any(Number),
      undefined,
    );
  });

  it("auto-picks region when task=products&region omitted", async () => {
    const result = await runEchotikCron({ task: "products" });

    expect(result.status).toBe("SUCCESS");
    expect(syncProductRanklistMock).toHaveBeenCalledWith(
      "run-explicit",
      "BR",
      expect.anything(),
      expect.any(Number),
      undefined,
    );
  });

  it("runs creators with explicit region when task=creators&region=BR", async () => {
    const result = await runEchotikCron({ task: "creators", region: "BR" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.creatorsSynced).toBe(20);
    expect(syncCreatorRanklistMock).toHaveBeenCalledWith(
      "run-explicit",
      "BR",
      expect.anything(),
      expect.any(Number),
      undefined,
    );
  });

  it("auto-picks region when task=creators&region omitted", async () => {
    const result = await runEchotikCron({ task: "creators" });

    expect(result.status).toBe("SUCCESS");
    expect(syncCreatorRanklistMock).toHaveBeenCalledWith(
      "run-explicit",
      "BR",
      expect.anything(),
      expect.any(Number),
      undefined,
    );
  });

  it("runs details (video + ranklist) when task=details", async () => {
    const result = await runEchotikCron({ task: "details" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.productDetailsEnriched).toBe(8); // 5 + 3
    expect(syncVideoProductDetailsMock).toHaveBeenCalledTimes(1);
    expect(syncRanklistProductDetailsMock).toHaveBeenCalledTimes(1);
    // Details writes one IngestionRun for shouldSkip tracking
    expect(prismaMock.ingestionRun.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.ingestionRun.create.mock.calls[0][0].data.source).toBe(
      "echotik:details",
    );
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — region-scoped markers
// ---------------------------------------------------------------------------
describe("runEchotikCron() — region-scoped IngestionRun markers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfiguredRegionsMock.mockResolvedValue(["BR"]);
    shouldSkipMock.mockResolvedValue(false);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-markers" });
  });

  it("markers categories task as echotik:categories", async () => {
    await runEchotikCron({ task: "categories" });

    const markerCall = prismaMock.ingestionRun.create.mock.calls[1][0];
    expect(markerCall.data.source).toBe("echotik:categories");
    expect(markerCall.data.status).toBe("SUCCESS");
  });

  it("marks videos task as echotik:videos:BR", async () => {
    await runEchotikCron({ task: "videos", region: "BR" });

    const markerCall = prismaMock.ingestionRun.create.mock.calls[1][0];
    expect(markerCall.data.source).toBe("echotik:videos:BR");
    expect(markerCall.data.status).toBe("SUCCESS");
  });

  it("marks products task as echotik:products:US", async () => {
    await runEchotikCron({ task: "products", region: "US" });

    const markerCall = prismaMock.ingestionRun.create.mock.calls[1][0];
    expect(markerCall.data.source).toBe("echotik:products:US");
    expect(markerCall.data.status).toBe("SUCCESS");
  });

  it("marks creators task as echotik:creators:MX", async () => {
    await runEchotikCron({ task: "creators", region: "MX" });

    const markerCall = prismaMock.ingestionRun.create.mock.calls[1][0];
    expect(markerCall.data.source).toBe("echotik:creators:MX");
    expect(markerCall.data.status).toBe("SUCCESS");
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — SKIPPED
// ---------------------------------------------------------------------------
describe("runEchotikCron() — SKIPPED state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfiguredRegionsMock.mockResolvedValue(["BR"]);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
  });

  it("returns SKIPPED when details have nothing to enrich", async () => {
    syncVideoProductDetailsMock.mockResolvedValueOnce(0);
    syncRanklistProductDetailsMock.mockResolvedValueOnce(0);

    const result = await runEchotikCron({ task: "details" });

    expect(result.status).toBe("SKIPPED");
    expect(result.stats.productDetailsEnriched).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — failures
// ---------------------------------------------------------------------------
describe("runEchotikCron() — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfiguredRegionsMock.mockResolvedValue(["BR"]);
    shouldSkipMock.mockResolvedValue(false);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-fail" });
  });

  it("returns FAILED and saves error when task throws", async () => {
    syncVideoRanklistMock.mockRejectedValueOnce(new Error("API down"));

    const result = await runEchotikCron({ task: "videos", region: "BR" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("API down");
    expect(result.runId).toBe("run-fail");

    expect(prismaMock.ingestionRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-fail" },
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "API down",
        }),
      }),
    );
  });

  it("returns FAILED when details task throws", async () => {
    syncVideoProductDetailsMock.mockRejectedValueOnce(
      new Error("Detail fetch error"),
    );

    const result = await runEchotikCron({ task: "details" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("Detail fetch error");
  });

  it("handles non-Error throws gracefully", async () => {
    syncAllCategoriesMock.mockRejectedValueOnce("string error");

    const result = await runEchotikCron({ task: "categories" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("string error");
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — force mode
// ---------------------------------------------------------------------------
describe("runEchotikCron() — force mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldSkipMock.mockResolvedValue(true);
    getConfiguredRegionsMock.mockResolvedValue(["BR"]);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-force" });
  });

  it("force=true overrides shouldSkip in auto mode — runs categories first", async () => {
    const result = await runEchotikCron({ task: "auto", force: true });

    expect(result.status).toBe("SUCCESS");
    expect(syncAllCategoriesMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — stats structure
// ---------------------------------------------------------------------------
describe("runEchotikCron() — stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfiguredRegionsMock.mockResolvedValue(["BR"]);
    shouldSkipMock.mockResolvedValue(false);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-stats" });
  });

  it("includes durationMs in stats", async () => {
    const result = await runEchotikCron({ task: "categories" });

    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.stats.durationMs).toBe("number");
  });

  it("marks the executed task as not skipped, others remain skipped", async () => {
    const result = await runEchotikCron({ task: "videos", region: "BR" });

    expect(result.stats.videosSkipped).toBe(false);
    expect(result.stats.categoriesSkipped).toBe(true);
    expect(result.stats.productsSkipped).toBe(true);
    expect(result.stats.creatorsSkipped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cleanupStaleRuns — called at start of each cron tick
// ---------------------------------------------------------------------------
describe("runEchotikCron() — stale RUNNING cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldSkipMock.mockResolvedValue(false);
    getConfiguredRegionsMock.mockResolvedValue(["BR"]);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-stale" });
  });

  it("calls cleanupStaleRuns before executing any task", async () => {
    await runEchotikCron({ task: "categories" });

    expect(cleanupStaleRunsMock).toHaveBeenCalledTimes(1);
    expect(cleanupStaleRunsMock).toHaveBeenCalledWith(5, expect.anything());
  });

  it("calls cleanupStaleRuns even when main tasks are all fresh", async () => {
    shouldSkipMock.mockResolvedValue(true);
    // Details fallback still runs → but stale cleanup happens first regardless
    syncVideoProductDetailsMock.mockResolvedValue(0);
    syncRanklistProductDetailsMock.mockResolvedValue(0);

    await runEchotikCron();

    expect(cleanupStaleRunsMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// detectNextTask — excessive-failure backoff
// ---------------------------------------------------------------------------
describe("detectNextTask() — excessive-failure backoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldSkipMock.mockResolvedValue(false);
    hasExcessiveFailuresMock.mockResolvedValue(false);
    getConfiguredRegionsMock.mockResolvedValue(["BR", "US"]);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_ECHOTIK_CONFIG);
  });

  it("skips categories when it has excessive failures", async () => {
    // categories not fresh → shouldSkip returns false
    // but excessive failures → skip categories, move to videos:BR
    hasExcessiveFailuresMock
      .mockResolvedValueOnce(true) // echotik:run:categories → excessive
      .mockResolvedValueOnce(false); // echotik:run:videos:BR → ok

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "videos", region: "BR" });
    expect(hasExcessiveFailuresMock).toHaveBeenCalledWith(
      "echotik:run:categories",
    );
  });

  it("skips a region with excessive failures and tries next region", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories → fresh
      .mockResolvedValueOnce(false) // videos:BR → needs sync
      .mockResolvedValueOnce(false); // videos:US → needs sync

    hasExcessiveFailuresMock
      .mockResolvedValueOnce(true) // videos:BR → excessive failures
      .mockResolvedValueOnce(false); // videos:US → ok

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "videos", region: "US" });
    expect(hasExcessiveFailuresMock).toHaveBeenCalledWith(
      "echotik:run:videos:BR",
    );
  });

  it("skips all regions for a task if all have excessive failures", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories → fresh
      .mockResolvedValueOnce(false) // videos:BR → needs sync
      .mockResolvedValueOnce(false) // videos:US → needs sync
      .mockResolvedValueOnce(false); // products:BR → needs sync

    hasExcessiveFailuresMock
      .mockResolvedValueOnce(true) // videos:BR → excessive
      .mockResolvedValueOnce(true) // videos:US → excessive
      .mockResolvedValueOnce(false); // products:BR → ok

    const sel = await detectNextTask(false);
    expect(sel).toEqual({ task: "products", region: "BR" });
  });

  it("force=true bypasses excessive-failure check", async () => {
    hasExcessiveFailuresMock.mockResolvedValue(true);

    const sel = await detectNextTask(true);
    expect(sel).toEqual({ task: "categories", region: null });
    // hasExcessiveFailures should NOT be called with force
    expect(hasExcessiveFailuresMock).not.toHaveBeenCalled();
  });
});
