/**
 * lib/echotik/cron/syncNewProducts.ts — "Novos Produtos" ingestion
 *
 * Calls the Echotik product/list endpoint filtered by first_crawl_dt (last N
 * days), upserts the results into EchotikProductDetail, then purges rows
 * outside the current window so the table always contains only the latest
 * batch of new products.
 *
 * The API route (/api/trending/new-products) just returns everything in the
 * table for a given region — no date filtering at query time.
 *
 * Runs 1×/day per region. Safe to re-run (upsert on productExternalId).
 */

import { echotikRequest } from "@/lib/echotik/client";
import type { Logger } from "@/lib/logger";
import type { EchotikApiResponse, EchotikProductListItem } from "./types";
import { NEW_PRODUCTS_MAX_PAGES } from "./types";
import {
  shouldSkip,
  getConfiguredRegions,
  upsertProductDetail,
} from "./helpers";
import { newProductDateWindow } from "@/lib/echotik/dates";
import { getDisplayableProductIds } from "./scope";
import { prisma } from "@/lib/prisma";
import { getEchotikConfig } from "./config";

// ---------------------------------------------------------------------------
// Sync a single region
// ---------------------------------------------------------------------------

export async function syncNewProductsForRegion(
  region: string,
  log: Logger,
  daysBack: number,
  maxPages = NEW_PRODUCTS_MAX_PAGES,
): Promise<number> {
  const endpoint = "/api/v3/echotik/product/list";
  const { min, max } = newProductDateWindow(daysBack);

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

  // Purga o que saiu da janela de "novos" — MAS preserva quem o ranking ainda
  // exibe. Sem essa ressalva, esta limpeza derrubava a linha de detalhe de
  // produtos ranqueados (que quase sempre têm firstCrawlDt antigo) e, com ela,
  // o vínculo com a capa já enviada ao Blob. O arquivo continuava lá, sem
  // nenhuma linha apontando para ele: foi assim que 1152 capas viraram lixo
  // inalcançável, e por que só 15 produtos ainda tinham blobUrl.
  const { min: minDt } = newProductDateWindow(daysBack);
  const minDtInt = parseInt(minDt, 10);
  const exibiveis = await getDisplayableProductIds();
  const deleted = await prisma.echotikProductDetail.deleteMany({
    where: {
      region,
      firstCrawlDt: { lt: minDtInt },
      ...(exibiveis.length > 0
        ? { productExternalId: { notIn: exibiveis } }
        : {}),
    },
  });
  if (deleted.count > 0) {
    log.info(`Purged stale new products`, { region, deleted: deleted.count });
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
  const config = await getEchotikConfig();
  const intervalHours = config.newProducts.intervalHours;
  const daysBack = config.newProducts.daysBack;

  const skipKey = "echotik:new-products";
  if (!force && (await shouldSkip(skipKey, intervalHours))) {
    log.info("New products: skip (recently synced)");
    return -1; // sentinel: skipped
  }

  const regions = await getConfiguredRegions();
  let total = 0;

  for (const region of regions) {
    try {
      const count = await syncNewProductsForRegion(region, log, daysBack);
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
