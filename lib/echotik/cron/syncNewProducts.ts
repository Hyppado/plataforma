/**
 * lib/echotik/cron/syncNewProducts.ts — "Novos Produtos" ingestion
 *
 * Calls the Echotik product/list endpoint filtered by first_crawl_dt (last 3
 * days) and upserts the results into EchotikProductDetail so the
 * /api/trending/new-products route can serve them.
 *
 * Runs 1×/day per region. Safe to re-run (upsert on productExternalId).
 */

import { echotikRequest } from "@/lib/echotik/client";
import type { Logger } from "@/lib/logger";
import type { EchotikApiResponse, EchotikProductListItem } from "./types";
import {
  NEW_PRODUCTS_INTERVAL_HOURS,
  NEW_PRODUCTS_DAYS_BACK,
  NEW_PRODUCTS_MAX_PAGES,
} from "./types";
import {
  shouldSkip,
  getConfiguredRegions,
  upsertProductDetail,
} from "./helpers";
import { newProductDateWindow } from "@/lib/echotik/dates";

// ---------------------------------------------------------------------------
// Sync a single region
// ---------------------------------------------------------------------------

export async function syncNewProductsForRegion(
  region: string,
  log: Logger,
  maxPages = NEW_PRODUCTS_MAX_PAGES,
): Promise<number> {
  const endpoint = "/api/v3/echotik/product/list";
  const { min, max } = newProductDateWindow(NEW_PRODUCTS_DAYS_BACK);

  log.info(`Syncing new products`, { region, min, max });

  let synced = 0;

  for (let page = 1; page <= maxPages; page++) {
    const params = {
      region,
      min_first_crawl_dt: min,
      max_first_crawl_dt: max,
      page_num: page,
      page_size: 10,
      language: "en-US",
    };

    let body: EchotikApiResponse<EchotikProductListItem>;
    try {
      body = await echotikRequest<EchotikApiResponse<EchotikProductListItem>>(
        endpoint,
        { params },
      );
    } catch (err) {
      log.error("New products fetch failed", {
        region,
        page,
        error: (err as Error).message,
      });
      throw err;
    }

    if (body.code !== 0) {
      throw new Error(`product/list API error: ${body.code} — ${body.message}`);
    }

    const items = body.data ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      if (!item.product_id) continue;
      await upsertProductDetail(item);
      synced++;
    }

    log.debug(`New products page ${page}`, { region, count: items.length });

    // If fewer than page_size returned, we've reached the end
    if (items.length < 10) break;
  }

  log.info(`New products synced`, { region, synced });
  return synced;
}

// ---------------------------------------------------------------------------
// Main export — all configured regions
// ---------------------------------------------------------------------------

export async function syncNewProducts(
  log: Logger,
  force = false,
): Promise<number> {
  const skipKey = "echotik:new-products";
  if (!force && (await shouldSkip(skipKey, NEW_PRODUCTS_INTERVAL_HOURS))) {
    log.info("New products: skip (recently synced)");
    return -1; // sentinel: skipped
  }

  const regions = await getConfiguredRegions();
  let total = 0;

  for (const region of regions) {
    try {
      const count = await syncNewProductsForRegion(region, log);
      total += count;
    } catch (err) {
      log.error("New products region sync failed", {
        region,
        error: (err as Error).message,
      });
      // Continue with remaining regions
    }
  }

  return total;
}
