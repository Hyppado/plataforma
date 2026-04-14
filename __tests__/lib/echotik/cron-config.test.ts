/**
 * Tests: lib/echotik/cron/config.ts
 *
 * Coverage: getEchotikConfig (defaults + overrides),
 *          saveEchotikConfig, validateEchotikConfigPatch
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const getSettingMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const upsertSettingMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("@/lib/settings", () => ({
  getSetting: getSettingMock,
  upsertSetting: upsertSettingMock,
}));

import {
  getEchotikConfig,
  saveEchotikConfig,
  validateEchotikConfigPatch,
  ECHOTIK_CONFIG_DEFAULTS,
} from "@/lib/echotik/cron/config";

// ---------------------------------------------------------------------------
// getEchotikConfig
// ---------------------------------------------------------------------------

describe("getEchotikConfig()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingMock.mockResolvedValue(null); // all settings null → defaults
  });

  it("returns default intervals when no settings are stored", async () => {
    const config = await getEchotikConfig();
    expect(config.intervals.categories).toBe(
      ECHOTIK_CONFIG_DEFAULTS.intervalCategories,
    );
    expect(config.intervals.videos).toBe(
      ECHOTIK_CONFIG_DEFAULTS.intervalVideos,
    );
    expect(config.intervals.products).toBe(
      ECHOTIK_CONFIG_DEFAULTS.intervalProducts,
    );
    expect(config.intervals.creators).toBe(
      ECHOTIK_CONFIG_DEFAULTS.intervalCreators,
    );
  });

  it("returns default pages when no settings are stored", async () => {
    const config = await getEchotikConfig();
    expect(config.pages.videos).toBe(ECHOTIK_CONFIG_DEFAULTS.pagesVideos);
    expect(config.pages.products).toBe(ECHOTIK_CONFIG_DEFAULTS.pagesProducts);
    expect(config.pages.creators).toBe(ECHOTIK_CONFIG_DEFAULTS.pagesCreators);
  });

  it("returns default detail config when no settings are stored", async () => {
    const config = await getEchotikConfig();
    expect(config.detail.batchSize).toBe(
      ECHOTIK_CONFIG_DEFAULTS.detailBatchSize,
    );
    expect(config.detail.maxAgeDays).toBe(
      ECHOTIK_CONFIG_DEFAULTS.detailMaxAgeDays,
    );
  });

  it("returns all tasks enabled by default", async () => {
    const config = await getEchotikConfig();
    expect(config.enabledTasks).toContain("categories");
    expect(config.enabledTasks).toContain("videos");
    expect(config.enabledTasks).toContain("products");
    expect(config.enabledTasks).toContain("creators");
    expect(config.enabledTasks).toContain("details");
  });

  it("overrides interval when setting is stored", async () => {
    // First call = categories interval = "12"
    getSettingMock.mockResolvedValueOnce("12");
    const config = await getEchotikConfig();
    expect(config.intervals.categories).toBe(12);
  });

  it("ignores invalid (non-numeric) setting value and uses default", async () => {
    getSettingMock.mockResolvedValueOnce("not-a-number");
    const config = await getEchotikConfig();
    expect(config.intervals.categories).toBe(
      ECHOTIK_CONFIG_DEFAULTS.intervalCategories,
    );
  });

  it("clamps zero interval to minimum (1h)", async () => {
    getSettingMock.mockResolvedValueOnce("0");
    const config = await getEchotikConfig();
    expect(config.intervals.categories).toBe(1);
  });

  it("respects custom tasksEnabled setting", async () => {
    // All calls return null until the last one (tasksEnabled)
    getSettingMock
      .mockResolvedValueOnce(null) // categories interval
      .mockResolvedValueOnce(null) // videos interval
      .mockResolvedValueOnce(null) // products interval
      .mockResolvedValueOnce(null) // creators interval
      .mockResolvedValueOnce(null) // pages videos
      .mockResolvedValueOnce(null) // pages products
      .mockResolvedValueOnce(null) // pages creators
      .mockResolvedValueOnce(null) // detail batch size
      .mockResolvedValueOnce(null) // detail max age days
      .mockResolvedValueOnce("categories,videos"); // tasksEnabled

    const config = await getEchotikConfig();
    expect(config.enabledTasks).toEqual(["categories", "videos"]);
    expect(config.enabledTasks).not.toContain("products");
  });
});

// ---------------------------------------------------------------------------
// saveEchotikConfig — accepts flat keys
// ---------------------------------------------------------------------------

describe("saveEchotikConfig()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertSettingMock.mockResolvedValue(undefined);
  });

  it("calls upsertSetting for intervalCategories", async () => {
    await saveEchotikConfig({ intervalCategories: 12 });
    expect(upsertSettingMock).toHaveBeenCalledWith(
      expect.stringContaining("interval:categories"),
      "12",
      expect.anything(),
    );
  });

  it("calls upsertSetting for intervalVideos", async () => {
    await saveEchotikConfig({ intervalVideos: 6 });
    expect(upsertSettingMock).toHaveBeenCalledWith(
      expect.stringContaining("interval:videos"),
      "6",
      expect.anything(),
    );
  });

  it("calls upsertSetting for pagesVideos", async () => {
    await saveEchotikConfig({ pagesVideos: 5 });
    expect(upsertSettingMock).toHaveBeenCalledWith(
      expect.stringContaining("pages:videos"),
      "5",
      expect.anything(),
    );
  });

  it("calls upsertSetting for tasksEnabled as comma-separated string", async () => {
    await saveEchotikConfig({ tasksEnabled: "categories,videos" });
    expect(upsertSettingMock).toHaveBeenCalledWith(
      expect.stringContaining("tasks:enabled"),
      "categories,videos",
      expect.anything(),
    );
  });

  it("only calls upsert for fields present in patch", async () => {
    await saveEchotikConfig({ intervalCategories: 6 });
    expect(upsertSettingMock).toHaveBeenCalledTimes(1);
  });

  it("accepts empty patch without calling upsert", async () => {
    await saveEchotikConfig({});
    expect(upsertSettingMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// validateEchotikConfigPatch — returns EchotikConfigValidationError[]
// ---------------------------------------------------------------------------

describe("validateEchotikConfigPatch()", () => {
  it("returns empty array for valid intervals (flat keys)", () => {
    const errors = validateEchotikConfigPatch({
      intervalCategories: 6,
      intervalVideos: 3,
    });
    expect(errors).toHaveLength(0);
  });

  it("returns error for intervalCategories of 0", () => {
    const errors = validateEchotikConfigPatch({ intervalCategories: 0 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe("intervalCategories");
  });

  it("returns error for interval above maximum (> 168)", () => {
    const errors = validateEchotikConfigPatch({ intervalVideos: 800 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns empty array for valid pages config", () => {
    const errors = validateEchotikConfigPatch({
      pagesVideos: 5,
      pagesProducts: 5,
      pagesCreators: 5,
    });
    expect(errors).toHaveLength(0);
  });

  it("returns error for pagesVideos of 0", () => {
    const errors = validateEchotikConfigPatch({ pagesVideos: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for unknown task in tasksEnabled", () => {
    const errors = validateEchotikConfigPatch({
      tasksEnabled: "categories,unknown_task",
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("unknown_task");
  });

  it("returns empty array for valid tasksEnabled subset", () => {
    const errors = validateEchotikConfigPatch({
      tasksEnabled: "categories,videos",
    });
    expect(errors).toHaveLength(0);
  });

  it("returns empty array for empty patch (no-op)", () => {
    const errors = validateEchotikConfigPatch({});
    expect(errors).toHaveLength(0);
  });
});
