/**
 * lib/types/echotik-admin.ts
 *
 * Shared DTOs for the Echotik admin tab.
 * Used by backend services and frontend components.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface EchotikTaskIntervals {
  categories: number; // hours
  videos: number; // hours
  products: number; // hours
  creators: number; // hours
}

export interface EchotikPageConfig {
  videos: number;
  products: number;
  creators: number;
}

export interface EchotikDetailConfig {
  batchSize: number;
  maxAgeDays: number;
}

/** All configurable parameters for the Echotik ingestion system. */
export interface EchotikConfig {
  /** Expected re-sync interval per task type, in hours. */
  intervals: EchotikTaskIntervals;
  /** Number of pages fetched per ranklist sync. Each page returns 10 items. */
  pages: EchotikPageConfig;
  /** Product detail enrichment settings. */
  detail: EchotikDetailConfig;
  /** Comma-separated list of enabled tasks. */
  enabledTasksRaw: string;
  /** Parsed set of enabled tasks. */
  enabledTasks: string[];
}

// ---------------------------------------------------------------------------
// Health & Operational Status
// ---------------------------------------------------------------------------

export type IngestionTaskType =
  | "categories"
  | "videos"
  | "products"
  | "creators";

export type HealthStatus =
  | "healthy"
  | "stale"
  | "failing"
  | "never_run"
  | "inactive";

/** Health record for one task × region combination. */
export interface TaskRegionHealth {
  /** Canonical source key, e.g. "echotik:videos:BR" */
  source: string;
  task: IngestionTaskType;
  /** null for region-agnostic tasks (categories) */
  region: string | null;
  regionName: string | null;
  isRegionActive: boolean;
  isTaskEnabled: boolean;
  lastSuccessAt: string | null; // ISO
  lastFailureAt: string | null; // ISO
  lastRunAt: string | null; // ISO (whichever is more recent)
  lastRunStatus: string | null;
  /** Hours since last successful run. null if never ran. */
  hoursSinceSuccess: number | null;
  /** Fraction: (hoursSinceSuccess / expectedIntervalHours). >1 means stale. */
  stalenessRatio: number | null;
  failures24h: number;
  /** Overall health verdict for this combination. */
  status: HealthStatus;
  /** Last error message, if any. */
  lastErrorMessage: string | null;
  /** Items processed in last successful run. */
  lastItemsProcessed: number | null;
  /** Pages processed in last successful run. */
  lastPagesProcessed: number | null;
  /** Duration in ms of last run. */
  lastDurationMs: number | null;
}

/** Summary counters shown at top of health section. */
export interface EchotikHealthSummary {
  totalCombinations: number;
  healthy: number;
  stale: number;
  failing: number;
  neverRun: number;
  inactive: number;
  /** The most stale active combination. */
  mostStale: TaskRegionHealth | null;
  /** Active regions count. */
  activeRegionsCount: number;
}

export interface EchotikHealthResponse {
  summary: EchotikHealthSummary;
  tasks: TaskRegionHealth[];
  generatedAt: string; // ISO
}

// ---------------------------------------------------------------------------
// Run history
// ---------------------------------------------------------------------------

export interface IngestionRunRecord {
  id: string;
  source: string;
  task: string;
  region: string | null;
  status: string;
  startedAt: string; // ISO
  endedAt: string | null; // ISO
  durationMs: number | null;
  itemsProcessed: number | null;
  pagesProcessed: number | null;
  errorMessage: string | null;
}

export interface IngestionRunsResponse {
  runs: IngestionRunRecord[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// API Request Estimation
// ---------------------------------------------------------------------------

/** Input parameters for estimation — mirrors EchotikConfig but can be a hypothetical. */
export interface EstimationInput {
  activeRegions: number;
  videoPages: number;
  productPages: number;
  creatorPages: number;
  detailBatchSize: number;
  rankingCycles: number; // always 3 (daily/weekly/monthly)
  rankFields: number; // always 2 per entity type
  categoriesIntervalHours: number;
  videosIntervalHours: number;
  productsIntervalHours: number;
  creatorsIntervalHours: number;
  enabledTasks: string[];
  cronIntervalMinutes: number; // 15
}

/** Breakdown of estimated requests per entity. */
export interface EntityEstimate {
  /** Name of the task/entity. */
  entity: string;
  /** Requests per invocation for this entity. */
  requestsPerInvocation: number;
  /** How many invocations per 24-hour period. */
  invocationsPerDay: number;
  /** Total requests per day from this entity × all regions. */
  requestsPerDay: number;
  /** Breakdown by type: probe calls vs data calls. */
  probeCallsPerInvocation: number;
  dataCallsPerInvocation: number;
  /** Number of regions contributing. */
  regions: number;
  /** Whether this task is enabled. */
  enabled: boolean;
}

/** Full estimation result. */
export interface EstimationResult {
  input: EstimationInput;
  breakdown: EntityEstimate[];
  /** Total estimated requests per day across all tasks. */
  totalRequestsPerDay: number;
  /** Total estimated requests per 15-minute cron tick. */
  requestsPerCronTick: number;
  /** Note about estimate accuracy. */
  notes: string[];
  /** Approximate Vercel function invocations per day. */
  invocationsPerDay: number;
}
