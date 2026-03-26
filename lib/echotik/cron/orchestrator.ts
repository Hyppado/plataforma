/**
 * lib/echotik/cron/orchestrator.ts — Main cron entrypoint
 *
 * Runs ONE task per invocation to stay within Vercel's 60s function limit.
 * In "auto" mode, picks the next task that needs syncing based on shouldSkip().
 * The Vercel cron is scheduled every 15 min so all tasks complete within ~1h.
 *
 * Task priority: categories → videos → products → creators → details
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { Logger } from "@/lib/logger";
import type { CronResult, CronStats } from "./types";
import {
  CATEGORIES_INTERVAL_HOURS,
  VIDEO_TREND_INTERVAL_HOURS,
  PRODUCT_TREND_INTERVAL_HOURS,
  CREATOR_TREND_INTERVAL_HOURS,
} from "./types";
import { shouldSkip } from "./helpers";
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
  /** If true, ignores shouldSkip intervals */
  force?: boolean;
}

// ---------------------------------------------------------------------------
// Task detection — which task needs to run next?
// ---------------------------------------------------------------------------

/** Returns the first task that needs syncing, or null if everything is fresh. */
export async function detectNextTask(force: boolean): Promise<CronTask | null> {
  if (
    force ||
    !(await shouldSkip("echotik:categories", CATEGORIES_INTERVAL_HOURS))
  ) {
    return "categories";
  }
  if (
    force ||
    !(await shouldSkip("echotik:videos", VIDEO_TREND_INTERVAL_HOURS))
  ) {
    return "videos";
  }
  if (
    force ||
    !(await shouldSkip("echotik:products", PRODUCT_TREND_INTERVAL_HOURS))
  ) {
    return "products";
  }
  if (
    force ||
    !(await shouldSkip("echotik:creators", CREATOR_TREND_INTERVAL_HOURS))
  ) {
    return "creators";
  }
  // Details are always worth trying (cheap if nothing is missing)
  return "details";
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
  log: Logger,
): Promise<Partial<CronStats>> {
  const synced = await syncVideoRanklist(runId, log);
  await prisma.ingestionRun.create({
    data: {
      source: "echotik:videos",
      status: "SUCCESS",
      endedAt: new Date(),
    },
  });
  return { videosSynced: synced };
}

async function runProducts(
  runId: string,
  log: Logger,
): Promise<Partial<CronStats>> {
  const synced = await syncProductRanklist(runId, log);
  await prisma.ingestionRun.create({
    data: {
      source: "echotik:products",
      status: "SUCCESS",
      endedAt: new Date(),
    },
  });
  return { productsSynced: synced };
}

async function runCreators(
  runId: string,
  log: Logger,
): Promise<Partial<CronStats>> {
  const synced = await syncCreatorRanklist(runId, log);
  await prisma.ingestionRun.create({
    data: {
      source: "echotik:creators",
      status: "SUCCESS",
      endedAt: new Date(),
    },
  });
  return { creatorsSynced: synced };
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
 * Cada invocação roda **uma** tarefa para caber em 60s do Vercel.
 * No modo "auto" (padrão), escolhe a tarefa mais urgente.
 */
export async function runEchotikCron(
  opts: CronOptions = {},
): Promise<CronResult> {
  const { task: requestedTask = "auto", force = false } = opts;
  const start = Date.now();
  const log = createLogger("echotik-cron");

  // Resolve which task to run
  const task =
    requestedTask === "auto" ? await detectNextTask(force) : requestedTask;

  log.info("Cron started", {
    requestedTask,
    resolvedTask: task ?? "none",
    force,
    correlationId: log.correlationId,
  });

  // Nothing to do
  if (!task) {
    log.info("Everything up-to-date, nothing to sync");
    return {
      runId: "",
      status: "SKIPPED",
      stats: { ...emptyStats(), durationMs: Date.now() - start },
    };
  }

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

  // Create IngestionRun record for the task
  const run = await prisma.ingestionRun.create({
    data: { source: `echotik:run:${task}`, status: "RUNNING" },
  });
  const runLog = log.child({ runId: run.id, task });

  try {
    let partial: Partial<CronStats> = {};

    switch (task) {
      case "categories":
        partial = await runCategories(run.id, runLog);
        break;
      case "videos":
        partial = await runVideos(run.id, runLog);
        break;
      case "products":
        partial = await runProducts(run.id, runLog);
        break;
      case "creators":
        partial = await runCreators(run.id, runLog);
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

    runLog.error("Task failed", { task, durationMs, error: errorMessage });
    return { runId: run.id, status: "FAILED", stats, error: errorMessage };
  }
}
