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
import {
  getActiveRegionCodes,
  getDisplayableProductIds,
  getDisplayableCreatorIds,
  getDisplayableVideoIds,
  getRetainableProductIds,
} from "./scope";
import { getEchotikConfig } from "./config";
import { newProductDateWindow } from "@/lib/echotik/dates";
import type { Logger } from "@/lib/logger";

const DB_BATCH_SIZE = 200;

// ---------------------------------------------------------------------------
// Ranking de região desativada
// ---------------------------------------------------------------------------

/**
 * Apaga linhas de ranking de regiões que não estão mais habilitadas.
 *
 * A poda normal roda dentro do sync, por região — então região que deixou de
 * ser sincronizada nunca é podada por ninguém. Em produção sobraram 2904
 * linhas de MX, GB e JP paradas desde março, que continuavam contando como
 * "ativas" para os outros jobs e ainda apareciam no seletor de país da
 * interface (getAvailableRegions lê os países distintos desta tabela).
 */
async function pruneInactiveRegions(log: Logger): Promise<number> {
  const active = await getActiveRegionCodes();
  if (active.length === 0) {
    log.warn("Nenhuma região ativa configurada — pulando poda por região");
    return 0;
  }

  const [produtos, videos, criadores] = await Promise.all([
    prisma.echotikProductTrendDaily.deleteMany({
      where: { country: { notIn: active } },
    }),
    prisma.echotikVideoTrendDaily.deleteMany({
      where: { country: { notIn: active } },
    }),
    prisma.echotikCreatorTrendDaily.deleteMany({
      where: { country: { notIn: active } },
    }),
  ]);

  const total = produtos.count + videos.count + criadores.count;
  if (total > 0) {
    log.info("Ranking de regiões desativadas removido", {
      produtos: produtos.count,
      videos: videos.count,
      criadores: criadores.count,
      regioesAtivas: active,
    });
  }
  return total;
}

// ---------------------------------------------------------------------------
// Product detail cleanup
// ---------------------------------------------------------------------------

async function cleanupOrphanedProductDetails(
  log: Logger,
  activeIds: Set<string>,
): Promise<{ dbDeleted: number; blobsDeleted: number }> {
  // Escopo vazio = não sei o que está ativo. Tratar isso como "tudo é órfão"
  // apagaria a base inteira durante um sync incompleto.
  if (activeIds.size === 0) {
    log.warn("Nenhum produto a preservar — pulando limpeza de detalhes");
    return { dbDeleted: 0, blobsDeleted: 0 };
  }

  const orphans = await prisma.echotikProductDetail.findMany({
    where: { productExternalId: { notIn: Array.from(activeIds) } },
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
// Product cover blob cleanup (varredura por prefixo)
// ---------------------------------------------------------------------------

/**
 * Varre o prefixo products/ e apaga as capas que não pertencem a nenhum
 * produto ativo no ranking.
 *
 * POR QUE ISTO EXISTE, se cleanupOrphanedProductDetails já apaga blobs
 * A função acima parte da LINHA DO BANCO: acha o detalhe órfão e apaga o
 * `blobUrl` dela. Só que um arquivo cuja linha já sumiu — ou cuja linha tem
 * blobUrl null — fica inalcançável por esse caminho e nunca mais é apagado.
 *
 * Medido em produção antes desta correção: 1167 arquivos em products/, dos
 * quais apenas 15 eram referenciados pelo banco. 99 MB invisíveis à limpeza,
 * acumulando desde abril. O prefixo creators/, que sempre usou varredura,
 * estava com zero órfãos no mesmo momento — a assimetria era a causa.
 *
 * A varredura é a fonte de verdade: o que deve ser preservado fica, o resto vai.
 *
 * Recebe o conjunto pronto para usar exatamente o mesmo critério da limpeza de
 * linhas — se as duas divergirem, uma volta a apagar o que a outra preserva.
 */
async function cleanupOrphanedProductBlobs(
  log: Logger,
  activeIds: Set<string>,
): Promise<number> {
  // Sem escopo carregado não dá para saber o que é órfão — abortar é mais
  // seguro do que interpretar "nada ativo" como "apagar tudo".
  if (activeIds.size === 0) {
    log.warn("Escopo de produtos vazio — pulando varredura de capas");
    return 0;
  }

  let allProductBlobs: { url: string; pathname: string }[];
  try {
    allProductBlobs = await listBlobsByPrefix("products/");
  } catch (err) {
    log.warn("Falha ao listar capas — pulando varredura", {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }

  if (allProductBlobs.length === 0) return 0;

  // pathname é "products/{productExternalId}.jpg".
  // O filtro por prefixo é reafirmado aqui: apagar é irreversível, e um dia em
  // que a listagem devolva algo de outro prefixo não pode virar exclusão em
  // massa de arquivos que esta função nem deveria enxergar.
  const orphanUrls = allProductBlobs
    .filter((blob) => {
      if (!blob.pathname.startsWith("products/")) return false;
      const productId = blob.pathname
        .replace("products/", "")
        .replace(/\.jpg$/i, "");
      return !activeIds.has(productId);
    })
    .map((blob) => blob.url);

  if (orphanUrls.length === 0) {
    log.info("Nenhuma capa órfã", {
      totalBlobs: allProductBlobs.length,
      activeProducts: activeIds.size,
    });
    return 0;
  }

  let deleted = 0;
  try {
    deleted = await deleteBlobs(orphanUrls);
  } catch (err) {
    log.warn("Falha ao apagar capas órfãs", {
      error: err instanceof Error ? err.message : String(err),
      orphanCount: orphanUrls.length,
    });
    return 0;
  }

  // Uma linha pode apontar para um arquivo recém-apagado; zerar o blobUrl
  // devolve o produto à fila de upload em vez de deixá-lo com link quebrado.
  await prisma.echotikProductDetail.updateMany({
    where: { blobUrl: { in: orphanUrls } },
    data: { blobUrl: null },
  });

  log.info("Capas órfãs apagadas", {
    deleted,
    totalBlobs: allProductBlobs.length,
    activeProducts: activeIds.size,
  });
  return deleted;
}

// ---------------------------------------------------------------------------
// Capas de vídeo (varredura por prefixo)
// ---------------------------------------------------------------------------

/** Apaga capas de vídeo que não pertencem a nenhum vídeo exibível. */
async function cleanupOrphanedVideoBlobs(log: Logger): Promise<number> {
  const activeIds = new Set(await getDisplayableVideoIds());

  if (activeIds.size === 0) {
    log.warn("Nenhum vídeo exibível — pulando varredura de capas de vídeo");
    return 0;
  }

  let blobs: { url: string; pathname: string }[];
  try {
    blobs = await listBlobsByPrefix("videos/");
  } catch (err) {
    log.warn("Falha ao listar capas de vídeo — pulando varredura", {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }

  const orphanUrls = blobs
    .filter((b) => {
      if (!b.pathname.startsWith("videos/")) return false;
      const id = b.pathname.replace("videos/", "").replace(/\.jpg$/i, "");
      return !activeIds.has(id);
    })
    .map((b) => b.url);

  if (orphanUrls.length === 0) {
    log.info("Nenhuma capa de vídeo órfã", {
      totalBlobs: blobs.length,
      activeVideos: activeIds.size,
    });
    return 0;
  }

  let deleted = 0;
  try {
    deleted = await deleteBlobs(orphanUrls);
  } catch (err) {
    log.warn("Falha ao apagar capas de vídeo órfãs", {
      error: err instanceof Error ? err.message : String(err),
      orphanCount: orphanUrls.length,
    });
    return 0;
  }

  await prisma.echotikVideoTrendDaily.updateMany({
    where: { coverBlobUrl: { in: orphanUrls } },
    data: { coverBlobUrl: null },
  });

  log.info("Capas de vídeo órfãs apagadas", {
    deleted,
    totalBlobs: blobs.length,
    activeVideos: activeIds.size,
  });
  return deleted;
}

// ---------------------------------------------------------------------------
// Creator avatar blob cleanup
// ---------------------------------------------------------------------------

async function cleanupOrphanedCreatorBlobs(log: Logger): Promise<number> {
  const activeIds = new Set(await getDisplayableCreatorIds());

  if (activeIds.size === 0) {
    log.warn("Nenhum criador exibível — pulando varredura de avatares");
    return 0;
  }

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

  // Simetria com produtos e vídeos: linha que aponta para arquivo recém-apagado
  // volta para a fila de upload em vez de ficar com link quebrado.
  await prisma.echotikCreatorTrendDaily.updateMany({
    where: { avatarBlobUrl: { in: orphanUrls } },
    data: { avatarBlobUrl: null },
  });

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
  videoBlobsDeleted: number;
  inactiveRegionRowsDeleted: number;
}

/**
 * Main entrypoint for the cleanup-orphans cron task.
 * Removes product detail records and blob files that are no longer referenced
 * by any active ranking row.
 */
export async function cleanupOrphanedBlobs(
  log: Logger,
): Promise<CleanupOrphansResult> {
  // Primeiro tira do ranking o que não é mais elegível, para que as etapas
  // seguintes já enxerguem o escopo correto do que é "ativo".
  const inactiveRegionRowsDeleted = await pruneInactiveRegions(log);

  // UM único conjunto de "o que preservar", compartilhado por todas as etapas.
  // Enquanto cada etapa calculava o seu, elas divergiam e uma apagava o que a
  // outra mantinha — foi o que estragou o vínculo entre capa e produto.
  const config = await getEchotikConfig();
  const { min } = newProductDateWindow(config.newProducts.daysBack);
  const preservar = new Set<string>(
    await getRetainableProductIds(parseInt(min, 10)),
  );

  const products = await cleanupOrphanedProductDetails(log, preservar);
  // Roda DEPOIS da limpeza por linha: aquela apaga os arquivos que ainda têm
  // dono no banco, esta varre o que sobrou sem referência nenhuma.
  const sweptProductBlobs = await cleanupOrphanedProductBlobs(log, preservar);
  const videoBlobsDeleted = await cleanupOrphanedVideoBlobs(log);
  const creatorBlobsDeleted = await cleanupOrphanedCreatorBlobs(log);

  return {
    productDetailsDeleted: products.dbDeleted,
    productBlobsDeleted: products.blobsDeleted + sweptProductBlobs,
    creatorBlobsDeleted,
    videoBlobsDeleted,
    inactiveRegionRowsDeleted,
  };
}
