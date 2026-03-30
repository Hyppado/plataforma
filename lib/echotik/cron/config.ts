/**
 * lib/echotik/cron/config.ts
 *
 * Dynamic configuration for the Echotik ingestion system.
 *
 * All operational parameters are read from the Settings table (lib/settings.ts),
 * with defaults that preserve the current hardcoded behavior.
 *
 * This means: on first deploy, behavior is identical to before.
 * Admins can then tune without a new deploy.
 */

import { getSetting, upsertSetting } from "@/lib/settings";
import type { EchotikConfig } from "@/lib/types/echotik-admin";

// ---------------------------------------------------------------------------
// Setting keys
// ---------------------------------------------------------------------------

export const ECHOTIK_CONFIG_KEYS = {
  INTERVAL_CATEGORIES: "echotik:interval:categories",
  INTERVAL_VIDEOS: "echotik:interval:videos",
  INTERVAL_PRODUCTS: "echotik:interval:products",
  INTERVAL_CREATORS: "echotik:interval:creators",
  PAGES_VIDEOS: "echotik:pages:videos",
  PAGES_PRODUCTS: "echotik:pages:products",
  PAGES_CREATORS: "echotik:pages:creators",
  DETAIL_BATCH_SIZE: "echotik:detail:batch_size",
  DETAIL_MAX_AGE_DAYS: "echotik:detail:max_age_days",
  TASKS_ENABLED: "echotik:tasks:enabled",
} as const;

// ---------------------------------------------------------------------------
// Defaults (mirrors current hardcoded constants — no behavior change on deploy)
// ---------------------------------------------------------------------------

export const ECHOTIK_CONFIG_DEFAULTS = {
  intervalCategories: 24,
  intervalVideos: 24,
  intervalProducts: 24,
  intervalCreators: 24,
  pagesVideos: 10,
  pagesProducts: 10,
  pagesCreators: 10,
  detailBatchSize: 5,
  detailMaxAgeDays: 7,
  tasksEnabled: "categories,videos,products,creators,details",
} as const;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Loads the full Echotik configuration from the Settings table.
 * All settings are fetched in parallel for efficiency.
 * Falls back to defaults when a key is not set.
 */
export async function getEchotikConfig(): Promise<EchotikConfig> {
  const [
    rawIntervalCategories,
    rawIntervalVideos,
    rawIntervalProducts,
    rawIntervalCreators,
    rawPagesVideos,
    rawPagesProducts,
    rawPagesCreators,
    rawDetailBatchSize,
    rawDetailMaxAgeDays,
    rawTasksEnabled,
  ] = await Promise.all([
    getSetting(ECHOTIK_CONFIG_KEYS.INTERVAL_CATEGORIES),
    getSetting(ECHOTIK_CONFIG_KEYS.INTERVAL_VIDEOS),
    getSetting(ECHOTIK_CONFIG_KEYS.INTERVAL_PRODUCTS),
    getSetting(ECHOTIK_CONFIG_KEYS.INTERVAL_CREATORS),
    getSetting(ECHOTIK_CONFIG_KEYS.PAGES_VIDEOS),
    getSetting(ECHOTIK_CONFIG_KEYS.PAGES_PRODUCTS),
    getSetting(ECHOTIK_CONFIG_KEYS.PAGES_CREATORS),
    getSetting(ECHOTIK_CONFIG_KEYS.DETAIL_BATCH_SIZE),
    getSetting(ECHOTIK_CONFIG_KEYS.DETAIL_MAX_AGE_DAYS),
    getSetting(ECHOTIK_CONFIG_KEYS.TASKS_ENABLED),
  ]);

  const toInt = (raw: string | null, def: number) => {
    if (!raw) return def;
    const n = parseInt(raw, 10);
    return isNaN(n) || n <= 0 ? def : n;
  };

  const enabledTasksRaw =
    rawTasksEnabled ?? ECHOTIK_CONFIG_DEFAULTS.tasksEnabled;
  const enabledTasks = enabledTasksRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    intervals: {
      categories: toInt(
        rawIntervalCategories,
        ECHOTIK_CONFIG_DEFAULTS.intervalCategories,
      ),
      videos: toInt(rawIntervalVideos, ECHOTIK_CONFIG_DEFAULTS.intervalVideos),
      products: toInt(
        rawIntervalProducts,
        ECHOTIK_CONFIG_DEFAULTS.intervalProducts,
      ),
      creators: toInt(
        rawIntervalCreators,
        ECHOTIK_CONFIG_DEFAULTS.intervalCreators,
      ),
    },
    pages: {
      videos: toInt(rawPagesVideos, ECHOTIK_CONFIG_DEFAULTS.pagesVideos),
      products: toInt(rawPagesProducts, ECHOTIK_CONFIG_DEFAULTS.pagesProducts),
      creators: toInt(rawPagesCreators, ECHOTIK_CONFIG_DEFAULTS.pagesCreators),
    },
    detail: {
      batchSize: toInt(
        rawDetailBatchSize,
        ECHOTIK_CONFIG_DEFAULTS.detailBatchSize,
      ),
      maxAgeDays: toInt(
        rawDetailMaxAgeDays,
        ECHOTIK_CONFIG_DEFAULTS.detailMaxAgeDays,
      ),
    },
    enabledTasksRaw,
    enabledTasks,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Persists Echotik configuration to the Settings table.
 * Only updates provided keys.
 */
export async function saveEchotikConfig(
  patch: Partial<{
    intervalCategories: number;
    intervalVideos: number;
    intervalProducts: number;
    intervalCreators: number;
    pagesVideos: number;
    pagesProducts: number;
    pagesCreators: number;
    detailBatchSize: number;
    detailMaxAgeDays: number;
    tasksEnabled: string;
  }>,
): Promise<void> {
  const updates: Promise<unknown>[] = [];

  if (patch.intervalCategories !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.INTERVAL_CATEGORIES,
        String(patch.intervalCategories),
        {
          label: "Interval: Categories (hours)",
          group: "echotik",
          type: "number",
        },
      ),
    );
  }
  if (patch.intervalVideos !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.INTERVAL_VIDEOS,
        String(patch.intervalVideos),
        { label: "Interval: Videos (hours)", group: "echotik", type: "number" },
      ),
    );
  }
  if (patch.intervalProducts !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.INTERVAL_PRODUCTS,
        String(patch.intervalProducts),
        {
          label: "Interval: Products (hours)",
          group: "echotik",
          type: "number",
        },
      ),
    );
  }
  if (patch.intervalCreators !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.INTERVAL_CREATORS,
        String(patch.intervalCreators),
        {
          label: "Interval: Creators (hours)",
          group: "echotik",
          type: "number",
        },
      ),
    );
  }
  if (patch.pagesVideos !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.PAGES_VIDEOS,
        String(patch.pagesVideos),
        { label: "Pages per Sync: Videos", group: "echotik", type: "number" },
      ),
    );
  }
  if (patch.pagesProducts !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.PAGES_PRODUCTS,
        String(patch.pagesProducts),
        {
          label: "Pages per Sync: Products",
          group: "echotik",
          type: "number",
        },
      ),
    );
  }
  if (patch.pagesCreators !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.PAGES_CREATORS,
        String(patch.pagesCreators),
        {
          label: "Pages per Sync: Creators",
          group: "echotik",
          type: "number",
        },
      ),
    );
  }
  if (patch.detailBatchSize !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.DETAIL_BATCH_SIZE,
        String(patch.detailBatchSize),
        {
          label: "Detail Enrichment Batch Size",
          group: "echotik",
          type: "number",
        },
      ),
    );
  }
  if (patch.detailMaxAgeDays !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.DETAIL_MAX_AGE_DAYS,
        String(patch.detailMaxAgeDays),
        {
          label: "Detail Max Age (days)",
          group: "echotik",
          type: "number",
        },
      ),
    );
  }
  if (patch.tasksEnabled !== undefined) {
    updates.push(
      upsertSetting(ECHOTIK_CONFIG_KEYS.TASKS_ENABLED, patch.tasksEnabled, {
        label: "Enabled Tasks",
        group: "echotik",
        type: "text",
      }),
    );
  }

  await Promise.all(updates);
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

export interface EchotikConfigValidationError {
  field: string;
  message: string;
}

export function validateEchotikConfigPatch(
  patch: Record<string, unknown>,
): EchotikConfigValidationError[] {
  const errors: EchotikConfigValidationError[] = [];

  const numericFields: Array<{
    field: string;
    min: number;
    max: number;
    label: string;
  }> = [
    {
      field: "intervalCategories",
      min: 1,
      max: 720,
      label: "Interval: Categories",
    },
    { field: "intervalVideos", min: 1, max: 720, label: "Interval: Videos" },
    {
      field: "intervalProducts",
      min: 1,
      max: 720,
      label: "Interval: Products",
    },
    {
      field: "intervalCreators",
      min: 1,
      max: 720,
      label: "Interval: Creators",
    },
    { field: "pagesVideos", min: 1, max: 50, label: "Pages: Videos" },
    { field: "pagesProducts", min: 1, max: 50, label: "Pages: Products" },
    { field: "pagesCreators", min: 1, max: 50, label: "Pages: Creators" },
    { field: "detailBatchSize", min: 1, max: 50, label: "Detail Batch Size" },
    {
      field: "detailMaxAgeDays",
      min: 1,
      max: 90,
      label: "Detail Max Age Days",
    },
  ];

  for (const { field, min, max, label } of numericFields) {
    if (patch[field] !== undefined) {
      const n = Number(patch[field]);
      if (!isFinite(n) || n < min || n > max) {
        errors.push({
          field,
          message: `${label} must be a number between ${min} and ${max}`,
        });
      }
    }
  }

  if (patch.tasksEnabled !== undefined) {
    const valid = ["categories", "videos", "products", "creators", "details"];
    const provided = String(patch.tasksEnabled)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const t of provided) {
      if (!valid.includes(t)) {
        errors.push({
          field: "tasksEnabled",
          message: `Unknown task: "${t}". Valid tasks: ${valid.join(", ")}`,
        });
      }
    }
  }

  return errors;
}
