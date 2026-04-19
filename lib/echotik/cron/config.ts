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
import {
  type EchotikConfig,
  ECHOTIK_CONFIG_LIMITS,
} from "@/lib/types/echotik-admin";

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
  NEW_PRODUCTS_DAYS_BACK: "echotik:new-products:days_back",
  NEW_PRODUCTS_INTERVAL_HOURS: "echotik:new-products:interval_hours",
} as const;

// Re-export so existing callers (admin api route) can import from one place
export { ECHOTIK_CONFIG_LIMITS } from "@/lib/types/echotik-admin";

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
  tasksEnabled: "categories,videos,products,creators,details,new-products",
  newProductsDaysBack: 3,
  newProductsIntervalHours: 24,
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
    rawNewProductsDaysBack,
    rawNewProductsIntervalHours,
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
    getSetting(ECHOTIK_CONFIG_KEYS.NEW_PRODUCTS_DAYS_BACK),
    getSetting(ECHOTIK_CONFIG_KEYS.NEW_PRODUCTS_INTERVAL_HOURS),
  ]);

  const clamp = (raw: string | null, def: number, min: number, max: number) => {
    if (!raw) return def;
    const n = parseInt(raw, 10);
    if (isNaN(n)) return def;
    return Math.min(Math.max(n, min), max);
  };

  const enabledTasksRaw =
    rawTasksEnabled ?? ECHOTIK_CONFIG_DEFAULTS.tasksEnabled;
  const enabledTasks = enabledTasksRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    intervals: {
      categories: clamp(
        rawIntervalCategories,
        ECHOTIK_CONFIG_DEFAULTS.intervalCategories,
        ECHOTIK_CONFIG_LIMITS.interval.min,
        ECHOTIK_CONFIG_LIMITS.interval.max,
      ),
      videos: clamp(
        rawIntervalVideos,
        ECHOTIK_CONFIG_DEFAULTS.intervalVideos,
        ECHOTIK_CONFIG_LIMITS.interval.min,
        ECHOTIK_CONFIG_LIMITS.interval.max,
      ),
      products: clamp(
        rawIntervalProducts,
        ECHOTIK_CONFIG_DEFAULTS.intervalProducts,
        ECHOTIK_CONFIG_LIMITS.interval.min,
        ECHOTIK_CONFIG_LIMITS.interval.max,
      ),
      creators: clamp(
        rawIntervalCreators,
        ECHOTIK_CONFIG_DEFAULTS.intervalCreators,
        ECHOTIK_CONFIG_LIMITS.interval.min,
        ECHOTIK_CONFIG_LIMITS.interval.max,
      ),
    },
    pages: {
      videos: clamp(
        rawPagesVideos,
        ECHOTIK_CONFIG_DEFAULTS.pagesVideos,
        ECHOTIK_CONFIG_LIMITS.pages.min,
        ECHOTIK_CONFIG_LIMITS.pages.max,
      ),
      products: clamp(
        rawPagesProducts,
        ECHOTIK_CONFIG_DEFAULTS.pagesProducts,
        ECHOTIK_CONFIG_LIMITS.pages.min,
        ECHOTIK_CONFIG_LIMITS.pages.max,
      ),
      creators: clamp(
        rawPagesCreators,
        ECHOTIK_CONFIG_DEFAULTS.pagesCreators,
        ECHOTIK_CONFIG_LIMITS.pages.min,
        ECHOTIK_CONFIG_LIMITS.pages.max,
      ),
    },
    detail: {
      batchSize: clamp(
        rawDetailBatchSize,
        ECHOTIK_CONFIG_DEFAULTS.detailBatchSize,
        ECHOTIK_CONFIG_LIMITS.detailBatchSize.min,
        ECHOTIK_CONFIG_LIMITS.detailBatchSize.max,
      ),
      maxAgeDays: clamp(
        rawDetailMaxAgeDays,
        ECHOTIK_CONFIG_DEFAULTS.detailMaxAgeDays,
        ECHOTIK_CONFIG_LIMITS.detailMaxAgeDays.min,
        ECHOTIK_CONFIG_LIMITS.detailMaxAgeDays.max,
      ),
    },
    enabledTasksRaw,
    enabledTasks,
    newProducts: {
      daysBack: clamp(
        rawNewProductsDaysBack,
        ECHOTIK_CONFIG_DEFAULTS.newProductsDaysBack,
        ECHOTIK_CONFIG_LIMITS.newProductsDaysBack.min,
        ECHOTIK_CONFIG_LIMITS.newProductsDaysBack.max,
      ),
      intervalHours: clamp(
        rawNewProductsIntervalHours,
        ECHOTIK_CONFIG_DEFAULTS.newProductsIntervalHours,
        ECHOTIK_CONFIG_LIMITS.newProductsIntervalHours.min,
        ECHOTIK_CONFIG_LIMITS.newProductsIntervalHours.max,
      ),
    },
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
    newProductsDaysBack: number;
    newProductsIntervalHours: number;
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
  if (patch.newProductsDaysBack !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.NEW_PRODUCTS_DAYS_BACK,
        String(patch.newProductsDaysBack),
        {
          label: "Novos Produtos: Days Back",
          group: "echotik",
          type: "number",
        },
      ),
    );
  }
  if (patch.newProductsIntervalHours !== undefined) {
    updates.push(
      upsertSetting(
        ECHOTIK_CONFIG_KEYS.NEW_PRODUCTS_INTERVAL_HOURS,
        String(patch.newProductsIntervalHours),
        {
          label: "Novos Produtos: Interval Hours",
          group: "echotik",
          type: "number",
        },
      ),
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
      min: ECHOTIK_CONFIG_LIMITS.interval.min,
      max: ECHOTIK_CONFIG_LIMITS.interval.max,
      label: "Interval: Categories",
    },
    {
      field: "intervalVideos",
      min: ECHOTIK_CONFIG_LIMITS.interval.min,
      max: ECHOTIK_CONFIG_LIMITS.interval.max,
      label: "Interval: Videos",
    },
    {
      field: "intervalProducts",
      min: ECHOTIK_CONFIG_LIMITS.interval.min,
      max: ECHOTIK_CONFIG_LIMITS.interval.max,
      label: "Interval: Products",
    },
    {
      field: "intervalCreators",
      min: ECHOTIK_CONFIG_LIMITS.interval.min,
      max: ECHOTIK_CONFIG_LIMITS.interval.max,
      label: "Interval: Creators",
    },
    {
      field: "pagesVideos",
      min: ECHOTIK_CONFIG_LIMITS.pages.min,
      max: ECHOTIK_CONFIG_LIMITS.pages.max,
      label: "Pages: Videos",
    },
    {
      field: "pagesProducts",
      min: ECHOTIK_CONFIG_LIMITS.pages.min,
      max: ECHOTIK_CONFIG_LIMITS.pages.max,
      label: "Pages: Products",
    },
    {
      field: "pagesCreators",
      min: ECHOTIK_CONFIG_LIMITS.pages.min,
      max: ECHOTIK_CONFIG_LIMITS.pages.max,
      label: "Pages: Creators",
    },
    {
      field: "detailBatchSize",
      min: ECHOTIK_CONFIG_LIMITS.detailBatchSize.min,
      max: ECHOTIK_CONFIG_LIMITS.detailBatchSize.max,
      label: "Detail Batch Size",
    },
    {
      field: "detailMaxAgeDays",
      min: ECHOTIK_CONFIG_LIMITS.detailMaxAgeDays.min,
      max: ECHOTIK_CONFIG_LIMITS.detailMaxAgeDays.max,
      label: "Detail Max Age Days",
    },
    {
      field: "newProductsDaysBack",
      min: ECHOTIK_CONFIG_LIMITS.newProductsDaysBack.min,
      max: ECHOTIK_CONFIG_LIMITS.newProductsDaysBack.max,
      label: "Novos Produtos: Days Back",
    },
    {
      field: "newProductsIntervalHours",
      min: ECHOTIK_CONFIG_LIMITS.newProductsIntervalHours.min,
      max: ECHOTIK_CONFIG_LIMITS.newProductsIntervalHours.max,
      label: "Novos Produtos: Interval Hours",
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
    const valid = ["categories", "videos", "products", "creators", "details", "new-products"];
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
