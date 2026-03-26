/**
 * lib/echotik/cron/orchestrator.ts — Main cron entrypoint
 *
 * Coordinates all sync tasks with smart scheduling, structured logging,
 * and correlation tracking via a single runId/correlationId.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { CronResult } from "./types";
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

/**
 * Executa o cron de ingestão EchoTik com smart scheduling.
 *
 * @param force — se true, ignora intervalos e força todas as tarefas
 * @returns CronResult com runId, status e stats
 */
export async function runEchotikCron(force = false): Promise<CronResult> {
  const start = Date.now();
  const log = createLogger("echotik-cron");

  log.info("Cron started", { force, correlationId: log.correlationId });

  // Determine what needs to run
  const skipCategories =
    !force &&
    (await shouldSkip("echotik:categories", CATEGORIES_INTERVAL_HOURS));
  const skipVideos =
    !force && (await shouldSkip("echotik:videos", VIDEO_TREND_INTERVAL_HOURS));
  const skipProducts =
    !force &&
    (await shouldSkip("echotik:products", PRODUCT_TREND_INTERVAL_HOURS));
  const skipCreators =
    !force &&
    (await shouldSkip("echotik:creators", CREATOR_TREND_INTERVAL_HOURS));

  // If everything up-to-date, try enriching product details only
  if (skipCategories && skipVideos && skipProducts && skipCreators) {
    let productDetailsEnriched = 0;
    try {
      const [videoDetails, ranklistDetails] = await Promise.all([
        syncVideoProductDetails(log),
        syncRanklistProductDetails(log),
      ]);
      productDetailsEnriched = videoDetails + ranklistDetails;
    } catch (err) {
      log.error("Product detail enrichment failed (skip path)", {
        error: (err as Error).message,
      });
    }

    if (productDetailsEnriched === 0) {
      log.info("Everything up-to-date, nothing to sync");
      return {
        runId: "",
        status: "SKIPPED",
        stats: {
          categoriesSynced: 0,
          videosSynced: 0,
          productsSynced: 0,
          creatorsSynced: 0,
          productDetailsEnriched: 0,
          categoriesSkipped: true,
          videosSkipped: true,
          productsSkipped: true,
          creatorsSkipped: true,
          durationMs: Date.now() - start,
        },
      };
    }

    log.info("Product details enriched (tasks skipped)", {
      productDetailsEnriched,
    });
    return {
      runId: "",
      status: "SUCCESS",
      stats: {
        categoriesSynced: 0,
        videosSynced: 0,
        productsSynced: 0,
        creatorsSynced: 0,
        productDetailsEnriched,
        categoriesSkipped: true,
        videosSkipped: true,
        productsSkipped: true,
        creatorsSkipped: true,
        durationMs: Date.now() - start,
      },
    };
  }

  // Create IngestionRun record
  const run = await prisma.ingestionRun.create({
    data: { source: "echotik", status: "RUNNING" },
  });

  const runLog = log.child({ runId: run.id });

  let categoriesSynced = 0;
  let videosSynced = 0;
  let productsSynced = 0;
  let creatorsSynced = 0;
  let productDetailsEnriched = 0;

  try {
    // 1. Categories (L1 daily, L2/L3 weekly)
    if (!skipCategories) {
      categoriesSynced = await syncAllCategories(run.id, runLog);
      await prisma.ingestionRun.create({
        data: {
          source: "echotik:categories",
          status: "SUCCESS",
          endedAt: new Date(),
        },
      });
    } else {
      runLog.info("Categories: skip (recently synced)");
    }

    // 2. Video ranklist
    if (!skipVideos) {
      videosSynced = await syncVideoRanklist(run.id, runLog);
      await prisma.ingestionRun.create({
        data: {
          source: "echotik:videos",
          status: "SUCCESS",
          endedAt: new Date(),
        },
      });
    } else {
      runLog.info("Videos: skip (recently synced)");
    }

    // 2b. Product detail enrichment (video + ranklist)
    try {
      const [videoDetails, ranklistDetails] = await Promise.all([
        syncVideoProductDetails(runLog),
        syncRanklistProductDetails(runLog),
      ]);
      productDetailsEnriched = videoDetails + ranklistDetails;
      runLog.info("Product details enriched", {
        total: productDetailsEnriched,
        video: videoDetails,
        ranklist: ranklistDetails,
      });
    } catch (err) {
      runLog.error("Product detail enrichment failed (non-fatal)", {
        error: (err as Error).message,
      });
    }

    // 3. Product ranklist
    if (!skipProducts) {
      productsSynced = await syncProductRanklist(run.id, runLog);
      await prisma.ingestionRun.create({
        data: {
          source: "echotik:products",
          status: "SUCCESS",
          endedAt: new Date(),
        },
      });
    } else {
      runLog.info("Products: skip (recently synced)");
    }

    // 4. Creator ranklist
    if (!skipCreators) {
      creatorsSynced = await syncCreatorRanklist(run.id, runLog);
      await prisma.ingestionRun.create({
        data: {
          source: "echotik:creators",
          status: "SUCCESS",
          endedAt: new Date(),
        },
      });
    } else {
      runLog.info("Creators: skip (recently synced)");
    }

    // Finalize
    const durationMs = Date.now() - start;
    const stats = {
      categoriesSynced,
      videosSynced,
      productsSynced,
      creatorsSynced,
      productDetailsEnriched,
      categoriesSkipped: skipCategories,
      videosSkipped: skipVideos,
      productsSkipped: skipProducts,
      creatorsSkipped: skipCreators,
      durationMs,
    };

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        endedAt: new Date(),
        statsJson: stats,
      },
    });

    runLog.info("Cron completed", {
      durationMs,
      categories: skipCategories ? "skip" : categoriesSynced,
      videos: skipVideos ? "skip" : videosSynced,
      products: skipProducts ? "skip" : productsSynced,
      creators: skipCreators ? "skip" : creatorsSynced,
      details: productDetailsEnriched,
    });

    return { runId: run.id, status: "SUCCESS", stats };
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const stats = {
      categoriesSynced,
      videosSynced,
      productsSynced,
      creatorsSynced,
      productDetailsEnriched,
      categoriesSkipped: skipCategories,
      videosSkipped: skipVideos,
      productsSkipped: skipProducts,
      creatorsSkipped: skipCreators,
      durationMs,
    };

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
        statsJson: stats,
        errorMessage,
      },
    });

    runLog.error("Cron failed", { durationMs, error: errorMessage });

    return {
      runId: run.id,
      status: "FAILED",
      stats,
      error: errorMessage,
    };
  }
}
