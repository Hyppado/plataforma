/**
 * lib/shopee/client.ts
 *
 * Client e lógica de negócio da integração Shopee.
 * Replica a lógica do TikTok/EchoTik mas é dedicado à ingestão de dados da Shopee.
 *
 * O ranking de produtos é alimentado EXCLUSIVAMENTE pela Shopee Affiliate API,
 * utilizando keywords estratégicas + sortType: 2 (mais vendidos).
 * Não depende da EchoTik.
 *
 * Os "Achadinhos Shopee" usam:
 * 1. EchoTik Hashtag Video List → vídeos reais com #achadinhosshopee
 * 2. EchoTik Video Captions → transcrição pronta (sem Whisper, sem download)
 * 3. Shopee Affiliate GraphQL → productOfferV2 com imageUrl, priceMin/Max
 *
 * NUNCA gera dados mockados/simulados — se a API falhar, retorna vazio.
 */

import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { echotikRequest } from "@/lib/echotik/client";
import { createLogger } from "@/lib/logger";
import {
  type EchoTikVideoDTO,
  SHOPEE_DEFAULTS,
  RANKING_KEYWORDS,
} from "@/lib/shopee/types";
import { searchShopeeProductsGraphQL } from "@/lib/shopee/shopee-api-client";
import { mapShopeeCategories } from "@/lib/shopee/shopee-categories";

const log = createLogger("shopee/client");

/**
 * Retorna o limite configurado para o ranking Shopee.
 * Lê da tabela Setting ou usa o valor padrão (50).
 */
export async function getShopeeRankingLimit(): Promise<number> {
  const dbLimit = await getSetting(SETTING_KEYS.SHOPEE_RANKING_LIMIT);
  if (dbLimit) {
    const parsed = parseInt(dbLimit, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return SHOPEE_DEFAULTS.RANKING_LIMIT;
}

/**
 * Sincroniza o ranking de produtos da Shopee.
 *
 * Fluxo 100% Shopee Affiliate API:
 * 1. Para cada keyword em RANKING_KEYWORDS, busca os mais vendidos (sortType: 2)
 * 2. Consolida resultados removendo duplicatas (por offer_id)
 * 3. Ordena por quantidade de vendas (decrescente)
 * 4. Salva em ShopeeProductTrend
 *
 * Não depende da EchoTik para esta funcionalidade.
 * Se nenhum produto real for encontrado, salva 0 (sem dados simulados).
 */
export async function syncShopeeRankings(): Promise<number> {
  try {
    const limit = await getShopeeRankingLimit();
    log.info("Iniciando sincronização do ranking Shopee via API...", { limit });

    const seenIds = new Set<string>();
    const allProducts: Array<{
      product_id: string;
      product_name: string;
      price: number;
      commissionRate: number;
      saleCount: number;
      shopName: string;
      coverUrl: string;
      affiliateLink: string;
      categoryId: string | null;
      subCategoryId: string | null;
      categoryName: string | null;
      subCategoryName: string | null;
    }> = [];

    // Busca produtos para cada keyword usando a Shopee Affiliate API
    for (const keyword of RANKING_KEYWORDS) {
      // Se já atingiu o limite, para de buscar
      if (allProducts.length >= limit) break;

      try {
        const nodes = await searchShopeeProductsGraphQL(keyword, 2, 10);
        log.info(`Keyword "${keyword}": ${nodes.length} produtos encontrados`);

        for (const node of nodes) {
          if (seenIds.has(node.itemId)) continue;
          seenIds.add(node.itemId);

          // Mapeia IDs de categoria da Shopee (productCatIds) para nomes legíveis.
          // A API da Shopee retorna apenas IDs numéricos; usamos um mapa
          // determinístico baseado em IDs conhecidos + fallback da keyword.
          const { categoryId, subCategoryId, categoryName, subCategoryName } =
            mapShopeeCategories(node.productCatIds, keyword);

          allProducts.push({
            product_id: String(node.itemId),
            product_name: node.productName,
            price: parseFloat(node.priceMin || node.priceMax) || 0,
            commissionRate: parseFloat(node.commissionRate || "0"),
            saleCount: node.sales || 0,
            shopName: node.shopName || "Shopee",
            coverUrl: node.imageUrl,
            affiliateLink: node.offerLink || node.productLink || `https://shopee.com.br/product/${node.itemId}`,
            categoryId,
            subCategoryId,
            categoryName,
            subCategoryName,
          });

          if (allProducts.length >= limit) break;
        }
      } catch (err) {
        log.warn(`Falha ao buscar keyword "${keyword}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Ordena por vendas (decrescente) para que os mais vendidos fiquem no topo
    allProducts.sort((a, b) => b.saleCount - a.saleCount);

    // Se não conseguiu nenhum produto real, remove registros antigos e retorna 0
    if (allProducts.length === 0) {
      log.warn("Nenhum produto encontrado na Shopee API. Ranking ficará vazio.");
      await prisma.shopeeProductTrend.deleteMany({});
      return 0;
    }

    // Remove registros antigos e insere os novos
    await prisma.shopeeProductTrend.deleteMany({});
    log.info("Registros antigos do ranking removidos");

    const date = new Date();
    let synced = 0;

    for (let i = 0; i < allProducts.length; i++) {
      const item = allProducts[i];
      await prisma.shopeeProductTrend.upsert({
        where: { productExternalId: item.product_id },
        update: {
          date,
          rankPosition: i + 1,
          productName: item.product_name,
          price: item.price,
          commissionRate: item.commissionRate,
          saleCount: item.saleCount,
          shopName: item.shopName,
          coverUrl: item.coverUrl,
          affiliateLink: item.affiliateLink,
          categoryName: item.categoryName,
          subCategoryName: item.subCategoryName,
          categoryId: item.categoryId,
          subCategoryId: item.subCategoryId,
          syncedAt: new Date(),
        },
        create: {
          productExternalId: item.product_id,
          date,
          rankPosition: i + 1,
          productName: item.product_name,
          price: item.price,
          commissionRate: item.commissionRate,
          saleCount: item.saleCount,
          shopName: item.shopName,
          coverUrl: item.coverUrl,
          affiliateLink: item.affiliateLink,
          categoryName: item.categoryName,
          subCategoryName: item.subCategoryName,
          categoryId: item.categoryId,
          subCategoryId: item.subCategoryId,
        },
      });
      synced++;
    }

    log.info(`Ranking Shopee sincronizado: ${synced} produtos (${allProducts.length} únicos)`);
    return synced;
  } catch (error) {
    log.error("Falha ao sincronizar ranking Shopee", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

// ─── Tipos da resposta da EchoTik Hashtag Video List API ────────────────
// Documentação: https://open.echotik.live/api/v3/realtime/hashtag/video/list

interface EchoTikHashtagVideoResponse {
  code: number;
  message?: string;
  msg?: string;
  data?: {
    aweme_list?: Array<{
      aweme_id: string;
      desc?: string;
      author?: {
        nickname?: string;
        unique_id?: string;
      };
      video?: {
        cover?: { url_list?: string[] };
        play_addr?: { url_list?: string[] };
      };
      statistics?: { play_count?: number };
    }>;
    cursor?: number;
    has_more?: number;
  };
}

/**
 * Retorna o hashtag_id dos "Achadinhos Shopee".
 *
 * Ordem de prioridade:
 * 1. process.env.SHOPEE_HASHTAG_ID (sobrescreve em runtime)
 * 2. Setting no banco (SHOPEE_ACHADINHOS_HASHTAG_ID)
 * 3. Fallback: SHOPEE_DEFAULTS.ACHADINHOS_HASHTAG_ID (1696392324325382)
 */
export async function getAchadinhosHashtagId(): Promise<string> {
  const envHashtag = process.env.SHOPEE_HASHTAG_ID?.trim();

  if (envHashtag && envHashtag !== "0") {
    return envHashtag;
  }

  const dbHashtag = await getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_HASHTAG_ID);
  if (dbHashtag && dbHashtag.trim() && dbHashtag !== "0") {
    return dbHashtag.trim();
  }

  return SHOPEE_DEFAULTS.ACHADINHOS_HASHTAG_ID;
}

/**
 * Extrai o play_count do vídeo de forma extremamente segura.
 *
 * A resposta da EchoTik pode variar:
 * - `statistics.play_count` (caminho padrão)
 * - `play_count` no nível raiz (fallback)
 * - valores como String ("63") ou Number (63)
 * - `undefined` / `null` / string não numérica
 *
 * Sempre força a conversão para Number. Se o valor for inválido (NaN),
 * retorna 0 — o filtro de relevância no pipeline descartará o vídeo.
 */
export function parseViewsFromEchoTikItem(item: {
  statistics?: { play_count?: unknown };
  play_count?: unknown;
  views?: unknown;
}): number {
  // Caminhos possíveis do play_count na resposta da EchoTik
  const raw = item.statistics?.play_count ?? item.play_count ?? item.views ?? 0;
  const parsed = Number(raw);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Converte uma resposta de vídeo da EchoTik em EchoTikVideoDTO[].
 */
export function mapAwemeListToVideos(
  awemeList: Array<{
    aweme_id?: string;
    desc?: string;
    author?: { nickname?: string; unique_id?: string };
    video?: { cover?: { url_list?: string[] }; play_addr?: { url_list?: string[] } };
    statistics?: { play_count?: unknown };
    play_count?: unknown;
  }>,
): EchoTikVideoDTO[] {
  return awemeList
    .filter((item) => item.aweme_id)
    .map((item) => ({
      video_id: item.aweme_id!,
      video_desc: item.desc || "",
      cover_url: item.video?.cover?.url_list?.[0] || undefined,
      video_url: item.video?.play_addr?.url_list?.[0] || undefined,
      author_name: item.author?.unique_id || item.author?.nickname || undefined,
      views: parseViewsFromEchoTikItem(item),
    }));
}

/**
 * Busca vídeos no EchoTik para a hashtag de achadinhos.
 *
 * Fluxo direto:
 * 1. Obtém o hashtag_id (env → setting → fallback padrão)
 * 2. Chama o endpoint /api/v3/realtime/hashtag/video/list
 *    com region=BR (crucial para evitar vídeos EN/ES)
 *
 * Sem discovery, sem keyword search, sem cascata de fallbacks.
 * NUNCA gera vídeos fake.
 */
export async function buscarVideosAchadinhosShopee(): Promise<EchoTikVideoDTO[]> {
  try {
    const region = SHOPEE_DEFAULTS.ACHADINHOS_REGION;
    const hashtagId = await getAchadinhosHashtagId();

    log.info(
      `Buscando vídeos para hashtag #${hashtagId} (region: ${region})...`,
    );

    const response = await echotikRequest<EchoTikHashtagVideoResponse>(
      "/api/v3/realtime/hashtag/video/list",
      {
        params: { hashtag_id: hashtagId, region, offset: 0, count: 20 },
        retries: 5,
      },
    ).catch((err: Error) => {
      log.warn("EchoTik hashtag video list indisponível", { error: err.message });
      return { code: -1, data: { aweme_list: [] } };
    });

    const videos = mapAwemeListToVideos(response?.data?.aweme_list ?? []);

    if (videos.length === 0) {
      log.warn(`Nenhum vídeo retornado para a hashtag #${hashtagId}`);
    } else {
      log.info(`${videos.length} vídeos via hashtag #${hashtagId}`);
    }

    return videos;
  } catch (error) {
    log.error("Falha ao buscar vídeos achadinhos no EchoTik", { error });
    return [];
  }
}