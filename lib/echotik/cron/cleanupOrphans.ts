/**
 * lib/echotik/cron/cleanupOrphans.ts — Cron module: remove orphaned blobs and
 * product detail records that are no longer referenced by any active ranking row.
 *
 * After each sync cycle the trend tables are pruned to the current run only, but
 * two types of data accumulate indefinitely without explicit cleanup:
 *
 *   1. EchotikProductDetail rows (+ their Vercel Blob cover images) for products
 *      that have rotated out of all ranking tables.
 *
 *   2. Vercel Blob files under creators/ for creators that have rotated out of the
 *      EchotikCreatorTrendDaily table (their DB rows are pruned, but blobs remain).
 *
 * Strategy:
 *   - "Active" = currently present in the trend table (after the latest prune).
 *   - Anything not active is orphaned and safe to delete.
 *   - Product detail rows are only deleted when their blob (if any) has been removed.
 *
 * Safety:
 *   - Blob deletion uses batched del() calls — never blocks the Vercel function limit.
 *   - DB deletions are also batched.
 *   - If blob deletion throws, the error is logged and the DB row is preserved so
 *     the next run retries.
 */

import { prisma } from "@/lib/prisma";
import { deleteBlobs, listBlobsByPrefix } from "@/lib/storage/blob";
import type { Logger } from "@/lib/logger";

const DB_BATCH_SIZE = 200;

// ---------------------------------------------------------------------------
// Product detail cleanup
// ---------------------------------------------------------------------------

async function cleanupOrphanedProductDetails(
  log: Logger,
): Promise<{ dbDeleted: number; blobsDeleted: number }> {
  // Collect all product IDs that are currently in the trend table
  const activeRows = await prisma.echotikProductTrendDaily.findMany({
    select: { productExternalId: true },
    distinct: ["productExternalId"],
  });
  const activeIds = new Set(
    activeRows.map((r) => r.productExternalId).filter(Boolean),
  );

  // Find detail records that are no longer referenced by any current trend row
  const orphans = await prisma.echotikProductDetail.findMany({
    where:
      activeIds.size > 0
        ? { productExternalId: { notIn: Array.from(activeIds) } }
        : {}, // if trend table is empty, everything is orphaned
    select: { id: true, productExternalId: true, blobUrl: true },
  });

  if (orphans.length === 0) {
    log.info("No orphaned product details to clean up");
    return { dbDeleted: 0, blobsDeleted: 0 };
  }

  log.info("Cleaning up orphaned product details", {
    count: orphans.length,
    activeProducts: activeIds.size,
  });

  // Delete blobs first — if that fails we keep the DB row so next run retries
  const blobUrls = orphans
    .map((o) => o.blobUrl)
    .filter((u): u is string => !!u);
  let blobsDeleted = 0;
  if (blobUrls.length > 0) {
    try {
      blobsDeleted = await deleteBlobs(blobUrls);
    } catch (err) {
      log.warn(
        "Product blob deletion failed — skipping DB cleanup for safety",
        {
          error: err instanceof Error ? err.message : String(err),
          blobCount: blobUrls.length,
        },
      );
      return { dbDeleted: 0, blobsDeleted: 0 };
    }
  }

  // Delete DB rows in batches
  const ids = orphans.map((o) => o.id);
  let dbDeleted = 0;
  for (let i = 0; i < ids.length; i += DB_BATCH_SIZE) {
    const batch = ids.slice(i, i + DB_BATCH_SIZE);
    const result = await prisma.echotikProductDetail.deleteMany({
      where: { id: { in: batch } },
    });
    dbDeleted += result.count;
  }

  log.info("Orphaned product details cleaned", { dbDeleted, blobsDeleted });
  return { dbDeleted, blobsDeleted };
}

// ---------------------------------------------------------------------------
// Creator avatar blob cleanup
// ---------------------------------------------------------------------------

async function cleanupOrphanedCreatorBlobs(log: Logger): Promise<number> {
  // Collect all creator IDs that are currently in the trend table
  const activeRows = await prisma.echotikCreatorTrendDaily.findMany({
    select: { userExternalId: true },
    distinct: ["userExternalId"],
  });
  const activeIds = new Set(
    activeRows.map((r) => r.userExternalId).filter(Boolean),
  );

  // List all blobs stored under the creators/ prefix in Vercel Blob
  let allCreatorBlobs: { url: string; pathname: string }[];
  try {
    allCreatorBlobs = await listBlobsByPrefix("creators/");
  } catch (err) {
    log.warn("Failed to list creator blobs — skipping creator blob cleanup", {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }

  if (allCreatorBlobs.length === 0) {
    log.info("No creator blobs in storage");
    return 0;
  }

  // Identify orphaned blobs — pathname is "creators/{userExternalId}.jpg"
  const orphanUrls = allCreatorBlobs
    .filter((blob) => {
      const userId = blob.pathname
        .replace("creators/", "")
        .replace(/\.jpg$/i, "");
      return !activeIds.has(userId);
    })
    .map((blob) => blob.url);

  if (orphanUrls.length === 0) {
    log.info("No orphaned creator blobs to clean up", {
      totalBlobs: allCreatorBlobs.length,
      activeCreators: activeIds.size,
    });
    return 0;
  }

  let deleted = 0;
  try {
    deleted = await deleteBlobs(orphanUrls);
  } catch (err) {
    log.warn("Creator blob deletion failed", {
      error: err instanceof Error ? err.message : String(err),
      orphanCount: orphanUrls.length,
    });
    return 0;
  }

  log.info("Orphaned creator blobs cleaned", {
    deleted,
    totalBlobs: allCreatorBlobs.length,
    activeCreators: activeIds.size,
  });
  return deleted;
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export interface CleanupOrphansResult {
  productDetailsDeleted: number;
  productBlobsDeleted: number;
  creatorBlobsDeleted: number;
}

/**
 * Main entrypoint for the cleanup-orphans cron task.
 * Removes product detail records and blob files that are no longer referenced
 * by any active ranking row.
 */
export async function cleanupOrphanedBlobs(
  log: Logger,
): Promise<CleanupOrphansResult> {
  const products = await cleanupOrphanedProductDetails(log);
  const creatorBlobsDeleted = await cleanupOrphanedCreatorBlobs(log);

  return {
    productDetailsDeleted: products.dbDeleted,
    productBlobsDeleted: products.blobsDeleted,
    creatorBlobsDeleted,
  };
}
