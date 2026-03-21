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
 *   - Vídeo ranklist: 4×/dia, 5 págs cada (~600 req/mês) — top 50 vídeos/dia
 *   - Total estimado: ~630 req/mês (sobra para futuros endpoints)
 *   - Cron roda a cada hora, mas faz skip se ainda não passou o intervalo
 *
 * Chamado pelo route handler: app/api/cron/echotik/route.ts
 */

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { echotikRequest } from "@/lib/echotik/client";

// ---------------------------------------------------------------------------
// Intervalos de sincronização (em horas)
// ---------------------------------------------------------------------------

/** Intervalos de sincronização de categorias (em horas) */
const CATEGORIES_INTERVAL_HOURS = 24;

/** Categorias L2/L3 mudam pouco — sincronizar 1×/semana */
const CATEGORIES_L2L3_INTERVAL_HOURS = 168;

/** Vídeos trending mudam constantemente → 4×/dia */
const VIDEO_TREND_INTERVAL_HOURS = 6;

/** Quantas páginas buscar do ranklist (page_size max = 10) */
const VIDEO_RANKLIST_PAGES = 5; // 5 × 10 = top 50 vídeos

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
// Helper: regiões configuradas via env var ECHOTIK_REGIONS (padrão: "US")
// ---------------------------------------------------------------------------

function getConfiguredRegions(): string[] {
  return (process.env.ECHOTIK_REGIONS || "US")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// 2. Sincronizar Vídeo Ranklist — TikTok Shop (带货榜)
// video_rank_field=2 retorna vídeos que vendem produtos (com vendas e GMV).
// ---------------------------------------------------------------------------

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
    // também tenta os dias desta semana caso segunda ainda não tenha dados
    datesToTry = [thisMonday, lastMonday, yesterday];
  } else {
    const thisMonth = getFirstOfMonth(yesterday);
    const lastMonth = new Date(thisMonth);
    lastMonth.setUTCMonth(thisMonth.getUTCMonth() - 1);
    // tenta também yesterday por via das dúvidas
    datesToTry = [thisMonth, lastMonth, yesterday];
  }

  let synced = 0;
  let effectiveDate: Date | null = null;

  // Descobrir qual data tem dados
  for (const candidateDate of datesToTry) {
    const checkParams = {
      date: formatDate(candidateDate),
      region,
      video_rank_field: 2, // 2=带货榜 (TikTok Shop — vendas)
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
        `[echotik-cron] Dados encontrados para ${formatDate(candidateDate)}`,
      );
      break;
    }
  }

  if (!effectiveDate) {
    console.warn("[echotik-cron] Nenhuma data com dados de vídeo disponível");
    return 0;
  }

  const dateStr = formatDate(effectiveDate);
  const date = effectiveDate;

  // Buscar várias páginas (page_size max = 10)
  for (let page = 1; page <= VIDEO_RANKLIST_PAGES; page++) {
    const params = {
      date: dateStr,
      region,
      video_rank_field: 2, // 2=带货榜 (TikTok Shop — vendas)
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

    // Se não retornou dados, não há mais páginas
    if (items.length === 0) break;

    for (const item of items) {
      const videoExternalId = item.video_id;
      if (!videoExternalId) continue;

      const categoryId = extractCategoryId(item.product_category_list);

      // gmv vem em dólares inteiros da API, converter para centavos (BigInt)
      const gmvCents = Math.round((item.total_video_sale_gmv_amt ?? 0) * 100);

      await prisma.echotikVideoTrendDaily.upsert({
        where: {
          videoExternalId_date_country_rankingCycle: {
            videoExternalId,
            date,
            country: region,
            rankingCycle,
          },
        },
        create: {
          date,
          rankingCycle,
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
          country: item.region ?? "US",
          categoryId,
          extra: item as any,
        },
        update: {
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
          country: item.region ?? "US",
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
    `[echotik-cron] [${region}] [cycle=${rankingCycle}] Vídeos ranklist sincronizados: ${synced}`,
  );
  return synced;
}

async function syncVideoRanklist(runId: string): Promise<number> {
  const regions = getConfiguredRegions();
  console.log(
    `[echotik-cron] Sincronizando vídeos para regiões: ${regions.join(", ")}`,
  );
  const rankingCycles: Array<1 | 2 | 3> = [1, 2, 3];
  let total = 0;
  for (const region of regions) {
    for (const rankingCycle of rankingCycles) {
      const count = await syncVideoRanklistForRegion(
        runId,
        region,
        rankingCycle,
      );
      total += count;
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
    categoriesSkipped: boolean;
    videosSkipped: boolean;
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

  // Se tudo está em dia, retornar SKIPPED sem criar run
  if (skipCategories && skipVideos) {
    console.log("[echotik-cron] Tudo em dia, nada a sincronizar");
    return {
      runId: "",
      status: "SKIPPED",
      stats: {
        categoriesSynced: 0,
        videosSynced: 0,
        categoriesSkipped: true,
        videosSkipped: true,
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

  try {
    // 1. Categorias (L1 diário, L2/L3 semanal)
    if (!skipCategories) {
      categoriesSynced = await syncAllCategories(run.id);
      // Registrar sucesso específico para controle de intervalo
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

    // Finalizar com sucesso
    const durationMs = Date.now() - start;
    const stats = {
      categoriesSynced,
      videosSynced,
      categoriesSkipped: skipCategories,
      videosSkipped: skipVideos,
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
        `vídeos: ${skipVideos ? "skip" : videosSynced}`,
    );

    return { runId: run.id, status: "SUCCESS", stats };
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const stats = {
      categoriesSynced,
      videosSynced,
      categoriesSkipped: skipCategories,
      videosSkipped: skipVideos,
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
