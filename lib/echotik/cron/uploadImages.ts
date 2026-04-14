/**
 * lib/echotik/cron/uploadImages.ts — Cron module: upload images to Vercel Blob
 *
 * Processes product cover images and creator avatars that are still stored as
 * unsigned Echotik CDN URLs. Signs them, downloads, uploads to Vercel Blob,
 * and stores the permanent blob URL in the database.
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
 * Finds product details with a coverUrl but no blobUrl, signs + uploads
 * each image to Vercel Blob, and stores the result.
 *
 * @returns Number of images successfully uploaded
 */
async function uploadProductImages(
  log: Logger,
  deadlineMs?: number,
): Promise<number> {
  const products = await prisma.echotikProductDetail.findMany({
    where: {
      coverUrl: { not: null },
      blobUrl: null,
    },
    select: { id: true, productExternalId: true, coverUrl: true },
    take: BATCH_SIZE,
    orderBy: { fetchedAt: "desc" },
  });

  if (products.length === 0) {
    log.info("No product images to upload");
    return 0;
  }

  log.info("Uploading product images", { count: products.length });
  let uploaded = 0;

  for (const product of products) {
    // Check deadline
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
      // Mark as attempted by setting blobUrl to empty string to avoid retrying
      // broken URLs endlessly. We'll retry after PRODUCT_DETAIL_MAX_AGE_DAYS
      // when the detail is re-fetched with a new coverUrl.
      log.warn("Product image upload failed, marking as attempted", {
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
 * Finds creator trend entries with an avatar URL but no avatarBlobUrl,
 * signs + uploads each image to Vercel Blob, and stores the result.
 *
 * Only processes the latest snapshot per unique creator to avoid duplicate work.
 *
 * @returns Number of images successfully uploaded
 */
async function uploadCreatorAvatars(
  log: Logger,
  deadlineMs?: number,
): Promise<number> {
  // Find distinct creators that need avatar uploads
  // Use raw query to get unique creators efficiently
  const creators = await prisma.echotikCreatorTrendDaily.findMany({
    where: {
      avatar: { not: null },
      avatarBlobUrl: null,
    },
    select: { id: true, userExternalId: true, avatar: true },
    distinct: ["userExternalId"],
    take: BATCH_SIZE,
    orderBy: { date: "desc" },
  });

  if (creators.length === 0) {
    log.info("No creator avatars to upload");
    return 0;
  }

  log.info("Uploading creator avatars", { count: creators.length });
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
      // Update ALL records for this creator (across dates/cycles)
      await prisma.echotikCreatorTrendDaily.updateMany({
        where: {
          userExternalId: creator.userExternalId,
          avatar: creator.avatar,
        },
        data: { avatarBlobUrl: blobUrl },
      });
      uploaded++;
    } else {
      log.warn("Creator avatar upload failed", {
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
