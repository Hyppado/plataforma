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
  getRetainableProductIds,
  getDisplayableCreatorIds,
  getDisplayableVideoIds,
} from "./scope";
import { getEchotikConfig } from "./config";
import { newProductDateWindow } from "@/lib/echotik/dates";

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

/**
 * Máximo de imagens por invocação, POR ENTIDADE.
 *
 * Era 20, o que não acompanhava a rotatividade: 931 criadores exibíveis a 20
 * por execução, de 6 em 6 horas, levariam quase duas semanas para cobrir o
 * conjunto — e até lá o ranking já teria girado. O gargalo real não é este
 * número e sim o `deadlineMs`, que interrompe o lote antes do limite da função;
 * subir o teto deixa o job aproveitar o tempo que sobra em vez de parar cedo.
 */
const BATCH_SIZE = 60;

// ---------------------------------------------------------------------------
// Product cover images
// ---------------------------------------------------------------------------

/**
 * Sobe as capas dos produtos que alguma tela exibe.
 *
 * @returns Número de imagens subidas com sucesso
 */
async function uploadProductImages(
  log: Logger,
  deadlineMs?: number,
): Promise<number> {
  // MESMO escopo que a limpeza preserva: ranking exibível E janela de
  // "Novos Produtos".
  //
  // Usar só o ranking aqui criava um vão: a limpeza preservava a linha do
  // produto novo, mas nada subia a capa dele. Medido em produção — a primeira
  // página de Novos Produtos (BR) tinha 10 de 100 com imagem, e era a pior
  // justamente por ordenar do mais recente para o mais antigo, que são os que
  // o cron ainda não alcançou.
  //
  // A regra vale para os dois lados: o que é preservado precisa ser
  // ilustrado, senão sobra linha sem capa para sempre.
  const config = await getEchotikConfig();
  const { min } = newProductDateWindow(config.newProducts.daysBack);
  const activeProductIds = await getRetainableProductIds(parseInt(min, 10));

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
      // Sem assinatura, usa a URL crua: signEchotikCoverUrls só assina o CDN da
      // EchoTik, então capa vinda de CDN aberto (TikTok, Shopee) não aparece no
      // mapa — e pular nesse caso deixaria esses produtos sem capa para sempre.
      const origem = assinadas.get(product.coverUrl!) ?? product.coverUrl!;
      const blobUrl = await uploadImageToBlob(origem, blobPath);

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
      // Mesmo motivo dos produtos: avatar de CDN aberto não é assinado.
      const origem = assinadas.get(creator.avatar!) ?? creator.avatar!;
      const blobUrl = await uploadImageToBlob(origem, blobPath);

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
// Capas de vídeo
// ---------------------------------------------------------------------------

/**
 * Sobe as capas dos vídeos exibíveis.
 *
 * A capa vem do CDN da EchoTik, que responde 403 sem assinatura — e assinar
 * custa cota. Sem uma cópia permanente, "Vídeos em Alta" fica sem imagem
 * nenhuma. Mesmo tratamento já dado a produtos e criadores.
 *
 * O mesmo vídeo aparece em várias linhas (uma por ciclo/campo/data), então a
 * gravação é por videoExternalId, não por linha.
 */
async function uploadVideoCovers(
  log: Logger,
  deadlineMs?: number,
): Promise<number> {
  const activeVideoIds = await getDisplayableVideoIds();

  if (activeVideoIds.length === 0) {
    log.info("Nenhum vídeo exibível — pulando upload de capas");
    return 0;
  }

  const videos = await prisma.echotikVideoTrendDaily.findMany({
    where: {
      videoExternalId: { in: activeVideoIds },
      coverUrl: { not: null },
      coverBlobUrl: null,
    },
    select: { videoExternalId: true, coverUrl: true },
    distinct: ["videoExternalId"],
    take: BATCH_SIZE,
    orderBy: { syncedAt: "desc" },
  });

  if (videos.length === 0) {
    log.info("No video covers to upload", {
      activeVideos: activeVideoIds.length,
    });
    return 0;
  }

  log.info("Uploading video covers", {
    count: videos.length,
    activeVideos: activeVideoIds.length,
  });
  let uploaded = 0;

  for (const grupo of chunk(videos, SIGN_CHUNK)) {
    if (deadlineMs && Date.now() > deadlineMs) {
      log.info("Deadline approaching, stopping video cover uploads", {
        uploaded,
        remaining: videos.length - uploaded,
      });
      break;
    }

    // Só as do CDN da EchoTik precisam de assinatura; as do TikTok abrem direto.
    const assinadas = await signEchotikCoverUrls(
      grupo.map((v) => v.coverUrl!).filter(Boolean),
    );

    for (const video of grupo) {
      const origem = assinadas.get(video.coverUrl!) ?? video.coverUrl!;
      const blobUrl = await uploadImageToBlob(
        origem,
        `videos/${video.videoExternalId}.jpg`,
      );

      if (blobUrl) {
        // updateMany: o vídeo se repete em várias linhas de ranking.
        await prisma.echotikVideoTrendDaily.updateMany({
          where: { videoExternalId: video.videoExternalId },
          data: { coverBlobUrl: blobUrl },
        });
        uploaded++;
      } else {
        log.warn("Video cover upload failed, will retry next run", {
          videoExternalId: video.videoExternalId,
        });
      }
    }
  }

  log.info("Video covers uploaded", { uploaded, total: videos.length });
  return uploaded;
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export interface UploadImagesResult {
  productImagesUploaded: number;
  creatorAvatarsUploaded: number;
  videoCoversUploaded: number;
}

/**
 * Main entrypoint for the upload-images cron task.
 * Cobre as três entidades com imagem: produto, criador e vídeo.
 */
export async function uploadPendingImages(
  log: Logger,
  deadlineMs?: number,
): Promise<UploadImagesResult> {
  // ORÇAMENTO REPARTIDO, NÃO DISPUTADO
  //
  // As três etapas rodavam em sequência com o MESMO prazo. Produtos vinham
  // primeiro, consumiam quase todo o tempo e vídeos, últimos da fila, ficavam
  // com as sobras: 60 capas de produto por execução contra 8 a 21 de vídeo,
  // com 238 vídeos esperando. A ordem no código virava prioridade de fato, e
  // "Vídeos em Alta" ficava com card sem capa por horas.
  //
  // Cada etapa recebe agora a fatia do tempo que ainda resta dividida pelas
  // etapas que faltam. Quem termina cedo devolve o tempo não usado para as
  // seguintes, então repartir não desperdiça.
  const fatia = (etapasRestantes: number): number | undefined => {
    if (!deadlineMs) return undefined;
    const restante = deadlineMs - Date.now();
    if (restante <= 0) return deadlineMs;
    return Date.now() + Math.floor(restante / etapasRestantes);
  };

  const productImagesUploaded = await uploadProductImages(log, fatia(3));
  const creatorAvatarsUploaded = await uploadCreatorAvatars(log, fatia(2));
  const videoCoversUploaded = await uploadVideoCovers(log, fatia(1));

  return {
    productImagesUploaded,
    creatorAvatarsUploaded,
    videoCoversUploaded,
  };
}
