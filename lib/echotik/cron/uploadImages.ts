/**
 * lib/echotik/cron/uploadImages.ts — Cron module: upload images to Vercel Blob
 *
 * Processes product cover images and creator avatars that are still stored as
 * unsigned Echotik CDN URLs. Signs them, downloads, uploads to Vercel Blob,
 * and stores the permanent blob URL in the database.
 *
 * Scope: only items present in the LATEST ranking cycle — not historical backlog.
 * Each cron run overrides/replaces the active ranking, so only current items matter.
 *
 * On failure: leave blobUrl/avatarBlobUrl as null so the next run retries.
 * Never mark failed uploads as "attempted" — just log and continue.
 *
 * Runs within the 60s Vercel function limit — processes a limited batch
 * per invocation with a deadline safety margin.
 */

import { prisma } from "@/lib/prisma";
import { uploadEchotikImageToBlob } from "@/lib/storage/blob";
import type { Logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max images to process per cron invocation (each takes ~1-3s) */
const BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Product cover images
// ---------------------------------------------------------------------------

/**
 * Uploads cover images only for products currently present in the latest
 * product ranking cycle. Historical products are ignored.
 *
 * @returns Number of images successfully uploaded
 */
async function uploadProductImages(
  log: Logger,
  deadlineMs?: number,
): Promise<number> {
  // Find the latest ranking date from EchotikProductTrendDaily
  const latestRank = await prisma.echotikProductTrendDaily.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!latestRank) {
    log.info("No product ranking data — skipping product image upload");
    return 0;
  }

  // Get distinct product IDs in the latest cycle
  const activeRankRows = await prisma.echotikProductTrendDaily.findMany({
    where: { date: latestRank.date },
    select: { productExternalId: true },
    distinct: ["productExternalId"],
  });
  const activeProductIds = activeRankRows.map((r) => r.productExternalId);

  if (activeProductIds.length === 0) {
    log.info("No active products in latest ranking cycle");
    return 0;
  }

  // Find product details for active products that still need a blob URL
  const products = await prisma.echotikProductDetail.findMany({
    where: {
      productExternalId: { in: activeProductIds },
      coverUrl: { not: null },
      blobUrl: null,
    },
    select: { id: true, productExternalId: true, coverUrl: true },
    take: BATCH_SIZE,
    orderBy: { fetchedAt: "desc" },
  });

  if (products.length === 0) {
    log.info("No product images to upload", {
      activeProducts: activeProductIds.length,
    });
    return 0;
  }

  log.info("Uploading product images", {
    count: products.length,
    activeProducts: activeProductIds.length,
    latestDate: latestRank.date,
  });
  let uploaded = 0;

  for (const product of products) {
    if (deadlineMs && Date.now() > deadlineMs) {
      log.info("Deadline approaching, stopping product image uploads", {
        uploaded,
        remaining: products.length - uploaded,
      });
      break;
    }

    const blobPath = `products/${product.productExternalId}.jpg`;
    const blobUrl = await uploadEchotikImageToBlob(product.coverUrl!, blobPath);

    if (blobUrl) {
      await prisma.echotikProductDetail.update({
        where: { id: product.id },
        data: { blobUrl },
      });
      uploaded++;
    } else {
      // Leave blobUrl as null — will retry on next cron run
      log.warn("Product image upload failed, will retry next run", {
        productExternalId: product.productExternalId,
      });
    }
  }

  log.info("Product images uploaded", { uploaded, total: products.length });
  return uploaded;
}

// ---------------------------------------------------------------------------
// Creator avatar images
// ---------------------------------------------------------------------------

/**
 * Uploads avatars only for creators present in the latest creator ranking
 * cycle. Historical creators from older dates are ignored.
 *
 * @returns Number of images successfully uploaded
 */
async function uploadCreatorAvatars(
  log: Logger,
  deadlineMs?: number,
): Promise<number> {
  // Find the latest ranking date from EchotikCreatorTrendDaily
  const latestRank = await prisma.echotikCreatorTrendDaily.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!latestRank) {
    log.info("No creator ranking data — skipping creator avatar upload");
    return 0;
  }

  // Find distinct creators in the latest cycle that still need avatars
  const creators = await prisma.echotikCreatorTrendDaily.findMany({
    where: {
      date: latestRank.date,
      avatar: { not: null },
      avatarBlobUrl: null,
    },
    select: { id: true, userExternalId: true, avatar: true },
    distinct: ["userExternalId"],
    take: BATCH_SIZE,
  });

  if (creators.length === 0) {
    log.info("No creator avatars to upload", { latestDate: latestRank.date });
    return 0;
  }

  log.info("Uploading creator avatars", {
    count: creators.length,
    latestDate: latestRank.date,
  });
  let uploaded = 0;

  for (const creator of creators) {
    if (deadlineMs && Date.now() > deadlineMs) {
      log.info("Deadline approaching, stopping creator avatar uploads", {
        uploaded,
        remaining: creators.length - uploaded,
      });
      break;
    }

    const blobPath = `creators/${creator.userExternalId}.jpg`;
    const blobUrl = await uploadEchotikImageToBlob(creator.avatar!, blobPath);

    if (blobUrl) {
      // Update ALL records for this creator (across dates/cycles) so older
      // snapshots also resolve to the blob URL
      await prisma.echotikCreatorTrendDaily.updateMany({
        where: {
          userExternalId: creator.userExternalId,
          avatar: creator.avatar,
        },
        data: { avatarBlobUrl: blobUrl },
      });
      uploaded++;
    } else {
      // Leave avatarBlobUrl as null — will retry on next cron run
      log.warn("Creator avatar upload failed, will retry next run", {
        userExternalId: creator.userExternalId,
      });
    }
  }

  log.info("Creator avatars uploaded", { uploaded, total: creators.length });
  return uploaded;
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export interface UploadImagesResult {
  productImagesUploaded: number;
  creatorAvatarsUploaded: number;
}

/**
 * Main entrypoint for the upload-images cron task.
 * Processes both product covers and creator avatars in a single invocation.
 */
export async function uploadPendingImages(
  log: Logger,
  deadlineMs?: number,
): Promise<UploadImagesResult> {
  const productImagesUploaded = await uploadProductImages(log, deadlineMs);
  const creatorAvatarsUploaded = await uploadCreatorAvatars(log, deadlineMs);

  return { productImagesUploaded, creatorAvatarsUploaded };
}
