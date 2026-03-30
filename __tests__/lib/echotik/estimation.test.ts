/**
 * Tests: lib/echotik/admin/estimation.ts
 *
 * Coverage: estimateEchotikRequests (per-entity math, capacity warning),
 *          configToEstimationInput
 */
import { describe, it, expect } from "vitest";
import {
  estimateEchotikRequests,
  configToEstimationInput,
} from "@/lib/echotik/admin/estimation";
import type { EstimationInput } from "@/lib/types/echotik-admin";
import { ECHOTIK_CONFIG_DEFAULTS } from "@/lib/echotik/cron/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<EstimationInput> = {}): EstimationInput {
  return {
    activeRegions: 3,
    videoPages: 10,
    productPages: 10,
    creatorPages: 10,
    detailBatchSize: 5,
    rankingCycles: 3,
    rankFields: 2,
    categoriesIntervalHours: 24,
    videosIntervalHours: 24,
    productsIntervalHours: 24,
    creatorsIntervalHours: 24,
    enabledTasks: ["categories", "videos", "products", "creators", "details"],
    cronIntervalMinutes: 15,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// estimateEchotikRequests
// ---------------------------------------------------------------------------

describe("estimateEchotikRequests()", () => {
  it("returns correct per-invocation math for videos (3 cycles × 2 fields)", () => {
    const result = estimateEchotikRequests(makeInput({ activeRegions: 1 }));
    const videos = result.breakdown.find((e) => e.entity === "videos")!;
    // probes: 3 cycles × 2 fields = 6
    expect(videos.probeCallsPerInvocation).toBe(6);
    // data: 3 cycles × 2 fields × 10 pages = 60
    expect(videos.dataCallsPerInvocation).toBe(60);
    expect(videos.requestsPerInvocation).toBe(66);
  });

  it("returns totalRequestsPerDay > 0 when at least one task is enabled", () => {
    const result = estimateEchotikRequests(makeInput());
    expect(result.totalRequestsPerDay).toBeGreaterThan(0);
  });

  it("returns zero requests when all tasks are disabled", () => {
    const result = estimateEchotikRequests(makeInput({ enabledTasks: [] }));
    expect(result.totalRequestsPerDay).toBe(0);
    expect(result.invocationsPerDay).toBe(0);
  });

  it("returns zero when activeRegions is 0 for ranklist tasks", () => {
    const result = estimateEchotikRequests(makeInput({ activeRegions: 0 }));
    const videos = result.breakdown.find((e) => e.entity === "videos")!;
    expect(videos.requestsPerDay).toBe(0);
  });

  it("includes a note about capacity when invocations exceed 96/day", () => {
    // Force very short intervals (every 1 hour) with many regions to exceed capacity
    const result = estimateEchotikRequests(
      makeInput({
        activeRegions: 10,
        videosIntervalHours: 1,
        productsIntervalHours: 1,
        creatorsIntervalHours: 1,
        categoriesIntervalHours: 1,
      }),
    );
    const hasCapacityWarning = result.notes.some((n) => n.includes("⚠️"));
    expect(hasCapacityWarning).toBe(true);
  });

  it("does NOT include capacity warning when invocations are within 96/day", () => {
    const result = estimateEchotikRequests(
      makeInput({
        activeRegions: 1,
        videosIntervalHours: 24,
        productsIntervalHours: 24,
        creatorsIntervalHours: 24,
      }),
    );
    // With 1 region and 24h intervals, total invocations should be well under 96
    const hasCapacityWarning = result.notes.some((n) => n.includes("⚠️"));
    expect(hasCapacityWarning).toBe(false);
  });

  it("requestsPerCronTick equals max single-entity requestsPerInvocation", () => {
    const result = estimateEchotikRequests(makeInput());
    const maxPerInv = Math.max(
      ...result.breakdown.map((e) => e.requestsPerInvocation),
    );
    expect(result.requestsPerCronTick).toBe(maxPerInv);
  });

  it("notes are in Portuguese", () => {
    const result = estimateEchotikRequests(makeInput());
    // All notes should contain Portuguese text, not English
    const hasEnglish = result.notes.some(
      (n) =>
        n.includes("Detail enrichment is") ||
        n.includes("Probe calls are") ||
        n.includes("Cron runs every"),
    );
    expect(hasEnglish).toBe(false);
    // Verify at least one Portuguese note exists
    const hasPortuguese = result.notes.some(
      (n) => n.includes("Enriquecimento") || n.includes("cron roda"),
    );
    expect(hasPortuguese).toBe(true);
  });

  it("breakdown contains entries for all 5 task types", () => {
    const result = estimateEchotikRequests(makeInput());
    const entities = result.breakdown.map((e) => e.entity);
    expect(entities).toContain("categories");
    expect(entities).toContain("videos");
    expect(entities).toContain("products");
    expect(entities).toContain("creators");
    expect(entities).toContain("details");
  });

  it("scaling: doubling pages doubles per-invocation data calls", () => {
    const base = estimateEchotikRequests(
      makeInput({ videoPages: 5, activeRegions: 1 }),
    );
    const doubled = estimateEchotikRequests(
      makeInput({ videoPages: 10, activeRegions: 1 }),
    );
    const baseVideos = base.breakdown.find((e) => e.entity === "videos")!;
    const doubledVideos = doubled.breakdown.find((e) => e.entity === "videos")!;
    expect(doubledVideos.dataCallsPerInvocation).toBe(
      baseVideos.dataCallsPerInvocation * 2,
    );
  });
});

// ---------------------------------------------------------------------------
// configToEstimationInput
// ---------------------------------------------------------------------------

describe("configToEstimationInput()", () => {
  it("maps config fields to input fields correctly", () => {
    const config = {
      intervals: {
        categories: ECHOTIK_CONFIG_DEFAULTS.intervalCategories,
        videos: 6,
        products: 12,
        creators: 24,
      },
      pages: { videos: 8, products: 8, creators: 8 },
      detail: {
        batchSize: ECHOTIK_CONFIG_DEFAULTS.detailBatchSize,
        maxAgeDays: ECHOTIK_CONFIG_DEFAULTS.detailMaxAgeDays,
      },
      enabledTasksRaw: "categories,videos",
      enabledTasks: ["categories", "videos"],
    };
    const input = configToEstimationInput(config, 2);
    expect(input.activeRegions).toBe(2);
    expect(input.videosIntervalHours).toBe(6);
    expect(input.productsIntervalHours).toBe(12);
    expect(input.videoPages).toBe(8);
    expect(input.enabledTasks).toEqual(["categories", "videos"]);
  });
});
