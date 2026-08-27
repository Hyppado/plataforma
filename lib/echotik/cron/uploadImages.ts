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
import { uploadImageToBlob, signEchotikCoverUrls } from "@/lib/storage/blob";
import {
  getDisplayableProductIds,
  getDisplayableCreatorIds,
} from "./scope";

/**
 * Assinatura de capas é feita em lote (10 por chamada, sem consumir cota).
 * Assinar uma a uma gerava ~10x mais chamadas à EchoTik — e volume de
 * chamada é o que dispara o risk control deles.
 */
const SIGN_CHUNK = 10;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}
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
  // Escopo = o que a tela alcança (região ativa + top 100), em TODOS os ciclos.
  //
  // Antes isto era "produtos na data mais recente". Como a data mais recente é
  // sempre a do ranking diário, os produtos exclusivos do semanal e do mensal
  // nunca entravam na fila e ficavam permanentemente sem capa — 347 dos 1000
  // do ranking semanal, medido em produção.
  const activeProductIds = await getDisplayableProductIds();

  if (activeProductIds.length === 0) {
    log.info("Nenhum produto exibível — pulando upload de capas");
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
  });
  let uploaded = 0;

  for (const grupo of chunk(products, SIGN_CHUNK)) {
    if (deadlineMs && Date.now() > deadlineMs) {
      log.info("Deadline approaching, stopping product image uploads", {
        uploaded,
        remaining: products.length - uploaded,
      });
      break;
    }

    // Uma única chamada assina as 10 capas do grupo
    const assinadas = await signEchotikCoverUrls(
      grupo.map((p) => p.coverUrl!).filter(Boolean),
    );

    for (const product of grupo) {
      const blobPath = `products/${product.productExternalId}.jpg`;
      const signed = assinadas.get(product.coverUrl!);
      const blobUrl = signed ? await uploadImageToBlob(signed, blobPath) : null;

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
  }

  log.info("Product images uploaded", { uploaded, total: products.length });
  return uploaded;
}

// ---------------------------------------------------------------------------
// Creator avatar images
// ---------------------------------------------------------------------------

/**
 * Sobe avatares dos criadores que a plataforma consegue exibir.
 *
 * Mesma correção de escopo aplicada aos produtos: filtrar pela data mais
 * recente descartava quem só aparece nos ciclos semanal e mensal.
 *
 * @returns Número de imagens subidas com sucesso
 */
async function uploadCreatorAvatars(
  log: Logger,
  deadlineMs?: number,
): Promise<number> {
  const activeCreatorIds = await getDisplayableCreatorIds();

  if (activeCreatorIds.length === 0) {
    log.info("Nenhum criador exibível — pulando upload de avatares");
    return 0;
  }

  const creators = await prisma.echotikCreatorTrendDaily.findMany({
    where: {
      userExternalId: { in: activeCreatorIds },
      avatar: { not: null },
      avatarBlobUrl: null,
    },
    select: { id: true, userExternalId: true, avatar: true },
    distinct: ["userExternalId"],
    take: BATCH_SIZE,
  });

  if (creators.length === 0) {
    log.info("No creator avatars to upload", {
      activeCreators: activeCreatorIds.length,
    });
    return 0;
  }

  log.info("Uploading creator avatars", {
    count: creators.length,
    activeCreators: activeCreatorIds.length,
  });
  let uploaded = 0;

  for (const grupo of chunk(creators, SIGN_CHUNK)) {
    if (deadlineMs && Date.now() > deadlineMs) {
      log.info("Deadline approaching, stopping creator avatar uploads", {
        uploaded,
        remaining: creators.length - uploaded,
      });
      break;
    }

    const assinadas = await signEchotikCoverUrls(
      grupo.map((c) => c.avatar!).filter(Boolean),
    );

    for (const creator of grupo) {
      const blobPath = `creators/${creator.userExternalId}.jpg`;
      const signed = assinadas.get(creator.avatar!);
      const blobUrl = signed ? await uploadImageToBlob(signed, blobPath) : null;

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
