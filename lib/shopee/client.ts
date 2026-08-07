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
 * Fração mínima do ranking atual que um novo conjunto precisa ter para
 * substituí-lo, QUANDO houve falha em alguma keyword.
 *
 * Cenário que isto evita: 15 das 20 keywords falham, a API devolve 8 produtos
 * e o ranking de 50 é substituído por 8. Os 8 são reais, mas a substituição
 * degrada o produto por causa de um problema transitório do fornecedor.
 */
const RANKING_SHRINK_GUARD_RATIO = 0.5;

/**
 * Sincroniza o ranking de produtos da Shopee.
 *
 * Fluxo 100% Shopee Affiliate API:
 * 1. Para cada keyword em RANKING_KEYWORDS, busca os mais vendidos (sortType: 2)
 * 2. Consolida resultados removendo duplicatas (por itemId)
 * 3. Ordena por quantidade de vendas (decrescente)
 * 4. Substitui o conteúdo de ShopeeProductTrend de forma ATÔMICA
 *
 * Não depende da EchoTik para esta funcionalidade.
 *
 * SEGURANÇA DOS DADOS
 * O ranking é reconstruído do zero a cada execução, então uma falha do
 * fornecedor pode destruir dados bons. Três proteções:
 *
 * 1. Nunca apagar sem ter o que colocar no lugar. Zero produtos => lança erro
 *    e o ranking atual permanece intacto.
 * 2. Troca atômica. deleteMany + createMany numa única transação — não existe
 *    janela em que o GET /api/shopee/ranking veja a tabela vazia ou parcial.
 * 3. Guarda de encolhimento. Se houve falha de keyword E o conjunto novo é
 *    muito menor que o atual, a substituição é abortada.
 *
 * Erros PROPAGAM (não retornam 0). Um retorno 0 marcaria o IngestionRun como
 * SUCCESS e iniciaria o cooldown de 24h — ou seja, uma indisponibilidade do
 * fornecedor bloquearia a retentativa por um dia inteiro.
 *
 * @throws Error se o fornecedor não devolveu dados utilizáveis
 * @returns Quantidade de produtos gravados
 */
export async function syncShopeeRankings(): Promise<number> {
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

  let keywordFailures = 0;

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
      keywordFailures++;
      log.warn(`Falha ao buscar keyword "${keyword}"`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Proteção 1: nunca apagar sem ter substituto ────────────────────────
  if (allProducts.length === 0) {
    // Preserva o ranking atual e falha a execução, para que o próximo cron
    // tente de novo em vez de entrar em cooldown de 24h.
    throw new Error(
      `Shopee Affiliate API não devolveu nenhum produto ` +
        `(${keywordFailures}/${RANKING_KEYWORDS.length} keywords falharam). ` +
        `Ranking atual preservado.`,
    );
  }

  // Ordena por vendas (decrescente) para que os mais vendidos fiquem no topo
  allProducts.sort((a, b) => b.saleCount - a.saleCount);

  // ── Proteção 3: guarda de encolhimento ─────────────────────────────────
  if (keywordFailures > 0) {
    const currentCount = await prisma.shopeeProductTrend.count();
    const minAcceptable = Math.floor(currentCount * RANKING_SHRINK_GUARD_RATIO);

    if (currentCount > 0 && allProducts.length < minAcceptable) {
      throw new Error(
        `Ranking novo muito menor que o atual ` +
          `(${allProducts.length} < ${minAcceptable}, atual ${currentCount}) ` +
          `com ${keywordFailures} keywords falhando. ` +
          `Substituição abortada para não degradar o ranking.`,
      );
    }
  }

  // ── Proteção 2: troca atômica ──────────────────────────────────────────
  // deleteMany + createMany na MESMA transação. createMany é uma única
  // instrução — substitui o laço de N upserts (que, após o deleteMany, nunca
  // encontravam linha para atualizar de qualquer forma).
  const date = new Date();
  const syncedAt = new Date();

  const rows = allProducts.map((item, index) => ({
    productExternalId: item.product_id,
    date,
    rankPosition: index + 1,
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
    syncedAt,
  }));

  const [, created] = await prisma.$transaction([
    prisma.shopeeProductTrend.deleteMany({}),
    prisma.shopeeProductTrend.createMany({ data: rows, skipDuplicates: true }),
  ]);

  log.info(
    `Ranking Shopee sincronizado: ${created.count} produtos` +
      (keywordFailures > 0 ? ` (${keywordFailures} keywords falharam)` : ""),
  );

  return created.count;
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
  const [primeira] = await getAchadinhosHashtagIds();
  return primeira;
}

/**
 * Retorna TODAS as hashtags configuradas para os achadinhos.
 *
 * Uma hashtag só tem tantos vídeos recentes e transcritíveis; medido em
 * produção, #achadinhosshopee rende ~30 vídeos únicos acima dos filtros e
 * esgota. Minerar várias hashtags é o que aumenta a oferta de verdade.
 *
 * Formato da setting: IDs separados por vírgula ("169...,170..."). Um único
 * ID (formato antigo) continua funcionando.
 *
 * Ordem de prioridade: env → setting → fallback padrão.
 */
export async function getAchadinhosHashtagIds(): Promise<string[]> {
  const parse = (raw: string | null | undefined): string[] =>
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "0");

  const doEnv = parse(process.env.SHOPEE_HASHTAG_ID);
  if (doEnv.length > 0) return doEnv;

  const daSetting = parse(await getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_HASHTAG_ID));
  if (daSetting.length > 0) return daSetting;

  return [SHOPEE_DEFAULTS.ACHADINHOS_HASHTAG_ID];
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
