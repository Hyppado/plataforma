/**
 * lib/echotik/cron/orchestrator.ts — Main cron entrypoint
 *
 * Runs ONE task for ONE region per invocation to stay within Vercel's 60s limit.
 *
 * Budget per invocation: 1 region × 3 cycles × 2 fields × 10 pages ≈ 40s.
 *
 * shouldSkip keys are region-scoped: "echotik:videos:BR", "echotik:videos:US"…
 * In "auto" mode, the orchestrator iterates task × region to find the first
 * combo that needs syncing. The Vercel cron runs every 15 min so with 4 regions
 * × 4 task types = 16 combos, the full cycle completes within ~4h daily.
 *
 * Priority: categories (once, no region) → videos:*, products:*, creators:* → details
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { Logger } from "@/lib/logger";
import type { CronResult, CronStats } from "./types";
import { shouldSkip, getConfiguredRegions } from "./helpers";
import { getEchotikConfig } from "./config";
import type { EchotikConfig } from "@/lib/types/echotik-admin";
import { syncAllCategories } from "./syncCategories";
import { syncVideoRanklist, syncVideoProductDetails } from "./syncVideos";
import {
  syncProductRanklist,
  syncRanklistProductDetails,
} from "./syncProducts";
import { syncCreatorRanklist } from "./syncCreators";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CronTask =
  | "categories"
  | "videos"
  | "products"
  | "creators"
  | "details"
  | "auto";

export interface CronOptions {
  /** Which task to run (default: "auto" — picks the next needed one) */
  task?: CronTask;
  /** Region for ranklist tasks — required when task != auto/categories/details */
  region?: string;
  /** If true, ignores shouldSkip intervals */
  force?: boolean;
}

export interface TaskSelection {
  task: CronTask;
  region: string | null;
}

// ---------------------------------------------------------------------------
// Task detection — which (task, region) combo needs to run next?
// ---------------------------------------------------------------------------

/**
 * Returns the next {task, region} combo that needs syncing, or null if
 * everything is fresh.
 */
export async function detectNextTask(
  force: boolean,
  config?: EchotikConfig,
): Promise<TaskSelection | null> {
  // Load config if not provided (allows caller to pass pre-loaded config)
  const cfg = config ?? (await getEchotikConfig());

  const categoriesInterval = cfg.intervals.categories;
  const videosInterval = cfg.intervals.videos;
  const productsInterval = cfg.intervals.products;
  const creatorsInterval = cfg.intervals.creators;

  // 1. Categories (region-agnostic, runs once per interval)
  if (
    cfg.enabledTasks.includes("categories") &&
    (force || !(await shouldSkip("echotik:categories", categoriesInterval)))
  ) {
    return { task: "categories", region: null };
  }

  const regions = await getConfiguredRegions();

  // 2. Videos — per region
  if (cfg.enabledTasks.includes("videos")) {
    for (const region of regions) {
      if (
        force ||
        !(await shouldSkip(`echotik:videos:${region}`, videosInterval))
      ) {
        return { task: "videos", region };
      }
    }
  }

  // 3. Products — per region
  if (cfg.enabledTasks.includes("products")) {
    for (const region of regions) {
      if (
        force ||
        !(await shouldSkip(`echotik:products:${region}`, productsInterval))
      ) {
        return { task: "products", region };
      }
    }
  }

  // 4. Creators — per region
  if (cfg.enabledTasks.includes("creators")) {
    for (const region of regions) {
      if (
        force ||
        !(await shouldSkip(`echotik:creators:${region}`, creatorsInterval))
      ) {
        return { task: "creators", region };
      }
    }
  }

  // 5. Details (always worth trying — cheap when nothing is missing)
  return { task: "details", region: null };
}

// ---------------------------------------------------------------------------
// Individual task runners
// ---------------------------------------------------------------------------

async function runCategories(
  runId: string,
  log: Logger,
): Promise<Partial<CronStats>> {
  const synced = await syncAllCategories(runId, log);
  await prisma.ingestionRun.create({
    data: {
      source: "echotik:categories",
      status: "SUCCESS",
      endedAt: new Date(),
    },
  });
  return { categoriesSynced: synced };
}

async function runVideos(
  runId: string,
  region: string,
  log: Logger,
  maxPages: number,
): Promise<Partial<CronStats>> {
  const synced = await syncVideoRanklist(runId, region, log, maxPages);
  const pagesProcessed = 3 * 2 * maxPages; // cycles × fields × pages
  await prisma.ingestionRun.create({
    data: {
      source: `echotik:videos:${region}`,
      status: "SUCCESS",
      endedAt: new Date(),
    },
  });
  return { videosSynced: synced, pagesProcessed };
}

async function runProducts(
  runId: string,
  region: string,
  log: Logger,
  maxPages: number,
): Promise<Partial<CronStats>> {
  const synced = await syncProductRanklist(runId, region, log, maxPages);
  const pagesProcessed = 3 * 2 * maxPages;
  await prisma.ingestionRun.create({
    data: {
      source: `echotik:products:${region}`,
      status: "SUCCESS",
      endedAt: new Date(),
    },
  });
  return { productsSynced: synced, pagesProcessed };
}

async function runCreators(
  runId: string,
  region: string,
  log: Logger,
  maxPages: number,
): Promise<Partial<CronStats>> {
  const synced = await syncCreatorRanklist(runId, region, log, maxPages);
  const pagesProcessed = 3 * 2 * maxPages;
  await prisma.ingestionRun.create({
    data: {
      source: `echotik:creators:${region}`,
      status: "SUCCESS",
      endedAt: new Date(),
    },
  });
  return { creatorsSynced: synced, pagesProcessed };
}

async function runDetails(log: Logger): Promise<Partial<CronStats>> {
  const [videoDetails, ranklistDetails] = await Promise.all([
    syncVideoProductDetails(log),
    syncRanklistProductDetails(log),
  ]);
  return { productDetailsEnriched: videoDetails + ranklistDetails };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyStats(): CronStats {
  return {
    categoriesSynced: 0,
    videosSynced: 0,
    productsSynced: 0,
    creatorsSynced: 0,
    productDetailsEnriched: 0,
    categoriesSkipped: true,
    videosSkipped: true,
    productsSkipped: true,
    creatorsSkipped: true,
    durationMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

/**
 * Executa o cron de ingestão EchoTik.
 *
 * Cada invocação roda UMA tarefa para UMA região para caber em 60s.
 * No modo "auto" (padrão), escolhe a próxima tarefa+região pendente.
 */
export async function runEchotikCron(
  opts: CronOptions = {},
): Promise<CronResult> {
  const {
    task: requestedTask = "auto",
    region: requestedRegion,
    force = false,
  } = opts;
  const start = Date.now();
  const log = createLogger("echotik-cron");

  // Load dynamic config once — all intervals/pages come from here
  const config = await getEchotikConfig();

  // Resolve which (task, region) to run
  let selection: TaskSelection | null;
  if (requestedTask === "auto") {
    selection = await detectNextTask(force, config);
  } else if (
    requestedRegion === undefined &&
    (requestedTask === "videos" ||
      requestedTask === "products" ||
      requestedTask === "creators")
  ) {
    // Explicit ranklist task but no region provided: auto-pick the first region
    // needing sync (or the first region if force=true).
    const regions = await getConfiguredRegions();
    const intervalMap: Record<string, number> = {
      videos: config.intervals.videos,
      products: config.intervals.products,
      creators: config.intervals.creators,
    };
    const interval = intervalMap[requestedTask];
    let pickedRegion = regions[0] ?? null;
    if (!force) {
      for (const r of regions) {
        if (!(await shouldSkip(`echotik:${requestedTask}:${r}`, interval))) {
          pickedRegion = r;
          break;
        }
      }
    }
    selection = pickedRegion
      ? { task: requestedTask, region: pickedRegion }
      : null;
  } else {
    selection = {
      task: requestedTask,
      region: requestedRegion ?? null,
    };
  }

  log.info("Cron started", {
    requestedTask,
    requestedRegion: requestedRegion ?? "auto",
    resolvedTask: selection?.task ?? "none",
    resolvedRegion: selection?.region ?? "n/a",
    force,
    correlationId: log.correlationId,
  });

  if (!selection) {
    log.info("Everything up-to-date, nothing to sync");
    return {
      runId: "",
      status: "SKIPPED",
      stats: { ...emptyStats(), durationMs: Date.now() - start },
    };
  }

  const { task, region } = selection;

  // Product details don't need an IngestionRun record
  if (task === "details") {
    try {
      const partial = await runDetails(log);
      const stats = {
        ...emptyStats(),
        ...partial,
        durationMs: Date.now() - start,
      };
      log.info("Details enrichment done", {
        enriched: stats.productDetailsEnriched,
      });
      return {
        runId: "",
        status: stats.productDetailsEnriched > 0 ? "SUCCESS" : "SKIPPED",
        stats,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.error("Details enrichment failed", { error: errorMessage });
      return {
        runId: "",
        status: "FAILED",
        stats: { ...emptyStats(), durationMs: Date.now() - start },
        error: errorMessage,
      };
    }
  }

  // Create IngestionRun record
  const runSource = region
    ? `echotik:run:${task}:${region}`
    : `echotik:run:${task}`;
  const run = await prisma.ingestionRun.create({
    data: { source: runSource, status: "RUNNING" },
  });
  const runLog = log.child({
    runId: run.id,
    task,
    region: region ?? undefined,
  });

  try {
    let partial: Partial<CronStats> = {};

    switch (task) {
      case "categories":
        partial = await runCategories(run.id, runLog);
        break;
      case "videos":
        if (!region) throw new Error("videos task requires a region");
        partial = await runVideos(run.id, region, runLog, config.pages.videos);
        break;
      case "products":
        if (!region) throw new Error("products task requires a region");
        partial = await runProducts(
          run.id,
          region,
          runLog,
          config.pages.products,
        );
        break;
      case "creators":
        if (!region) throw new Error("creators task requires a region");
        partial = await runCreators(
          run.id,
          region,
          runLog,
          config.pages.creators,
        );
        break;
    }

    const stats: CronStats = {
      ...emptyStats(),
      ...partial,
      [`${task}Skipped`]: false,
      durationMs: Date.now() - start,
    };

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", endedAt: new Date(), statsJson: stats as any },
    });

    runLog.info("Task completed", {
      task,
      region: region ?? undefined,
      durationMs: stats.durationMs,
      ...partial,
    });

    return { runId: run.id, status: "SUCCESS", stats };
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stats = { ...emptyStats(), durationMs };

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
        statsJson: stats as any,
        errorMessage,
      },
    });

    runLog.error("Task failed", {
      task,
      region: region ?? undefined,
      durationMs,
      error: errorMessage,
    });
    return { runId: run.id, status: "FAILED", stats, error: errorMessage };
  }
}
