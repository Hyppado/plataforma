/**
 * lib/echotik/cron/syncProducts.ts — Product ranklist sync + detail enrichment
 */

import { prisma } from "@/lib/prisma";
import { echotikRequest } from "@/lib/echotik/client";
import { PRODUCT_RANK_FIELDS } from "@/lib/echotik/rankFields";
import type { Logger } from "@/lib/logger";
import type {
  EchotikApiResponse,
  EchotikProductRankItem,
  EchotikProductDetailItem,
} from "./types";
import {
  PRODUCT_RANKLIST_PAGES,
  PRODUCT_DETAIL_BATCH_SIZE,
  PRODUCT_DETAIL_MAX_AGE_DAYS,
} from "./types";
import {
  formatDate,
  getCandidateDates,
  saveRawResponse,
  getConfiguredRegions,
  upsertProductDetail,
  ECHOTIK_CURRENCY,
} from "./helpers";

// ---------------------------------------------------------------------------
// Sync product ranklist for a single region / cycle / field
// ---------------------------------------------------------------------------

export async function syncProductRanklistForRegion(
  runId: string,
  region: string,
  rankingCycle: 1 | 2 | 3,
  rankField: number,
  log: Logger,
  maxPages = PRODUCT_RANKLIST_PAGES,
): Promise<number> {
  const endpoint = "/api/v3/echotik/product/ranklist";
  const datesToTry = getCandidateDates(rankingCycle);

  let synced = 0;
  let effectiveDate: Date | null = null;

  for (const candidateDate of datesToTry) {
    const checkParams = {
      date: formatDate(candidateDate),
      region,
      product_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: 1,
      page_size: 1,
      language: "en-US",
    };
    const check = await echotikRequest<
      EchotikApiResponse<EchotikProductRankItem>
    >(endpoint, { params: checkParams });
    if (check.code === 0 && check.data && check.data.length > 0) {
      effectiveDate = candidateDate;
      log.debug("Product data found", {
        field: rankField,
        date: formatDate(candidateDate),
      });
      break;
    }
  }

  if (!effectiveDate) {
    log.warn("No product data available", { field: rankField, region });
    return 0;
  }

  const dateStr = formatDate(effectiveDate);
  const date = effectiveDate;

  for (let page = 1; page <= maxPages; page++) {
    const params = {
      date: dateStr,
      region,
      product_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: page,
      page_size: 10,
      language: "en-US",
    };

    let body: EchotikApiResponse<EchotikProductRankItem>;
    try {
      body = await echotikRequest<EchotikApiResponse<EchotikProductRankItem>>(
        endpoint,
        { params },
      );
    } catch (err) {
      log.error("Product ranklist fetch failed", {
        page,
        error: (err as Error).message,
      });
      throw err;
    }

    if (body.code !== 0) {
      throw new Error(`Product API error: ${body.code} — ${body.message}`);
    }

    await saveRawResponse(endpoint, params, body, runId);

    const items = body.data ?? [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productExternalId = item.product_id;
      if (!productExternalId) continue;

      const gmvCents = Math.round((item.total_sale_gmv_amt ?? 0) * 100);
      const rankPosition = (page - 1) * 10 + i + 1;

      await prisma.echotikProductTrendDaily.upsert({
        where: {
          productExternalId_date_country_rankingCycle_rankField: {
            productExternalId,
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
          productExternalId,
          productName: item.product_name || null,
          categoryId: item.category_id || null,
          categoryL2Id: item.category_l2_id || null,
          categoryL3Id: item.category_l3_id || null,
          minPrice: item.min_price ?? 0,
          maxPrice: item.max_price ?? 0,
          avgPrice: item.spu_avg_price ?? 0,
          commissionRate: item.product_commission_rate ?? 0,
          saleCount: BigInt(item.total_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          influencerCount: BigInt(item.total_ifl_cnt ?? 0),
          videoCount: BigInt(item.total_video_cnt ?? 0),
          liveCount: BigInt(item.total_live_cnt ?? 0),
          currency: ECHOTIK_CURRENCY,
          country: region,
          extra: item as any,
        },
        update: {
          rankPosition,
          productName: item.product_name || undefined,
          categoryId: item.category_id || undefined,
          categoryL2Id: item.category_l2_id || undefined,
          categoryL3Id: item.category_l3_id || undefined,
          minPrice: item.min_price ?? 0,
          maxPrice: item.max_price ?? 0,
          avgPrice: item.spu_avg_price ?? 0,
          commissionRate: item.product_commission_rate ?? 0,
          saleCount: BigInt(item.total_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          influencerCount: BigInt(item.total_ifl_cnt ?? 0),
          videoCount: BigInt(item.total_video_cnt ?? 0),
          liveCount: BigInt(item.total_live_cnt ?? 0),
          currency: ECHOTIK_CURRENCY,
          country: region,
          extra: item as any,
          syncedAt: new Date(),
        },
      });
      synced++;
    }
  }

  log.info("Products synced", {
    region,
    cycle: rankingCycle,
    field: rankField,
    synced,
  });
  return synced;
}

// ---------------------------------------------------------------------------
// Sync products for a single region across all cycles / fields
// ---------------------------------------------------------------------------

export async function syncProductRanklist(
  runId: string,
  region: string,
  log: Logger,
  maxPages = PRODUCT_RANKLIST_PAGES,
  deadlineMs?: number,
): Promise<number> {
  log.info("Syncing products", { region, maxPages });
  const runStart = new Date();
  const rankingCycles: Array<1 | 2 | 3> = [1, 2, 3];
  let total = 0;
  for (const rankingCycle of rankingCycles) {
    for (const { field } of PRODUCT_RANK_FIELDS) {
      if (deadlineMs && Date.now() > deadlineMs - 30_000) {
        log.warn("Deadline approaching, stopping product sync early", {
          region,
          synced: total,
          remainingMs: deadlineMs - Date.now(),
        });
        return total;
      }
      const count = await syncProductRanklistForRegion(
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
  const pruned = await prisma.echotikProductTrendDaily.deleteMany({
    where: { country: region, syncedAt: { lt: runStart } },
  });
  if (pruned.count > 0) {
    log.info("Pruned stale product rows", { region, pruned: pruned.count });
  }

  return total;
}

// ---------------------------------------------------------------------------
// Enrich ranklist products with detail cache
// ---------------------------------------------------------------------------

export async function syncRanklistProductDetails(
  log: Logger,
  batchSize: number = PRODUCT_DETAIL_BATCH_SIZE,
  maxAgeDays: number = PRODUCT_DETAIL_MAX_AGE_DAYS,
): Promise<number> {
  // 1. Collect product IDs from recent ranklist (last 3 days)
  const recentRanklist = await prisma.echotikProductTrendDaily.findMany({
    where: {
      syncedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    },
    select: { productExternalId: true },
    distinct: ["productExternalId"],
  });

  const allProductIds = new Set(
    recentRanklist
      .map((r) => r.productExternalId)
      .filter((id): id is string => !!id),
  );

  if (allProductIds.size === 0) {
    log.debug("No product IDs found in recent ranklist");
    return 0;
  }

  log.info("Ranklist product IDs collected", { count: allProductIds.size });

  // 2. Filter already cached
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
    log.debug("All ranklist products already cached");
    return 0;
  }

  log.info("Fetching ranklist product details", {
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
      log.error("Ranklist product detail batch failed", {
        batch: Math.floor(i / batchSize) + 1,
        error: (err as Error).message,
      });
      failedIds.push(...batch);
    }
  }

  // 4. Retry individually
  if (failedIds.length > 0) {
    log.info("Retrying failed ranklist product details", {
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
        log.warn("Ranklist retry limit reached (50)");
        break;
      }
    }
    log.info("Ranklist individual retries done", { recovered: retried });
  }

  log.info("Ranklist product details cached", { enriched });
  return enriched;
}
