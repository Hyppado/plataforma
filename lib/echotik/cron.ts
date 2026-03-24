/**
 * EchoTik Cron Service
 *
 * Orquestra a ingestão periódica de dados da API EchoTik (v3):
 *   1. Sincroniza categorias L1  (upsert por externalId)
 *   2. Sincroniza vídeo ranklist — top vídeos do dia (upsert por videoExternalId + date)
 *   3. Salva payloads brutos com dedup via SHA-256
 *   4. Registra cada execução em IngestionRun
 *
 * Endpoints reais (docs: opendocs.echotik.live):
 *   - Categorias L1: GET /api/v3/echotik/category/l1?language=en-US
 *   - Vídeo ranklist: GET /api/v3/echotik/video/ranklist?date&region&video_rank_field&rank_type&page_num&page_size
 *
 * Estratégia de budget (10 000 req/mês):
 *   - Categorias L1: 1×/dia   (~30 req/mês)  — mudam pouco
 *   - Vídeo ranklist: 1×/dia, 5 págs cada (~150 req/mês) — top 50 vídeos/dia
 *   - Total estimado: ~250 req/mês (sobra para futuros endpoints)
 *   - Cron roda 1×/dia (03:00 UTC); use ?force=true para disparar manualmente
 *
 * Chamado pelo route handler: app/api/cron/echotik/route.ts
 */

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { echotikRequest } from "@/lib/echotik/client";
import {
  VIDEO_RANK_FIELDS,
  PRODUCT_RANK_FIELDS,
  CREATOR_RANK_FIELDS,
} from "@/lib/echotik/rankFields";

// ---------------------------------------------------------------------------
// Intervalos de sincronização (em horas)
// ---------------------------------------------------------------------------

/** Intervalos de sincronização de categorias (em horas) */
const CATEGORIES_INTERVAL_HOURS = 24;

/** Categorias L2/L3 mudam pouco — sincronizar 1×/semana */
const CATEGORIES_L2L3_INTERVAL_HOURS = 168;

/** Vídeos trending → 1×/dia */
const VIDEO_TREND_INTERVAL_HOURS = 24;

/** Produtos trending → 1×/dia */
const PRODUCT_TREND_INTERVAL_HOURS = 24;

/** Creators/influencers trending → 1×/dia */
const CREATOR_TREND_INTERVAL_HOURS = 24;

/** Quantas páginas buscar do ranklist (page_size max = 10 por página) */
const VIDEO_RANKLIST_PAGES = 10; // 10 × 10 = top 100 vídeos
const PRODUCT_RANKLIST_PAGES = 10; // 10 × 10 = top 100 produtos
const CREATOR_RANKLIST_PAGES = 10; // 10 × 10 = top 100 creators

// ---------------------------------------------------------------------------
// Tipos de resposta da API EchoTik v3
// (Baseado na documentação oficial: opendocs.echotik.live)
// ---------------------------------------------------------------------------

/** Resposta genérica da API EchoTik v3 */
interface EchotikApiResponse<T> {
  code: number;
  message: string;
  data: T[];
  requestId: string;
}

/** Item de categoria L1/L2/L3 */
interface EchotikCategoryItem {
  category_id: string;
  category_level: string; // "1", "2", "3"
  category_name: string;
  language: string;
  parent_id: string; // "0" para L1
  [key: string]: unknown;
}

/** Item do vídeo ranklist */
interface EchotikVideoRankItem {
  video_id: string;
  video_desc: string;
  nick_name: string;
  unique_id: string;
  user_id: string;
  avatar: string;
  category: string;
  create_time: string;
  created_by_ai: string;
  duration: number;
  product_category_list: string; // JSON string: [{ category_name, category_id }]
  reflow_cover: string;
  region: string;
  sales_flag: number; // 0=não vende, 1=vídeo, 2=live
  total_comments_cnt: number;
  total_digg_cnt: number;
  total_favorites_cnt: number;
  total_shares_cnt: number;
  total_video_sale_cnt: number;
  total_video_sale_gmv_amt: number;
  total_views_cnt: number;
  video_products: string; // JSON string: [product_id, ...]
  [key: string]: unknown;
}

/** Item do product ranklist */
interface EchotikProductRankItem {
  product_id: string;
  product_name: string;
  category_id: string;
  category_l2_id: string;
  category_l3_id: string;
  min_price: number;
  max_price: number;
  spu_avg_price: number;
  product_commission_rate: number;
  total_sale_cnt: number;
  total_sale_gmv_amt: number;
  total_ifl_cnt: number;
  total_video_cnt: number;
  total_live_cnt: number;
  region: string;
  [key: string]: unknown;
}

/** Item do influencer ranklist */
interface EchotikInfluencerRankItem {
  user_id: string;
  unique_id: string;
  nick_name: string;
  avatar: string;
  category: string;
  ec_score: number;
  total_followers_cnt: number;
  total_followers_history_cnt: number;
  total_sale_cnt: number;
  total_sale_gmv_amt: number;
  total_sale_history_cnt: number;
  total_sale_gmv_history_amt: number;
  total_digg_cnt: number;
  total_digg_history_cnt: number;
  total_product_cnt: number;
  total_product_history_cnt: number;
  total_video_cnt: number;
  total_post_video_cnt: number;
  total_live_cnt: number;
  most_category_id: string;
  most_category_l2_id: string;
  most_category_l3_id: string;
  product_category_list: string;
  region: string;
  sales_flag: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function todayDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Retorna ontem à meia-noite UTC (dados de ranklist geralmente ficam disponíveis com 1 dia de atraso) */
function yesterdayDate(): Date {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Formata data como yyyy-MM-dd para a API */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Extrai o primeiro category_id do campo product_category_list (JSON string).
 * Ex: '[{ "category_name":"Home Supplies","category_id":"600001" }]' → "600001"
 */
function extractCategoryId(productCategoryList: string): string | null {
  try {
    const arr = JSON.parse(productCategoryList || "[]");
    return arr?.[0]?.category_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Verifica se já houve um run SUCCESS para o endpoint dado
 * dentro do intervalo definido (em horas). Se sim, retorna true → skip.
 */
async function shouldSkip(
  source: string,
  intervalHours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - intervalHours * 60 * 60 * 1000);

  const recent = await prisma.ingestionRun.findFirst({
    where: {
      source,
      status: "SUCCESS",
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
  });

  return !!recent;
}

// ---------------------------------------------------------------------------
// Salvar payload bruto (dedup por hash)
// ---------------------------------------------------------------------------

async function saveRawResponse(
  endpoint: string,
  params: Record<string, unknown> | undefined,
  payload: unknown,
  runId: string,
): Promise<void> {
  const json = JSON.stringify(payload);
  const hash = sha256(json);

  await prisma.echotikRawResponse.upsert({
    where: { payloadHash: hash },
    create: {
      endpoint,
      paramsJson: params ? (params as Prisma.InputJsonValue) : Prisma.JsonNull,
      payloadJson: payload as any,
      payloadHash: hash,
      ingestionRunId: runId,
    },
    update: {
      // payload idêntico → não precisa atualizar nada
      fetchedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// 1. Sincronizar Categorias L1, L2, L3
// ---------------------------------------------------------------------------

async function syncCategoriesForLevel(
  level: 1 | 2 | 3,
  runId: string,
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
    console.error(`[echotik-cron] Erro ao buscar categorias L${level}:`, err);
    throw err;
  }

  if (body.code !== 0) {
    throw new Error(
      `[echotik-cron] API retornou erro para L${level}: ${body.code} — ${body.message}`,
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

  console.log(`[echotik-cron] Categorias L${level} sincronizadas: ${synced}`);
  return synced;
}

async function syncAllCategories(runId: string): Promise<number> {
  const skipL2L3 = await shouldSkip(
    "echotik:categories:l2l3",
    CATEGORIES_L2L3_INTERVAL_HOURS,
  );

  // L1 roda sempre (1×/dia)
  const l1 = await syncCategoriesForLevel(1, runId);

  let l2 = 0;
  let l3 = 0;
  if (!skipL2L3) {
    l2 = await syncCategoriesForLevel(2, runId);
    l3 = await syncCategoriesForLevel(3, runId);
    await prisma.ingestionRun.create({
      data: {
        source: "echotik:categories:l2l3",
        status: "SUCCESS",
        endedAt: new Date(),
      },
    });
  } else {
    console.log(
      "[echotik-cron] Categorias L2/L3: skip (já sincronizadas recentemente)",
    );
  }

  return l1 + l2 + l3;
}

// ---------------------------------------------------------------------------
// Helper: regiões ativas no banco de dados (fallback para ECHOTIK_REGIONS)
// ---------------------------------------------------------------------------

async function getConfiguredRegions(): Promise<string[]> {
  const rows = await prisma.region.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (rows.length > 0) return rows.map((r) => r.code);
  // Fallback: env var caso o banco ainda não tenha sido seedado
  return (process.env.ECHOTIK_REGIONS || "BR")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// 2. Sincronizar Vídeo Ranklist — TikTok Shop (带货榜)
// video_rank_field=2 retorna vídeos que vendem produtos (com vendas e GMV).
// ---------------------------------------------------------------------------
// TODO: syncVideoRanklistForRegion, syncProductRanklistForRegion e
// syncCreatorRanklistForRegion são estruturalmente quase idênticas (~175 linhas
// cada). Candidatas a uma função shared syncRanklistForRegion(model, ...) no
// futuro para reduzir duplicação de código.

/** Moeda local de cada região suportada. */
const REGION_CURRENCY: Record<string, string> = {
  US: "USD",
  BR: "BRL",
  UK: "GBP",
  GB: "GBP",
  MX: "MXN",
  CA: "CAD",
  AU: "AUD",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  ID: "IDR",
  PH: "PHP",
  TH: "THB",
  VN: "VND",
  SG: "SGD",
  MY: "MYR",
};

/** Retorna a segunda-feira (UTC) da semana contendo a data dada */
function getMondayOf(d: Date): Date {
  const day = d.getUTCDay(); // 0=dom, 1=seg, ..., 6=sab
  const diff = day === 0 ? -6 : 1 - day; // quantos dias até segunda anterior
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** Retorna o 1º dia (UTC) do mês contendo a data dada */
function getFirstOfMonth(d: Date): Date {
  const first = new Date(d);
  first.setUTCDate(1);
  first.setUTCHours(0, 0, 0, 0);
  return first;
}

async function syncVideoRanklistForRegion(
  runId: string,
  region: string,
  rankingCycle: 1 | 2 | 3,
  rankField: number,
): Promise<number> {
  const endpoint = "/api/v3/echotik/video/ranklist";

  // Datas candidatas dependem do tipo de ciclo:
  // cycle=1 (diário): ontem e anteontem
  // cycle=2 (semanal): segunda desta semana e segunda da semana passada
  // cycle=3 (mensal): 1º deste mês e 1º do mês passado
  let datesToTry: Date[];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const yesterday = yesterdayDate();

  if (rankingCycle === 1) {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    twoDaysAgo.setUTCHours(0, 0, 0, 0);
    datesToTry = [yesterday, twoDaysAgo];
  } else if (rankingCycle === 2) {
    const thisMonday = getMondayOf(yesterday);
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    datesToTry = [thisMonday, lastMonday, yesterday];
  } else {
    const thisMonth = getFirstOfMonth(yesterday);
    const lastMonth = new Date(thisMonth);
    lastMonth.setUTCMonth(thisMonth.getUTCMonth() - 1);
    datesToTry = [thisMonth, lastMonth, yesterday];
  }

  let synced = 0;
  let effectiveDate: Date | null = null;

  // Descobrir qual data tem dados
  for (const candidateDate of datesToTry) {
    const checkParams = {
      date: formatDate(candidateDate),
      region,
      video_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: 1,
      page_size: 1,
    };
    const check = await echotikRequest<
      EchotikApiResponse<EchotikVideoRankItem>
    >(endpoint, { params: checkParams });
    if (check.code === 0 && check.data && check.data.length > 0) {
      effectiveDate = candidateDate;
      console.log(
        `[echotik-cron] Vídeos [field=${rankField}]: dados encontrados para ${formatDate(candidateDate)}`,
      );
      break;
    }
  }

  if (!effectiveDate) {
    console.warn(
      `[echotik-cron] Nenhuma data com dados de vídeo disponível (field=${rankField})`,
    );
    return 0;
  }

  const dateStr = formatDate(effectiveDate);
  const date = effectiveDate;

  // Buscar várias páginas (page_size max = 10)
  for (let page = 1; page <= VIDEO_RANKLIST_PAGES; page++) {
    const params = {
      date: dateStr,
      region,
      video_rank_field: rankField,
      rank_type: rankingCycle, // 1=day, 2=week, 3=month
      page_num: page,
      page_size: 10,
    };

    let body: EchotikApiResponse<EchotikVideoRankItem>;

    try {
      body = await echotikRequest<EchotikApiResponse<EchotikVideoRankItem>>(
        endpoint,
        { params },
      );
    } catch (err) {
      console.error(
        `[echotik-cron] Erro ao buscar vídeo ranklist (página ${page}):`,
        err,
      );
      throw err;
    }

    if (body.code !== 0) {
      throw new Error(
        `[echotik-cron] API retornou erro: ${body.code} — ${body.message}`,
      );
    }

    await saveRawResponse(endpoint, params, body, runId);

    const items = body.data ?? [];

    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const videoExternalId = item.video_id;
      if (!videoExternalId) continue;

      const categoryId = extractCategoryId(item.product_category_list);
      const gmvCents = Math.round((item.total_video_sale_gmv_amt ?? 0) * 100);
      const rankPosition = (page - 1) * 10 + i + 1;

      await prisma.echotikVideoTrendDaily.upsert({
        where: {
          videoExternalId_date_country_rankingCycle_rankField: {
            videoExternalId,
            date,
            country: region,
            rankingCycle,
            rankField,
          },
        },
        create: {
          date,
          rankingCycle,
          rankField,
          rankPosition,
          videoExternalId,
          title: item.video_desc || null,
          authorName: item.nick_name || null,
          authorExternalId: item.user_id || null,
          views: BigInt(item.total_views_cnt ?? 0),
          likes: BigInt(item.total_digg_cnt ?? 0),
          comments: BigInt(item.total_comments_cnt ?? 0),
          favorites: BigInt(item.total_favorites_cnt ?? 0),
          shares: BigInt(item.total_shares_cnt ?? 0),
          saleCount: BigInt(item.total_video_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          currency: REGION_CURRENCY[region] ?? "USD",
          country: item.region ?? region,
          categoryId,
          extra: item as any,
        },
        update: {
          rankPosition,
          title: item.video_desc || undefined,
          authorName: item.nick_name || undefined,
          authorExternalId: item.user_id || undefined,
          views: BigInt(item.total_views_cnt ?? 0),
          likes: BigInt(item.total_digg_cnt ?? 0),
          comments: BigInt(item.total_comments_cnt ?? 0),
          favorites: BigInt(item.total_favorites_cnt ?? 0),
          shares: BigInt(item.total_shares_cnt ?? 0),
          saleCount: BigInt(item.total_video_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          currency: REGION_CURRENCY[region] ?? "USD",
          country: item.region ?? region,
          rankingCycle,
          categoryId: categoryId ?? undefined,
          extra: item as any,
          syncedAt: new Date(),
        },
      });
      synced++;
    }
  }

  console.log(
    `[echotik-cron] [${region}] [cycle=${rankingCycle}] [field=${rankField}] Vídeos sincronizados: ${synced}`,
  );
  return synced;
}

async function syncVideoRanklist(runId: string): Promise<number> {
  const regions = await getConfiguredRegions();
  console.log(
    `[echotik-cron] Sincronizando vídeos para regiões: ${regions.join(", ")}`,
  );
  const rankingCycles: Array<1 | 2 | 3> = [1, 2, 3];
  let total = 0;
  for (const region of regions) {
    for (const rankingCycle of rankingCycles) {
      for (const { field } of VIDEO_RANK_FIELDS) {
        const count = await syncVideoRanklistForRegion(
          runId,
          region,
          rankingCycle,
          field,
        );
        total += count;
      }
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// 2b. Enriquecer vídeos com detalhes dos produtos associados
// Busca product/detail para product IDs referenciados nos vídeos.
// Resultados ficam em cache (EchotikProductDetail) e são usados
// pela API /api/trending/videos para popular o campo "product" do DTO.
// ---------------------------------------------------------------------------
// TODO: syncVideoProductDetails e syncRanklistProductDetails são quase
// idênticas (~150 linhas cada). Candidatas a uma função shared
// syncProductDetails(sourceIds: string[], label: string) no futuro.
// ---------------------------------------------------------------------------

/** Tamanho do batch de IDs por request ao product/detail */
const PRODUCT_DETAIL_BATCH_SIZE = 5;

/** Idade máxima (dias) antes de re-buscar detalhes do produto */
const PRODUCT_DETAIL_MAX_AGE_DAYS = 7;

interface EchotikProductDetailItem {
  product_id: string;
  product_name: string;
  cover_url: string; // JSON string: [{ url, index }]
  spu_avg_price: number;
  min_price: number;
  max_price: number;
  product_rating: number;
  product_commission_rate: number;
  category_id: string;
  region: string;
  [key: string]: unknown;
}

/**
 * Extrai a primeira URL de imagem do campo cover_url da API.
 * cover_url é um JSON string como:
 * [{ "url":"https://...jpeg","index":4 }, ...]
 */
function extractFirstCoverUrl(
  coverUrlField: string | null | undefined,
): string | null {
  if (!coverUrlField) return null;
  try {
    const arr = JSON.parse(coverUrlField);
    if (Array.isArray(arr) && arr.length > 0) {
      // Ordenar por index e retornar a primeira
      const sorted = arr.sort(
        (a: { index: number }, b: { index: number }) =>
          (a.index ?? 0) - (b.index ?? 0),
      );
      return sorted[0]?.url ?? null;
    }
  } catch {
    // Se não for JSON válido, pode ser URL direta
    if (coverUrlField.startsWith("http")) return coverUrlField;
  }
  return null;
}

/**
 * Upsert de detalhes de um produto no cache.
 */
async function upsertProductDetail(
  item: EchotikProductDetailItem,
): Promise<void> {
  const coverUrl = extractFirstCoverUrl(item.cover_url);
  const avgPriceCents = Math.round((item.spu_avg_price ?? 0) * 100);
  const minPriceCents = Math.round((item.min_price ?? 0) * 100);
  const maxPriceCents = Math.round((item.max_price ?? 0) * 100);

  await prisma.echotikProductDetail.upsert({
    where: { productExternalId: String(item.product_id) },
    create: {
      productExternalId: String(item.product_id),
      productName: item.product_name || null,
      coverUrl,
      avgPrice: avgPriceCents,
      minPrice: minPriceCents,
      maxPrice: maxPriceCents,
      rating: item.product_rating ?? 0,
      commissionRate: item.product_commission_rate ?? 0,
      categoryId: item.category_id || null,
      region: item.region || null,
      extra: item as any,
    },
    update: {
      productName: item.product_name || undefined,
      coverUrl: coverUrl ?? undefined,
      avgPrice: avgPriceCents,
      minPrice: minPriceCents,
      maxPrice: maxPriceCents,
      rating: item.product_rating ?? 0,
      commissionRate: item.product_commission_rate ?? 0,
      categoryId: item.category_id || undefined,
      region: item.region || undefined,
      extra: item as any,
      fetchedAt: new Date(),
    },
  });
}

/**
 * Busca detalhes dos produtos associados a vídeos recentes e salva em cache.
 * Retorna o número de produtos enriquecidos/cacheados.
 */
async function syncVideoProductDetails(): Promise<number> {
  // 1. Coletar product IDs únicos dos vídeos mais recentes
  const recentVideos = await prisma.echotikVideoTrendDaily.findMany({
    where: {
      syncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { extra: true },
  });

  const allProductIds = new Set<string>();
  for (const video of recentVideos) {
    const extra = video.extra as Record<string, unknown> | null;
    if (!extra?.video_products) continue;

    // video_products é um JSON string como "[1730657715722490842]"
    // Os IDs excedem Number.MAX_SAFE_INTEGER, então usamos regex
    // para extrair como strings ao invés de JSON.parse
    const raw = String(extra.video_products);
    const matches = raw.match(/\d{10,}/g); // IDs têm 16+ dígitos
    if (matches) {
      for (const pid of matches) {
        allProductIds.add(pid);
      }
    }
  }

  if (allProductIds.size === 0) {
    console.log(
      "[echotik-cron] Nenhum product ID encontrado nos vídeos recentes",
    );
    return 0;
  }

  console.log(
    `[echotik-cron] ${allProductIds.size} product IDs únicos encontrados nos vídeos`,
  );

  // 2. Filtrar os que já estão no cache e são recentes
  const freshCutoff = new Date(
    Date.now() - PRODUCT_DETAIL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const existingProducts = await prisma.echotikProductDetail.findMany({
    where: {
      productExternalId: { in: Array.from(allProductIds) },
      fetchedAt: { gte: freshCutoff },
    },
    select: { productExternalId: true },
  });

  const cachedIds = new Set(existingProducts.map((p) => p.productExternalId));
  const missingIds = Array.from(allProductIds).filter(
    (id) => !cachedIds.has(id),
  );

  if (missingIds.length === 0) {
    console.log("[echotik-cron] Todos os produtos de vídeos já estão em cache");
    return 0;
  }

  console.log(
    `[echotik-cron] Buscando detalhes de ${missingIds.length} produtos (${cachedIds.size} já em cache)`,
  );

  // 3. Buscar em batches via product/detail API
  // Se um batch falhar (code=500), tenta IDs individualmente
  let enriched = 0;
  const failedIds: string[] = [];

  for (let i = 0; i < missingIds.length; i += PRODUCT_DETAIL_BATCH_SIZE) {
    const batch = missingIds.slice(i, i + PRODUCT_DETAIL_BATCH_SIZE);
    const idsParam = batch.join(",");

    try {
      const body = await echotikRequest<
        EchotikApiResponse<EchotikProductDetailItem>
      >("/api/v3/echotik/product/detail", {
        params: { product_ids: idsParam, language: "en-US" },
      });

      if (body.code !== 0 || !body.data) {
        // Batch falhou, tentar individualmente depois
        failedIds.push(...batch);
        continue;
      }

      for (const item of body.data) {
        await upsertProductDetail(item);
        enriched++;
      }
    } catch (err) {
      console.error(
        `[echotik-cron] Erro ao buscar product/detail batch ${i / PRODUCT_DETAIL_BATCH_SIZE + 1}:`,
        err,
      );
      failedIds.push(...batch);
    }
  }

  // 4. Retry IDs que falharam em batch — tentar individualmente
  if (failedIds.length > 0) {
    console.log(
      `[echotik-cron] Tentando ${failedIds.length} produtos individualmente...`,
    );
    let retried = 0;
    for (const pid of failedIds) {
      try {
        const body = await echotikRequest<
          EchotikApiResponse<EchotikProductDetailItem>
        >("/api/v3/echotik/product/detail", {
          params: { product_ids: pid, language: "en-US" },
        });

        if (body.code === 0 && body.data && body.data.length > 0) {
          await upsertProductDetail(body.data[0]);
          enriched++;
          retried++;
        }
      } catch {
        // ID inválido ou não encontrado — silenciar
      }

      // Limitar retries para não consumir muitas requests
      if (retried >= 50) {
        console.log("[echotik-cron] Limite de retries atingido (50)");
        break;
      }
    }
    console.log(
      `[echotik-cron] Retries individuais: ${retried} produtos recuperados`,
    );
  }

  console.log(
    `[echotik-cron] Detalhes de ${enriched} produtos cacheados com sucesso`,
  );
  return enriched;
}

// ---------------------------------------------------------------------------
// 2c. Enriquecer produtos do ranklist com detalhes (cover_url, rating, etc.)
// Busca product/detail para IDs presentes em EchotikProductTrendDaily que
// ainda não têm entrada em EchotikProductDetail.
// ---------------------------------------------------------------------------

/**
 * Busca detalhes dos produtos do ranklist (top trending) e salva em cache.
 * Os IDs vêm de EchotikProductTrendDaily — conjunto diferente dos vídeos.
 * Retorna o número de produtos enriquecidos.
 */
async function syncRanklistProductDetails(): Promise<number> {
  // 1. Coletar product IDs únicos do ranklist recente (últimos 3 dias)
  const recentRanklist = await prisma.echotikProductTrendDaily.findMany({
    where: {
      syncedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    },
    select: { productExternalId: true },
    distinct: ["productExternalId"],
  });

  const allProductIds = new Set(
    recentRanklist
      .map((r) => r.productExternalId)
      .filter((id): id is string => !!id),
  );

  if (allProductIds.size === 0) {
    console.log(
      "[echotik-cron] Nenhum product ID encontrado no ranklist recente",
    );
    return 0;
  }

  console.log(
    `[echotik-cron] ${allProductIds.size} product IDs únicos no ranklist`,
  );

  // 2. Filtrar os que já estão no cache e são recentes
  const freshCutoff = new Date(
    Date.now() - PRODUCT_DETAIL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const existingProducts = await prisma.echotikProductDetail.findMany({
    where: {
      productExternalId: { in: Array.from(allProductIds) },
      fetchedAt: { gte: freshCutoff },
    },
    select: { productExternalId: true },
  });

  const cachedIds = new Set(existingProducts.map((p) => p.productExternalId));
  const missingIds = Array.from(allProductIds).filter(
    (id) => !cachedIds.has(id),
  );

  if (missingIds.length === 0) {
    console.log(
      "[echotik-cron] Todos os produtos do ranklist já estão em cache",
    );
    return 0;
  }

  console.log(
    `[echotik-cron] Buscando detalhes de ${missingIds.length} produtos do ranklist (${cachedIds.size} já em cache)`,
  );

  // 3. Buscar em batches via product/detail API
  let enriched = 0;
  const failedIds: string[] = [];

  for (let i = 0; i < missingIds.length; i += PRODUCT_DETAIL_BATCH_SIZE) {
    const batch = missingIds.slice(i, i + PRODUCT_DETAIL_BATCH_SIZE);
    const idsParam = batch.join(",");

    try {
      const body = await echotikRequest<
        EchotikApiResponse<EchotikProductDetailItem>
      >("/api/v3/echotik/product/detail", {
        params: { product_ids: idsParam, language: "en-US" },
      });

      if (body.code !== 0 || !body.data) {
        failedIds.push(...batch);
        continue;
      }

      for (const item of body.data) {
        await upsertProductDetail(item);
        enriched++;
      }
    } catch (err) {
      console.error(
        `[echotik-cron] Erro ao buscar ranklist product/detail batch ${Math.floor(i / PRODUCT_DETAIL_BATCH_SIZE) + 1}:`,
        err,
      );
      failedIds.push(...batch);
    }
  }

  // 4. Retry individuais para os que falharam em batch
  if (failedIds.length > 0) {
    console.log(
      `[echotik-cron] Tentando ${failedIds.length} produtos do ranklist individualmente...`,
    );
    let retried = 0;
    for (const pid of failedIds) {
      try {
        const body = await echotikRequest<
          EchotikApiResponse<EchotikProductDetailItem>
        >("/api/v3/echotik/product/detail", {
          params: { product_ids: pid, language: "en-US" },
        });

        if (body.code === 0 && body.data && body.data.length > 0) {
          await upsertProductDetail(body.data[0]);
          enriched++;
          retried++;
        }
      } catch {
        // ID inválido ou não encontrado — silenciar
      }

      if (retried >= 50) {
        console.log(
          "[echotik-cron] Limite de retries do ranklist atingido (50)",
        );
        break;
      }
    }
    console.log(
      `[echotik-cron] Retries ranklist: ${retried} produtos recuperados`,
    );
  }

  console.log(
    `[echotik-cron] Detalhes de ${enriched} produtos do ranklist cacheados`,
  );
  return enriched;
}

// ---------------------------------------------------------------------------
// 3. Sincronizar Product Ranklist — TikTok Shop
// product_rank_field=1 retorna produtos ordenados por vendas.
// ---------------------------------------------------------------------------

async function syncProductRanklistForRegion(
  runId: string,
  region: string,
  rankingCycle: 1 | 2 | 3,
  rankField: number,
): Promise<number> {
  const endpoint = "/api/v3/echotik/product/ranklist";

  let datesToTry: Date[];
  const yesterday = yesterdayDate();

  if (rankingCycle === 1) {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    twoDaysAgo.setUTCHours(0, 0, 0, 0);
    datesToTry = [yesterday, twoDaysAgo];
  } else if (rankingCycle === 2) {
    const thisMonday = getMondayOf(yesterday);
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    datesToTry = [thisMonday, lastMonday, yesterday];
  } else {
    const thisMonth = getFirstOfMonth(yesterday);
    const lastMonth = new Date(thisMonth);
    lastMonth.setUTCMonth(thisMonth.getUTCMonth() - 1);
    datesToTry = [thisMonth, lastMonth, yesterday];
  }

  let synced = 0;
  let effectiveDate: Date | null = null;

  for (const candidateDate of datesToTry) {
    const checkParams = {
      date: formatDate(candidateDate),
      region,
      product_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: 1,
      page_size: 1,
      language: "en-US",
    };
    const check = await echotikRequest<
      EchotikApiResponse<EchotikProductRankItem>
    >(endpoint, { params: checkParams });
    if (check.code === 0 && check.data && check.data.length > 0) {
      effectiveDate = candidateDate;
      console.log(
        `[echotik-cron] Produtos [field=${rankField}]: dados encontrados para ${formatDate(candidateDate)}`,
      );
      break;
    }
  }

  if (!effectiveDate) {
    console.warn(
      `[echotik-cron] Nenhuma data com dados de produto disponível (field=${rankField})`,
    );
    return 0;
  }

  const dateStr = formatDate(effectiveDate);
  const date = effectiveDate;

  for (let page = 1; page <= PRODUCT_RANKLIST_PAGES; page++) {
    const params = {
      date: dateStr,
      region,
      product_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: page,
      page_size: 10,
      language: "en-US",
    };

    let body: EchotikApiResponse<EchotikProductRankItem>;
    try {
      body = await echotikRequest<EchotikApiResponse<EchotikProductRankItem>>(
        endpoint,
        { params },
      );
    } catch (err) {
      console.error(
        `[echotik-cron] Erro ao buscar product ranklist (página ${page}):`,
        err,
      );
      throw err;
    }

    if (body.code !== 0) {
      throw new Error(
        `[echotik-cron] Product API retornou erro: ${body.code} — ${body.message}`,
      );
    }

    await saveRawResponse(endpoint, params, body, runId);

    const items = body.data ?? [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productExternalId = item.product_id;
      if (!productExternalId) continue;

      const gmvCents = Math.round((item.total_sale_gmv_amt ?? 0) * 100);
      const rankPosition = (page - 1) * 10 + i + 1;

      await prisma.echotikProductTrendDaily.upsert({
        where: {
          productExternalId_date_country_rankingCycle_rankField: {
            productExternalId,
            date,
            country: region,
            rankingCycle,
            rankField,
          },
        },
        create: {
          date,
          rankingCycle,
          rankField,
          rankPosition,
          productExternalId,
          productName: item.product_name || null,
          categoryId: item.category_id || null,
          categoryL2Id: item.category_l2_id || null,
          categoryL3Id: item.category_l3_id || null,
          // Nota: min/max/avgPrice armazenam o valor BRUTO da API (ex: 9.99),
          // ao contrário de EchotikProductDetail que armazena em centavos.
          // Os DTOs de trending usam este valor diretamente — não dividir por 100.
          minPrice: item.min_price ?? 0,
          maxPrice: item.max_price ?? 0,
          avgPrice: item.spu_avg_price ?? 0,
          commissionRate: item.product_commission_rate ?? 0,
          saleCount: BigInt(item.total_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          influencerCount: BigInt(item.total_ifl_cnt ?? 0),
          videoCount: BigInt(item.total_video_cnt ?? 0),
          liveCount: BigInt(item.total_live_cnt ?? 0),
          currency: REGION_CURRENCY[region] ?? "USD",
          country: region,
          extra: item as any,
        },
        update: {
          rankPosition,
          productName: item.product_name || undefined,
          categoryId: item.category_id || undefined,
          categoryL2Id: item.category_l2_id || undefined,
          categoryL3Id: item.category_l3_id || undefined,
          minPrice: item.min_price ?? 0,
          maxPrice: item.max_price ?? 0,
          avgPrice: item.spu_avg_price ?? 0,
          commissionRate: item.product_commission_rate ?? 0,
          saleCount: BigInt(item.total_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          influencerCount: BigInt(item.total_ifl_cnt ?? 0),
          videoCount: BigInt(item.total_video_cnt ?? 0),
          liveCount: BigInt(item.total_live_cnt ?? 0),
          currency: REGION_CURRENCY[region] ?? "USD",
          country: region,
          extra: item as any,
          syncedAt: new Date(),
        },
      });
      synced++;
    }
  }

  console.log(
    `[echotik-cron] [${region}] [cycle=${rankingCycle}] [field=${rankField}] Produtos sincronizados: ${synced}`,
  );
  return synced;
}

async function syncProductRanklist(runId: string): Promise<number> {
  const regions = await getConfiguredRegions();
  console.log(
    `[echotik-cron] Sincronizando produtos para regiões: ${regions.join(", ")}`,
  );
  const rankingCycles: Array<1 | 2 | 3> = [1, 2, 3];
  let total = 0;
  for (const region of regions) {
    for (const rankingCycle of rankingCycles) {
      for (const { field } of PRODUCT_RANK_FIELDS) {
        const count = await syncProductRanklistForRegion(
          runId,
          region,
          rankingCycle,
          field,
        );
        total += count;
      }
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// 4. Sincronizar Influencer/Creator Ranklist — TikTok Shop
// influencer_rank_field=2 retorna influencers ordenados por vendas.
// ---------------------------------------------------------------------------

async function syncCreatorRanklistForRegion(
  runId: string,
  region: string,
  rankingCycle: 1 | 2 | 3,
  rankField: number,
): Promise<number> {
  const endpoint = "/api/v3/echotik/influencer/ranklist";

  let datesToTry: Date[];
  const yesterday = yesterdayDate();

  if (rankingCycle === 1) {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    twoDaysAgo.setUTCHours(0, 0, 0, 0);
    datesToTry = [yesterday, twoDaysAgo];
  } else if (rankingCycle === 2) {
    const thisMonday = getMondayOf(yesterday);
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    datesToTry = [thisMonday, lastMonday, yesterday];
  } else {
    const thisMonth = getFirstOfMonth(yesterday);
    const lastMonth = new Date(thisMonth);
    lastMonth.setUTCMonth(thisMonth.getUTCMonth() - 1);
    datesToTry = [thisMonth, lastMonth, yesterday];
  }

  let synced = 0;
  let effectiveDate: Date | null = null;

  for (const candidateDate of datesToTry) {
    const checkParams = {
      date: formatDate(candidateDate),
      region,
      influencer_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: 1,
      page_size: 1,
      language: "en-US",
    };
    const check = await echotikRequest<
      EchotikApiResponse<EchotikInfluencerRankItem>
    >(endpoint, { params: checkParams });
    if (check.code === 0 && check.data && check.data.length > 0) {
      effectiveDate = candidateDate;
      console.log(
        `[echotik-cron] Creators [field=${rankField}]: dados encontrados para ${formatDate(candidateDate)}`,
      );
      break;
    }
  }

  if (!effectiveDate) {
    console.warn(
      `[echotik-cron] Nenhuma data com dados de creator disponível (field=${rankField})`,
    );
    return 0;
  }

  const dateStr = formatDate(effectiveDate);
  const date = effectiveDate;

  for (let page = 1; page <= CREATOR_RANKLIST_PAGES; page++) {
    const params = {
      date: dateStr,
      region,
      influencer_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: page,
      page_size: 10,
      language: "en-US",
    };

    let body: EchotikApiResponse<EchotikInfluencerRankItem>;
    try {
      body = await echotikRequest<
        EchotikApiResponse<EchotikInfluencerRankItem>
      >(endpoint, { params });
    } catch (err) {
      console.error(
        `[echotik-cron] Erro ao buscar creator ranklist (página ${page}):`,
        err,
      );
      throw err;
    }

    if (body.code !== 0) {
      throw new Error(
        `[echotik-cron] Creator API retornou erro: ${body.code} — ${body.message}`,
      );
    }

    await saveRawResponse(endpoint, params, body, runId);

    const items = body.data ?? [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const userExternalId = item.user_id;
      if (!userExternalId) continue;

      const gmvCents = Math.round((item.total_sale_gmv_amt ?? 0) * 100);
      const rankPosition = (page - 1) * 10 + i + 1;

      await prisma.echotikCreatorTrendDaily.upsert({
        where: {
          userExternalId_date_country_rankingCycle_rankField: {
            userExternalId,
            date,
            country: region,
            rankingCycle,
            rankField,
          },
        },
        create: {
          date,
          rankingCycle,
          rankField,
          rankPosition,
          userExternalId,
          uniqueId: item.unique_id || null,
          nickName: item.nick_name || null,
          avatar: item.avatar || null,
          category: item.category || null,
          ecScore: item.ec_score ?? 0,
          followersCount: BigInt(
            item.total_followers_cnt || item.total_followers_history_cnt || 0,
          ),
          saleCount: BigInt(item.total_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          diggCount: BigInt(
            item.total_digg_cnt || item.total_digg_history_cnt || 0,
          ),
          productCount: BigInt(
            item.total_product_cnt || item.total_product_history_cnt || 0,
          ),
          videoCount: BigInt(
            item.total_video_cnt || item.total_post_video_cnt || 0,
          ),
          liveCount: BigInt(item.total_live_cnt ?? 0),
          mostCategoryId: item.most_category_id || null,
          currency: REGION_CURRENCY[region] ?? "USD",
          country: region,
          extra: item as any,
        },
        update: {
          rankPosition,
          uniqueId: item.unique_id || undefined,
          nickName: item.nick_name || undefined,
          avatar: item.avatar || undefined,
          category: item.category || undefined,
          ecScore: item.ec_score ?? 0,
          followersCount: BigInt(
            item.total_followers_cnt || item.total_followers_history_cnt || 0,
          ),
          saleCount: BigInt(item.total_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          diggCount: BigInt(
            item.total_digg_cnt || item.total_digg_history_cnt || 0,
          ),
          productCount: BigInt(
            item.total_product_cnt || item.total_product_history_cnt || 0,
          ),
          videoCount: BigInt(
            item.total_video_cnt || item.total_post_video_cnt || 0,
          ),
          liveCount: BigInt(item.total_live_cnt ?? 0),
          mostCategoryId: item.most_category_id || undefined,
          currency: REGION_CURRENCY[region] ?? "USD",
          country: region,
          extra: item as any,
          syncedAt: new Date(),
        },
      });
      synced++;
    }
  }

  console.log(
    `[echotik-cron] [${region}] [cycle=${rankingCycle}] [field=${rankField}] Creators sincronizados: ${synced}`,
  );
  return synced;
}

async function syncCreatorRanklist(runId: string): Promise<number> {
  const regions = await getConfiguredRegions();
  console.log(
    `[echotik-cron] Sincronizando creators para regiões: ${regions.join(", ")}`,
  );
  const rankingCycles: Array<1 | 2 | 3> = [1, 2, 3];
  let total = 0;
  for (const region of regions) {
    for (const rankingCycle of rankingCycles) {
      for (const { field } of CREATOR_RANK_FIELDS) {
        const count = await syncCreatorRanklistForRegion(
          runId,
          region,
          rankingCycle,
          field,
        );
        total += count;
      }
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Orquestrador principal
// ---------------------------------------------------------------------------

export interface CronResult {
  runId: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  stats: {
    categoriesSynced: number;
    videosSynced: number;
    productsSynced: number;
    creatorsSynced: number;
    productDetailsEnriched: number;
    categoriesSkipped: boolean;
    videosSkipped: boolean;
    productsSkipped: boolean;
    creatorsSkipped: boolean;
    durationMs: number;
  };
  error?: string;
}

/**
 * Executa o cron de ingestão EchoTik com smart scheduling.
 *
 * O cron roda a cada hora (Vercel), mas cada tarefa respeita
 * seu próprio intervalo — evitando desperdício de requests:
 *
 *   - Categorias L1:        1×/dia     (~30 req/mês)
 *   - Categorias L2/L3:    1×/semana  (~8 req/mês)
 *   - Vídeo ranklist:      4×/dia, 5 págs (~600 req/mês)
 *   - Budget usado:        ~638/10 000 req/mês
 *
 * @param force — se true, ignora intervalos e força todas as tarefas
 * @returns CronResult com runId, status e stats
 */
export async function runEchotikCron(force = false): Promise<CronResult> {
  const start = Date.now();

  // Verificar o que precisa rodar
  const skipCategories =
    !force &&
    (await shouldSkip("echotik:categories", CATEGORIES_INTERVAL_HOURS));
  const skipVideos =
    !force && (await shouldSkip("echotik:videos", VIDEO_TREND_INTERVAL_HOURS));
  const skipProducts =
    !force &&
    (await shouldSkip("echotik:products", PRODUCT_TREND_INTERVAL_HOURS));
  const skipCreators =
    !force &&
    (await shouldSkip("echotik:creators", CREATOR_TREND_INTERVAL_HOURS));

  // Se tudo está em dia, verificar se há detalhes de produtos pendentes
  if (skipCategories && skipVideos && skipProducts && skipCreators) {
    // Mesmo com tudo em dia, tentar enriquecer detalhes de produtos
    let productDetailsEnriched = 0;
    try {
      const [videoDetails, ranklistDetails] = await Promise.all([
        syncVideoProductDetails(),
        syncRanklistProductDetails(),
      ]);
      productDetailsEnriched = videoDetails + ranklistDetails;
    } catch (err) {
      console.error(
        "[echotik-cron] Erro ao enriquecer detalhes (skip path):",
        err,
      );
    }

    if (productDetailsEnriched === 0) {
      console.log("[echotik-cron] Tudo em dia, nada a sincronizar");
      return {
        runId: "",
        status: "SKIPPED",
        stats: {
          categoriesSynced: 0,
          videosSynced: 0,
          productsSynced: 0,
          creatorsSynced: 0,
          productDetailsEnriched: 0,
          categoriesSkipped: true,
          videosSkipped: true,
          productsSkipped: true,
          creatorsSkipped: true,
          durationMs: Date.now() - start,
        },
      };
    }

    // Se enriqueceu produtos, retornar SUCCESS
    console.log(
      `[echotik-cron] Detalhes de ${productDetailsEnriched} produtos enriquecidos (tasks skipped)`,
    );
    return {
      runId: "",
      status: "SUCCESS",
      stats: {
        categoriesSynced: 0,
        videosSynced: 0,
        productsSynced: 0,
        creatorsSynced: 0,
        productDetailsEnriched,
        categoriesSkipped: true,
        videosSkipped: true,
        productsSkipped: true,
        creatorsSkipped: true,
        durationMs: Date.now() - start,
      },
    };
  }

  // Criar run
  const run = await prisma.ingestionRun.create({
    data: { source: "echotik", status: "RUNNING" },
  });

  let categoriesSynced = 0;
  let videosSynced = 0;
  let productsSynced = 0;
  let creatorsSynced = 0;
  let productDetailsEnriched = 0;

  try {
    // 1. Categorias (L1 diário, L2/L3 semanal)
    if (!skipCategories) {
      categoriesSynced = await syncAllCategories(run.id);
      await prisma.ingestionRun.create({
        data: {
          source: "echotik:categories",
          status: "SUCCESS",
          endedAt: new Date(),
        },
      });
    } else {
      console.log(
        "[echotik-cron] Categorias: skip (já sincronizado recentemente)",
      );
    }

    // 2. Vídeo ranklist
    if (!skipVideos) {
      videosSynced = await syncVideoRanklist(run.id);
      await prisma.ingestionRun.create({
        data: {
          source: "echotik:videos",
          status: "SUCCESS",
          endedAt: new Date(),
        },
      });
    } else {
      console.log("[echotik-cron] Vídeos: skip (já sincronizado recentemente)");
    }

    // 2b. Enriquecer vídeos e ranklist com detalhes dos produtos associados
    // Roda sempre (tem cache próprio), não depende de video/product sync
    try {
      const [videoDetails, ranklistDetails] = await Promise.all([
        syncVideoProductDetails(),
        syncRanklistProductDetails(),
      ]);
      productDetailsEnriched = videoDetails + ranklistDetails;
      console.log(
        `[echotik-cron] Detalhes de produtos: ${productDetailsEnriched} enriquecidos (vídeos: ${videoDetails}, ranklist: ${ranklistDetails})`,
      );
    } catch (err) {
      console.error(
        "[echotik-cron] Erro ao enriquecer detalhes de produtos (não-fatal):",
        err,
      );
    }

    // 3. Product ranklist
    if (!skipProducts) {
      productsSynced = await syncProductRanklist(run.id);
      await prisma.ingestionRun.create({
        data: {
          source: "echotik:products",
          status: "SUCCESS",
          endedAt: new Date(),
        },
      });
    } else {
      console.log(
        "[echotik-cron] Produtos: skip (já sincronizado recentemente)",
      );
    }

    // 4. Creator/Influencer ranklist
    if (!skipCreators) {
      creatorsSynced = await syncCreatorRanklist(run.id);
      await prisma.ingestionRun.create({
        data: {
          source: "echotik:creators",
          status: "SUCCESS",
          endedAt: new Date(),
        },
      });
    } else {
      console.log(
        "[echotik-cron] Creators: skip (já sincronizado recentemente)",
      );
    }

    // Finalizar com sucesso
    const durationMs = Date.now() - start;
    const stats = {
      categoriesSynced,
      videosSynced,
      productsSynced,
      creatorsSynced,
      productDetailsEnriched,
      categoriesSkipped: skipCategories,
      videosSkipped: skipVideos,
      productsSkipped: skipProducts,
      creatorsSkipped: skipCreators,
      durationMs,
    };

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        endedAt: new Date(),
        statsJson: stats,
      },
    });

    console.log(
      `[echotik-cron] Concluído em ${durationMs}ms — ` +
        `categorias: ${skipCategories ? "skip" : categoriesSynced}, ` +
        `vídeos: ${skipVideos ? "skip" : videosSynced}, ` +
        `produtos: ${skipProducts ? "skip" : productsSynced}, ` +
        `creators: ${skipCreators ? "skip" : creatorsSynced}, ` +
        `detalhes: ${productDetailsEnriched}`,
    );

    return { runId: run.id, status: "SUCCESS", stats };
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const stats = {
      categoriesSynced,
      videosSynced,
      productsSynced,
      creatorsSynced,
      productDetailsEnriched,
      categoriesSkipped: skipCategories,
      videosSkipped: skipVideos,
      productsSkipped: skipProducts,
      creatorsSkipped: skipCreators,
      durationMs,
    };

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
        statsJson: stats,
        errorMessage,
      },
    });

    console.error(`[echotik-cron] Falhou após ${durationMs}ms:`, errorMessage);

    return {
      runId: run.id,
      status: "FAILED",
      stats,
      error: errorMessage,
    };
  }
}
