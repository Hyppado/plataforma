/**
 * lib/echotik/admin/health.ts
 *
 * Operational health service for the Echotik ingestion system.
 *
 * Queries IngestionRun to compute:
 * - Last success/failure per task × region combination
 * - Staleness ratio (time since success / expected interval)
 * - Failure count in last 24h
 * - Overall health status
 *
 * Uses a single GROUP BY query for efficiency — O(1) DB calls, not O(N).
 */

import { prisma } from "@/lib/prisma";
import { getEchotikConfig } from "@/lib/echotik/cron/config";
import type {
  EchotikHealthResponse,
  EchotikHealthSummary,
  HealthStatus,
  IngestionTaskType,
  TaskRegionHealth,
} from "@/lib/types/echotik-admin";

// ---------------------------------------------------------------------------
// Source key parsing
// ---------------------------------------------------------------------------

function parseSource(source: string): {
  task: IngestionTaskType | null;
  region: string | null;
} {
  // "echotik:categories"       → task=categories, region=null
  // "echotik:videos:BR"        → task=videos, region=BR
  // "echotik:run:videos:BR"    → task=videos, region=BR  (audit source format)
  // "echotik:run:categories"   → task=categories, region=null
  const withoutPrefix = source.replace(/^echotik:/, "");
  const withoutRun = withoutPrefix.replace(/^run:/, "");
  const parts = withoutRun.split(":");
  const knownTasks = ["categories", "videos", "products", "creators"] as const;
  const task = knownTasks.includes(parts[0] as IngestionTaskType)
    ? (parts[0] as IngestionTaskType)
    : null;
  const region = parts[1] ?? null;
  return { task, region };
}

// ---------------------------------------------------------------------------
// Health resolution
// ---------------------------------------------------------------------------

function resolveHealthStatus(
  lastSuccessAt: Date | null,
  lastFailureAt: Date | null,
  failures24h: number,
  expectedIntervalHours: number,
  isEnabled: boolean,
  isRegionActive: boolean,
): HealthStatus {
  if (!isEnabled || !isRegionActive) return "inactive";
  if (!lastSuccessAt) return "never_run";

  // Only "failing" when there are 3+ recent failures AND the task has not yet
  // recovered — i.e. the most recent run was a failure, not a success.
  // Without the recovery check, tasks that failed but then succeeded still
  // showed "failing" because the 24h failure window hadn't expired.
  if (
    failures24h >= 3 &&
    lastFailureAt !== null &&
    lastFailureAt > lastSuccessAt
  ) {
    return "failing";
  }

  const ageMs = Date.now() - lastSuccessAt.getTime();
  const expectedMs = expectedIntervalHours * 60 * 60 * 1000;
  // stale if older than 1.5× the expected interval
  if (ageMs > expectedMs * 1.5) return "stale";
  return "healthy";
}

/** Derives the last run status from the latest success/failure timestamps. */
function deriveLastRunStatus(
  lastSuccessAt: Date | null,
  lastFailureAt: Date | null,
): string | null {
  if (!lastSuccessAt && !lastFailureAt) return null;
  if (!lastFailureAt) return "SUCCESS";
  if (!lastSuccessAt) return "FAILED";
  return lastSuccessAt >= lastFailureAt ? "SUCCESS" : "FAILED";
}

// ---------------------------------------------------------------------------
// Extract item/page counts from statsJson
// ---------------------------------------------------------------------------

function extractStats(statsJson: unknown): {
  items: number | null;
  pages: number | null;
  durationMs: number | null;
} {
  if (!statsJson || typeof statsJson !== "object") {
    return { items: null, pages: null, durationMs: null };
  }
  const s = statsJson as Record<string, unknown>;
  const items =
    typeof s.videosSynced === "number"
      ? s.videosSynced
      : typeof s.productsSynced === "number"
        ? s.productsSynced
        : typeof s.creatorsSynced === "number"
          ? s.creatorsSynced
          : typeof s.categoriesSynced === "number"
            ? s.categoriesSynced
            : null;
  const pages = typeof s.pagesProcessed === "number" ? s.pagesProcessed : null;
  const durationMs = typeof s.durationMs === "number" ? s.durationMs : null;
  return { items, pages, durationMs };
}

// ---------------------------------------------------------------------------
// Main health query
// ---------------------------------------------------------------------------

export async function getEchotikHealth(): Promise<EchotikHealthResponse> {
  const [config, regions] = await Promise.all([
    getEchotikConfig(),
    prisma.region.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const regionMap = new Map(
    regions.map((r) => [r.code, { name: r.name, isActive: r.isActive }]),
  );

  const windowStart24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Single query: latest success + latest failure per source
  const latestBySource = await prisma.ingestionRun.groupBy({
    by: ["source"],
    where: {
      source: { startsWith: "echotik:" },
      status: { in: ["SUCCESS", "FAILED"] },
    },
    _max: { endedAt: true, startedAt: true },
  });

  // Separate query for latest SUCCESS per source (for accurate staleness)
  const latestSuccess = await prisma.ingestionRun.groupBy({
    by: ["source"],
    where: { source: { startsWith: "echotik:" }, status: "SUCCESS" },
    _max: { endedAt: true },
  });
  // Normalize success keys (echotik:run:X:R → echotik:X:R)
  const successMap = new Map<string, Date | null>();
  for (const r of latestSuccess) {
    const canonical = r.source.replace(":run:", ":");
    const existing = successMap.get(canonical);
    const val = r._max.endedAt;
    if (!existing || (val && val > existing)) {
      successMap.set(canonical, val);
    }
    if (r.source !== canonical) {
      successMap.set(r.source, val);
    }
  }

  // Separate query for latest FAILED per source
  const latestFailure = await prisma.ingestionRun.groupBy({
    by: ["source"],
    where: { source: { startsWith: "echotik:" }, status: "FAILED" },
    _max: { endedAt: true },
  });
  // Build failure map that normalizes lifecycle keys (echotik:run:X:R → echotik:X:R)
  // so health lookups by canonical source find failures from both key formats.
  const failureMap = new Map<string, Date | null>();
  for (const r of latestFailure) {
    const canonical = r.source.replace(":run:", ":");
    const existing = failureMap.get(canonical);
    const val = r._max.endedAt;
    if (!existing || (val && val > existing)) {
      failureMap.set(canonical, val);
    }
    // Also keep the original key for direct lookups
    if (r.source !== canonical) {
      failureMap.set(r.source, val);
    }
  }

  // Failures in last 24h per source
  const failures24hRows = await prisma.ingestionRun.groupBy({
    by: ["source"],
    where: {
      source: { startsWith: "echotik:" },
      status: "FAILED",
      startedAt: { gte: windowStart24h },
    },
    _count: { id: true },
  });
  // Normalize failures24h keys the same way
  const failures24hMap = new Map<string, number>();
  for (const r of failures24hRows) {
    const canonical = r.source.replace(":run:", ":");
    failures24hMap.set(
      canonical,
      (failures24hMap.get(canonical) ?? 0) + r._count.id,
    );
    if (r.source !== canonical) {
      failures24hMap.set(
        r.source,
        (failures24hMap.get(r.source) ?? 0) + r._count.id,
      );
    }
  }

  // Most recent successful run per source (for statsJson)
  const recentSuccessRuns = await prisma.ingestionRun.findMany({
    where: {
      source: { startsWith: "echotik:" },
      status: "SUCCESS",
      endedAt: { not: null },
    },
    orderBy: { endedAt: "desc" },
    distinct: ["source"],
    select: { source: true, statsJson: true, errorMessage: true },
  });
  // Normalize stats keys (echotik:run:X:R → echotik:X:R)
  const recentStatsMap = new Map<string, unknown>();
  for (const r of recentSuccessRuns) {
    const canonical = r.source.replace(":run:", ":");
    if (!recentStatsMap.has(canonical)) {
      recentStatsMap.set(canonical, r.statsJson);
    }
    if (r.source !== canonical && !recentStatsMap.has(r.source)) {
      recentStatsMap.set(r.source, r.statsJson);
    }
  }

  // Most recent failed run per source (for errorMessage)
  const recentFailedRuns = await prisma.ingestionRun.findMany({
    where: { source: { startsWith: "echotik:" }, status: "FAILED" },
    orderBy: { endedAt: "desc" },
    distinct: ["source"],
    select: { source: true, errorMessage: true },
  });
  // Normalize error keys (echotik:run:X:R → echotik:X:R)
  const recentErrorMap = new Map<string, string | null>();
  for (const r of recentFailedRuns) {
    const canonical = r.source.replace(":run:", ":");
    if (!recentErrorMap.has(canonical)) {
      recentErrorMap.set(canonical, r.errorMessage);
    }
    if (r.source !== canonical && !recentErrorMap.has(r.source)) {
      recentErrorMap.set(r.source, r.errorMessage);
    }
  }

  // Build the canonical set of task × region combos to report
  const activeRegions = regions.filter((r) => r.isActive).map((r) => r.code);
  const allRegions = regions.map((r) => r.code);

  const RANKLIST_TASKS: IngestionTaskType[] = [
    "videos",
    "products",
    "creators",
  ];
  const tasks: TaskRegionHealth[] = [];

  const intervalFor = (task: IngestionTaskType): number => {
    switch (task) {
      case "categories":
        return config.intervals.categories;
      case "videos":
        return config.intervals.videos;
      case "products":
        return config.intervals.products;
      case "creators":
        return config.intervals.creators;
    }
  };

  // Categories (region-agnostic)
  {
    const source = "echotik:categories";
    const lastSuccess = successMap.get(source) ?? null;
    const lastFailure = failureMap.get(source) ?? null;
    const failures24h = failures24hMap.get(source) ?? 0;
    const interval = intervalFor("categories");
    const isEnabled = config.enabledTasks.includes("categories");
    const ageMs = lastSuccess ? Date.now() - lastSuccess.getTime() : null;
    const hoursSinceSuccess = ageMs != null ? ageMs / (60 * 60 * 1000) : null;
    const stalenessRatio =
      hoursSinceSuccess != null ? hoursSinceSuccess / interval : null;
    const lastRun = latestBySource.find(
      (r) => r.source === source || r.source.replace(":run:", ":") === source,
    );
    const stats = extractStats(recentStatsMap.get(source));

    tasks.push({
      source,
      task: "categories",
      region: null,
      regionName: null,
      isRegionActive: true,
      isTaskEnabled: isEnabled,
      lastSuccessAt: lastSuccess?.toISOString() ?? null,
      lastFailureAt: lastFailure?.toISOString() ?? null,
      lastRunAt:
        (lastRun?._max.startedAt ?? lastRun?._max.endedAt)?.toISOString() ??
        null,
      lastRunStatus: deriveLastRunStatus(lastSuccess, lastFailure),
      hoursSinceSuccess,
      stalenessRatio,
      failures24h,
      status: resolveHealthStatus(
        lastSuccess,
        lastFailure,
        failures24h,
        interval,
        isEnabled,
        true,
      ),
      lastErrorMessage: recentErrorMap.get(source) ?? null,
      lastItemsProcessed: stats.items,
      lastPagesProcessed: stats.pages,
      lastDurationMs: stats.durationMs,
    });
  }

  // Ranklist tasks × all regions
  for (const task of RANKLIST_TASKS) {
    for (const regionCode of allRegions) {
      const source = `echotik:${task}:${regionCode}`;
      const regionInfo = regionMap.get(regionCode);
      const lastSuccess = successMap.get(source) ?? null;
      const lastFailure = failureMap.get(source) ?? null;
      const failures24h = failures24hMap.get(source) ?? 0;
      const interval = intervalFor(task);
      const isEnabled = config.enabledTasks.includes(task);
      const isRegionActive = regionInfo?.isActive ?? false;
      const ageMs = lastSuccess ? Date.now() - lastSuccess.getTime() : null;
      const hoursSinceSuccess = ageMs != null ? ageMs / (60 * 60 * 1000) : null;
      const stalenessRatio =
        hoursSinceSuccess != null ? hoursSinceSuccess / interval : null;
      const latestRun = latestBySource.find(
        (r) => r.source === source || r.source.replace(":run:", ":") === source,
      );
      const stats = extractStats(recentStatsMap.get(source));

      tasks.push({
        source,
        task,
        region: regionCode,
        regionName: regionInfo?.name ?? regionCode,
        isRegionActive,
        isTaskEnabled: isEnabled,
        lastSuccessAt: lastSuccess?.toISOString() ?? null,
        lastFailureAt: lastFailure?.toISOString() ?? null,
        lastRunAt:
          (
            latestRun?._max.startedAt ?? latestRun?._max.endedAt
          )?.toISOString() ?? null,
        lastRunStatus: deriveLastRunStatus(lastSuccess, lastFailure),
        hoursSinceSuccess,
        stalenessRatio,
        failures24h,
        status: resolveHealthStatus(
          lastSuccess,
          lastFailure,
          failures24h,
          interval,
          isEnabled,
          isRegionActive,
        ),
        lastErrorMessage: recentErrorMap.get(source) ?? null,
        lastItemsProcessed: stats.items,
        lastPagesProcessed: stats.pages,
        lastDurationMs: stats.durationMs,
      });
    }
  }

  // Summary
  const activeTasks = tasks.filter((t) => t.isTaskEnabled && t.isRegionActive);
  const summary: EchotikHealthSummary = {
    totalCombinations: activeTasks.length,
    healthy: activeTasks.filter((t) => t.status === "healthy").length,
    stale: activeTasks.filter((t) => t.status === "stale").length,
    failing: activeTasks.filter((t) => t.status === "failing").length,
    neverRun: activeTasks.filter((t) => t.status === "never_run").length,
    inactive: tasks.filter((t) => t.status === "inactive").length,
    mostStale:
      activeTasks
        .filter((t) => t.stalenessRatio != null)
        .sort((a, b) => (b.stalenessRatio ?? 0) - (a.stalenessRatio ?? 0))[0] ??
      null,
    activeRegionsCount: activeRegions.length,
  };

  return {
    summary,
    tasks,
    generatedAt: new Date().toISOString(),
  };
}
