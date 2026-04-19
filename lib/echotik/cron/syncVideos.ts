/**
 * lib/echotik/cron/syncVideos.ts — Video ranklist sync + product detail enrichment
 */

import { prisma } from "@/lib/prisma";
import { echotikRequest } from "@/lib/echotik/client";
import { VIDEO_RANK_FIELDS } from "@/lib/echotik/rankFields";
import type { Logger } from "@/lib/logger";
import type {
  EchotikApiResponse,
  EchotikVideoRankItem,
  EchotikProductDetailItem,
} from "./types";
import {
  VIDEO_RANKLIST_PAGES,
  PRODUCT_DETAIL_BATCH_SIZE,
  PRODUCT_DETAIL_MAX_AGE_DAYS,
} from "./types";
import {
  formatDate,
  getCandidateDates,
  extractCategoryId,
  saveRawResponse,
  getConfiguredRegions,
  upsertProductDetail,
  ECHOTIK_CURRENCY,
} from "./helpers";

// ---------------------------------------------------------------------------
// Sync video ranklist for a single region / cycle / field
// ---------------------------------------------------------------------------

export async function syncVideoRanklistForRegion(
  runId: string,
  region: string,
  rankingCycle: 1 | 2 | 3,
  rankField: number,
  log: Logger,
  maxPages = VIDEO_RANKLIST_PAGES,
): Promise<number> {
  const endpoint = "/api/v3/echotik/video/ranklist";
  const datesToTry = getCandidateDates(rankingCycle);

  let synced = 0;
  let effectiveDate: Date | null = null;

  // Discover which date has data
  for (const candidateDate of datesToTry) {
    const checkParams = {
      date: formatDate(candidateDate),
      region,
      video_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: 1,
      page_size: 1,
    };
    const check = await echotikRequest<
      EchotikApiResponse<EchotikVideoRankItem>
    >(endpoint, { params: checkParams });
    if (check.code === 0 && check.data && check.data.length > 0) {
      effectiveDate = candidateDate;
      log.debug("Video data found", {
        field: rankField,
        date: formatDate(candidateDate),
      });
      break;
    }
  }

  if (!effectiveDate) {
    log.warn("No video data available", { field: rankField, region });
    return 0;
  }

  const dateStr = formatDate(effectiveDate);
  const date = effectiveDate;

  for (let page = 1; page <= maxPages; page++) {
    const params = {
      date: dateStr,
      region,
      video_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: page,
      page_size: 10,
    };

    let body: EchotikApiResponse<EchotikVideoRankItem>;
    try {
      body = await echotikRequest<EchotikApiResponse<EchotikVideoRankItem>>(
        endpoint,
        { params },
      );
    } catch (err) {
      log.error("Video ranklist fetch failed", {
        page,
        error: (err as Error).message,
      });
      throw err;
    }

    if (body.code !== 0) {
      throw new Error(`Video API error: ${body.code} — ${body.message}`);
    }

    await saveRawResponse(endpoint, params, body, runId);

    const items = body.data ?? [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const videoExternalId = item.video_id;
      if (!videoExternalId) continue;

      const categoryId = extractCategoryId(item.product_category_list);
      const gmvCents = Math.round((item.total_video_sale_gmv_amt ?? 0) * 100);
      const rankPosition = (page - 1) * 10 + i + 1;

      await prisma.echotikVideoTrendDaily.upsert({
        where: {
          videoExternalId_date_country_rankingCycle_rankField: {
            videoExternalId,
            date,
            country: region,
            rankingCycle,
            rankField,
          },
        },
        create: {
          date,
          rankingCycle,
          rankField,
          rankPosition,
          videoExternalId,
          title: item.video_desc || null,
          authorName: item.nick_name || null,
          authorExternalId: item.user_id || null,
          views: BigInt(
            item.total_views_history_cnt ?? item.total_views_cnt ?? 0,
          ),
          likes: BigInt(item.total_digg_cnt ?? 0),
          comments: BigInt(item.total_comments_cnt ?? 0),
          favorites: BigInt(item.total_favorites_cnt ?? 0),
          shares: BigInt(item.total_shares_cnt ?? 0),
          saleCount: BigInt(item.total_video_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          currency: ECHOTIK_CURRENCY,
          country: item.region ?? region,
          categoryId,
          extra: item as any,
        },
        update: {
          rankPosition,
          title: item.video_desc || undefined,
          authorName: item.nick_name || undefined,
          authorExternalId: item.user_id || undefined,
          views: BigInt(
            item.total_views_history_cnt ?? item.total_views_cnt ?? 0,
          ),
          likes: BigInt(item.total_digg_cnt ?? 0),
          comments: BigInt(item.total_comments_cnt ?? 0),
          favorites: BigInt(item.total_favorites_cnt ?? 0),
          shares: BigInt(item.total_shares_cnt ?? 0),
          saleCount: BigInt(item.total_video_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          currency: ECHOTIK_CURRENCY,
          country: item.region ?? region,
          rankingCycle,
          categoryId: categoryId ?? undefined,
          extra: item as any,
          syncedAt: new Date(),
        },
      });
      synced++;
    }
  }

  log.info("Videos synced", {
    region,
    cycle: rankingCycle,
    field: rankField,
    synced,
  });
  return synced;
}

// ---------------------------------------------------------------------------
// Sync videos for a single region across all cycles / fields
// ---------------------------------------------------------------------------

export async function syncVideoRanklist(
  runId: string,
  region: string,
  log: Logger,
  maxPages = VIDEO_RANKLIST_PAGES,
  deadlineMs?: number,
): Promise<number> {
  log.info("Syncing videos", { region, maxPages });
  const runStart = new Date();
  const rankingCycles: Array<1 | 2 | 3> = [1, 2, 3];
  let total = 0;
  for (const rankingCycle of rankingCycles) {
    for (const { field } of VIDEO_RANK_FIELDS) {
      if (deadlineMs && Date.now() > deadlineMs - 30_000) {
        log.warn("Deadline approaching, stopping video sync early", {
          region,
          synced: total,
          remainingMs: deadlineMs - Date.now(),
        });
        return total;
      }
      const count = await syncVideoRanklistForRegion(
        runId,
        region,
        rankingCycle,
        field,
        log,
        maxPages,
      );
      total += count;
    }
  }

  // Prune rows from previous runs — keep only what was upserted in this run
  const pruned = await prisma.echotikVideoTrendDaily.deleteMany({
    where: { country: region, syncedAt: { lt: runStart } },
  });
  if (pruned.count > 0) {
    log.info("Pruned stale video rows", { region, pruned: pruned.count });
  }

  return total;
}

// ---------------------------------------------------------------------------
// Enrich videos with associated product details
// ---------------------------------------------------------------------------

export async function syncVideoProductDetails(
  log: Logger,
  batchSize: number = PRODUCT_DETAIL_BATCH_SIZE,
  maxAgeDays: number = PRODUCT_DETAIL_MAX_AGE_DAYS,
): Promise<number> {
  // 1. Collect unique product IDs from recent videos
  const recentVideos = await prisma.echotikVideoTrendDaily.findMany({
    where: {
      syncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { extra: true },
  });

  const allProductIds = new Set<string>();
  for (const video of recentVideos) {
    const extra = video.extra as Record<string, unknown> | null;
    if (!extra?.video_products) continue;
    const raw = String(extra.video_products);
    const matches = raw.match(/\d{10,}/g);
    if (matches) {
      for (const pid of matches) {
        allProductIds.add(pid);
      }
    }
  }

  if (allProductIds.size === 0) {
    log.debug("No product IDs found in recent videos");
    return 0;
  }

  log.info("Video product IDs collected", { count: allProductIds.size });

  // 2. Filter already-cached recent entries
  const freshCutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  const existingProducts = await prisma.echotikProductDetail.findMany({
    where: {
      productExternalId: { in: Array.from(allProductIds) },
      fetchedAt: { gte: freshCutoff },
    },
    select: { productExternalId: true },
  });

  const cachedIds = new Set(existingProducts.map((p) => p.productExternalId));
  const missingIds = Array.from(allProductIds).filter(
    (id) => !cachedIds.has(id),
  );

  if (missingIds.length === 0) {
    log.debug("All video products already cached");
    return 0;
  }

  log.info("Fetching video product details", {
    missing: missingIds.length,
    cached: cachedIds.size,
  });

  // 3. Fetch in batches
  let enriched = 0;
  const failedIds: string[] = [];

  for (let i = 0; i < missingIds.length; i += batchSize) {
    const batch = missingIds.slice(i, i + batchSize);
    const idsParam = batch.join(",");

    try {
      const body = await echotikRequest<
        EchotikApiResponse<EchotikProductDetailItem>
      >("/api/v3/echotik/product/detail", {
        params: { product_ids: idsParam, language: "en-US" },
      });

      if (body.code !== 0 || !body.data) {
        failedIds.push(...batch);
        continue;
      }

      for (const item of body.data) {
        await upsertProductDetail(item);
        enriched++;
      }
    } catch (err) {
      log.error("Product detail batch failed", {
        batch: Math.floor(i / batchSize) + 1,
        error: (err as Error).message,
      });
      failedIds.push(...batch);
    }
  }

  // 4. Retry individually
  if (failedIds.length > 0) {
    log.info("Retrying failed product details individually", {
      count: failedIds.length,
    });
    let retried = 0;
    for (const pid of failedIds) {
      try {
        const body = await echotikRequest<
          EchotikApiResponse<EchotikProductDetailItem>
        >("/api/v3/echotik/product/detail", {
          params: { product_ids: pid, language: "en-US" },
        });

        if (body.code === 0 && body.data && body.data.length > 0) {
          await upsertProductDetail(body.data[0]);
          enriched++;
          retried++;
        }
      } catch {
        // Invalid ID — skip
      }

      if (retried >= 50) {
        log.warn("Retry limit reached (50)");
        break;
      }
    }
    log.info("Individual retries done", { recovered: retried });
  }

  log.info("Video product details cached", { enriched });
  return enriched;
}
