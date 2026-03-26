/**
 * Tests: lib/echotik/cron/orchestrator.ts
 *
 * Full coverage: detectNextTask, runEchotikCron (all task types)
 * Covers: auto task selection, explicit tasks, force mode, skipped state,
 * SUCCESS and FAILED outcomes, details-only path, IngestionRun lifecycle.
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
  },
}));

const shouldSkipMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
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

import {
  runEchotikCron,
  detectNextTask,
} from "@/lib/echotik/cron/orchestrator";

// ---------------------------------------------------------------------------
// detectNextTask
// ---------------------------------------------------------------------------
describe("detectNextTask()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldSkipMock.mockResolvedValue(false);
  });

  it("returns 'categories' when nothing has been synced", async () => {
    const task = await detectNextTask(false);
    expect(task).toBe("categories");
  });

  it("returns 'videos' when categories are fresh", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(false); // videos

    const task = await detectNextTask(false);
    expect(task).toBe("videos");
  });

  it("returns 'products' when categories and videos are fresh", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(true) // videos
      .mockResolvedValueOnce(false); // products

    const task = await detectNextTask(false);
    expect(task).toBe("products");
  });

  it("returns 'creators' when categories, videos, products are fresh", async () => {
    shouldSkipMock
      .mockResolvedValueOnce(true) // categories
      .mockResolvedValueOnce(true) // videos
      .mockResolvedValueOnce(true) // products
      .mockResolvedValueOnce(false); // creators

    const task = await detectNextTask(false);
    expect(task).toBe("creators");
  });

  it("returns 'details' when all main tasks are fresh", async () => {
    shouldSkipMock.mockResolvedValue(true);

    const task = await detectNextTask(false);
    expect(task).toBe("details");
  });

  it("returns 'categories' when force=true regardless of shouldSkip", async () => {
    shouldSkipMock.mockResolvedValue(true);

    const task = await detectNextTask(true);
    expect(task).toBe("categories");
    // shouldSkip should not be called when force=true
    expect(shouldSkipMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — auto mode
// ---------------------------------------------------------------------------
describe("runEchotikCron() — auto mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldSkipMock.mockResolvedValue(false);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-auto" });
  });

  it("picks the first needed task and runs it", async () => {
    const result = await runEchotikCron({ task: "auto" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.categoriesSynced).toBe(10);
    expect(syncAllCategoriesMock).toHaveBeenCalledTimes(1);
    // Should NOT run videos/products/creators in the same call
    expect(syncVideoRanklistMock).not.toHaveBeenCalled();
    expect(syncProductRanklistMock).not.toHaveBeenCalled();
    expect(syncCreatorRanklistMock).not.toHaveBeenCalled();
  });

  it("defaults to auto when no task specified", async () => {
    const result = await runEchotikCron();

    expect(result.status).toBe("SUCCESS");
    expect(syncAllCategoriesMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — explicit tasks
// ---------------------------------------------------------------------------
describe("runEchotikCron() — explicit tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-explicit" });
  });

  it("runs categories when task=categories", async () => {
    const result = await runEchotikCron({ task: "categories" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.categoriesSynced).toBe(10);
    expect(syncAllCategoriesMock).toHaveBeenCalledTimes(1);
    expect(result.runId).toBe("run-explicit");
  });

  it("runs videos when task=videos", async () => {
    const result = await runEchotikCron({ task: "videos" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.videosSynced).toBe(50);
    expect(syncVideoRanklistMock).toHaveBeenCalledTimes(1);
  });

  it("runs products when task=products", async () => {
    const result = await runEchotikCron({ task: "products" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.productsSynced).toBe(30);
    expect(syncProductRanklistMock).toHaveBeenCalledTimes(1);
  });

  it("runs creators when task=creators", async () => {
    const result = await runEchotikCron({ task: "creators" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.creatorsSynced).toBe(20);
    expect(syncCreatorRanklistMock).toHaveBeenCalledTimes(1);
  });

  it("runs details (video + ranklist) when task=details", async () => {
    const result = await runEchotikCron({ task: "details" });

    expect(result.status).toBe("SUCCESS");
    expect(result.stats.productDetailsEnriched).toBe(8); // 5 + 3
    expect(syncVideoProductDetailsMock).toHaveBeenCalledTimes(1);
    expect(syncRanklistProductDetailsMock).toHaveBeenCalledTimes(1);
    // Details don't create IngestionRun
    expect(prismaMock.ingestionRun.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — SKIPPED
// ---------------------------------------------------------------------------
describe("runEchotikCron() — SKIPPED state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-fail" });
  });

  it("returns FAILED and saves error when task throws", async () => {
    syncVideoRanklistMock.mockRejectedValueOnce(new Error("API down"));

    const result = await runEchotikCron({ task: "videos" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("API down");
    expect(result.runId).toBe("run-fail");

    // IngestionRun updated to FAILED
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

  it("creates IngestionRun markers for successful tasks", async () => {
    syncAllCategoriesMock.mockResolvedValueOnce(5);

    await runEchotikCron({ task: "categories" });

    // Should create: run record + echotik:categories marker
    expect(prismaMock.ingestionRun.create).toHaveBeenCalledTimes(2);
    const markerCall = prismaMock.ingestionRun.create.mock.calls[1][0];
    expect(markerCall.data.source).toBe("echotik:categories");
    expect(markerCall.data.status).toBe("SUCCESS");
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — force mode
// ---------------------------------------------------------------------------
describe("runEchotikCron() — force mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldSkipMock.mockResolvedValue(true);
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-force" });
  });

  it("force=true overrides shouldSkip in auto mode", async () => {
    const result = await runEchotikCron({ task: "auto", force: true });

    expect(result.status).toBe("SUCCESS");
    // Should pick categories (first in priority)
    expect(syncAllCategoriesMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// runEchotikCron — stats structure
// ---------------------------------------------------------------------------
describe("runEchotikCron() — stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.ingestionRun.create.mockResolvedValue({ id: "run-stats" });
  });

  it("includes durationMs in stats", async () => {
    const result = await runEchotikCron({ task: "categories" });

    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.stats.durationMs).toBe("number");
  });

  it("marks the executed task as not skipped", async () => {
    const result = await runEchotikCron({ task: "videos" });

    expect(result.stats.videosSkipped).toBe(false);
    // Other tasks should remain skipped=true since they weren't run
    expect(result.stats.categoriesSkipped).toBe(true);
    expect(result.stats.productsSkipped).toBe(true);
    expect(result.stats.creatorsSkipped).toBe(true);
  });
});
