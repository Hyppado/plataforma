/**
 * lib/echotik/cron/syncCategories.ts — Category sync (L1/L2/L3)
 */

import { prisma } from "@/lib/prisma";
import { echotikRequest } from "@/lib/echotik/client";
import type { Logger } from "@/lib/logger";
import type { EchotikApiResponse, EchotikCategoryItem } from "./types";
import { CATEGORIES_L2L3_INTERVAL_HOURS } from "./types";
import { saveRawResponse, shouldSkip } from "./helpers";
import { translateCategories } from "./translateCategories";

// ---------------------------------------------------------------------------
// Sync a single category level
// ---------------------------------------------------------------------------

export async function syncCategoriesForLevel(
  level: 1 | 2 | 3,
  runId: string,
  log: Logger,
): Promise<number> {
  const endpoint = `/api/v3/echotik/category/l${level}`;
  const params = { language: "en-US" };

  let body: EchotikApiResponse<EchotikCategoryItem>;
  try {
    body = await echotikRequest<EchotikApiResponse<EchotikCategoryItem>>(
      endpoint,
      { params },
    );
  } catch (err) {
    log.error(`Failed to fetch L${level} categories`, {
      error: (err as Error).message,
    });
    throw err;
  }

  if (body.code !== 0) {
    throw new Error(
      `API returned error for L${level}: ${body.code} — ${body.message}`,
    );
  }

  await saveRawResponse(endpoint, params, body, runId);

  const items = body.data ?? [];
  let synced = 0;

  for (const item of items) {
    const externalId = item.category_id;
    if (!externalId) continue;

    const name = item.category_name ?? "Sem nome";
    const parentExternalId =
      item.parent_id && item.parent_id !== "0" ? item.parent_id : null;
    const lvl = parseInt(item.category_level, 10) || level;
    const language = item.language ?? "en-US";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    await prisma.echotikCategory.upsert({
      where: { externalId },
      create: {
        externalId,
        name,
        language,
        level: lvl,
        parentExternalId,
        slug,
        extra: item as any,
      },
      update: {
        name,
        language,
        level: lvl,
        parentExternalId,
        slug,
        extra: item as any,
        syncedAt: new Date(),
      },
    });
    synced++;
  }

  log.info(`L${level} categories synced`, { synced });
  return synced;
}

// ---------------------------------------------------------------------------
// Sync all categories (L1 daily, L2/L3 weekly)
// ---------------------------------------------------------------------------

export async function syncAllCategories(
  runId: string,
  log: Logger,
): Promise<number> {
  const skipL2L3 = await shouldSkip(
    "echotik:categories:l2l3",
    CATEGORIES_L2L3_INTERVAL_HOURS,
  );

  // Record start time before any upserts — used for pruning stale rows
  const syncStart = new Date();

  const l1 = await syncCategoriesForLevel(1, runId, log);

  let l2 = 0;
  let l3 = 0;
  if (!skipL2L3) {
    l2 = await syncCategoriesForLevel(2, runId, log);
    l3 = await syncCategoriesForLevel(3, runId, log);
    await prisma.ingestionRun.create({
      data: {
        source: "echotik:categories:l2l3",
        status: "SUCCESS",
        endedAt: new Date(),
      },
    });

    // Prune categories that were not touched in this full sync cycle
    // (only safe when all 3 levels ran — avoids deleting L2/L3 on daily-only runs)
    const pruned = await prisma.echotikCategory.deleteMany({
      where: { syncedAt: { lt: syncStart } },
    });
    if (pruned.count > 0) {
      log.info(`Pruned ${pruned.count} stale categories`, {
        count: pruned.count,
      });
    }
  } else {
    log.info("L2/L3 categories: skip (recently synced)");
  }

  // Translate newly added categories to Portuguese (skips already-translated rows)
  const translated = await translateCategories();
  if (translated > 0) {
    log.info(`Translated ${translated} category names to Portuguese`, {
      translated,
    });
  }

  return l1 + l2 + l3;
}
