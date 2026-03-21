/**
 * EchoTik Cron Service
 *
 * Orquestra a ingestão periódica de dados da API EchoTik:
 *   1. Sincroniza categorias L1  (upsert por externalId)
 *   2. Sincroniza vídeos trending (upsert por videoExternalId + date)
 *   3. Salva payloads brutos com dedup via SHA-256
 *   4. Registra cada execução em IngestionRun
 *
 * Estratégia de budget (10 000 req/mês):
 *   - Categorias L1: 1×/dia   (~30 req/mês)  — mudam pouco
 *   - Vídeos trending: 4×/dia (~120 req/mês)  — a cada 6 h
 *   - Total estimado: ~150 req/mês (sobra para futuros endpoints)
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

/** Categorias mudam raramente → sincronizar 1×/dia */
const CATEGORIES_INTERVAL_HOURS = 24;

/** Vídeos trending mudam constantemente → 4×/dia */
const VIDEO_TREND_INTERVAL_HOURS = 6;

// ---------------------------------------------------------------------------
// Tipos de resposta esperados da API EchoTik
// (Ajustar caso a documentação oficial revele estrutura diferente)
// ---------------------------------------------------------------------------

interface EchotikCategoryItem {
  category_id?: string;
  id?: string;
  category_name?: string;
  name?: string;
  parent_id?: string;
  parent_category_id?: string;
  level?: number;
  language?: string;
  [key: string]: unknown;
}

interface EchotikCategoriesResponse {
  code?: number;
  msg?: string;
  data?: {
    categories?: EchotikCategoryItem[];
    list?: EchotikCategoryItem[];
  };
  categories?: EchotikCategoryItem[];
  list?: EchotikCategoryItem[];
}

interface EchotikVideoItem {
  video_id?: string;
  id?: string;
  title?: string;
  author_name?: string;
  author_nickname?: string;
  author_id?: string;
  views?: number;
  view_count?: number;
  likes?: number;
  like_count?: number;
  comments?: number;
  comment_count?: number;
  favorites?: number;
  favorite_count?: number;
  shares?: number;
  share_count?: number;
  sale_count?: number;
  sales?: number;
  gmv?: number;
  revenue?: number;
  currency?: string;
  country?: string;
  category_id?: string;
  [key: string]: unknown;
}

interface EchotikVideosResponse {
  code?: number;
  msg?: string;
  data?: {
    videos?: EchotikVideoItem[];
    list?: EchotikVideoItem[];
  };
  videos?: EchotikVideoItem[];
  list?: EchotikVideoItem[];
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

/** Normaliza lista de categorias vindas de formatos variados da API */
function extractCategories(
  body: EchotikCategoriesResponse,
): EchotikCategoryItem[] {
  return (
    body.data?.categories ??
    body.data?.list ??
    body.categories ??
    body.list ??
    []
  );
}

/** Normaliza lista de vídeos */
function extractVideos(body: EchotikVideosResponse): EchotikVideoItem[] {
  return body.data?.videos ?? body.data?.list ?? body.videos ?? body.list ?? [];
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
// 1. Sincronizar Categorias L1
// ---------------------------------------------------------------------------

async function syncCategoriesL1(runId: string): Promise<number> {
  const endpoint = "/api/v1/category";
  let body: EchotikCategoriesResponse;

  try {
    body = await echotikRequest<EchotikCategoriesResponse>(endpoint, {
      params: { level: 1 },
    });
  } catch (err) {
    console.error("[echotik-cron] Erro ao buscar categorias:", err);
    throw err;
  }

  await saveRawResponse(endpoint, { level: 1 }, body, runId);

  const items = extractCategories(body);
  let synced = 0;

  for (const item of items) {
    const externalId = String(item.category_id ?? item.id ?? "");
    if (!externalId) continue;

    const name = item.category_name ?? item.name ?? "Sem nome";
    const parentExternalId = item.parent_id ?? item.parent_category_id ?? null;
    const level = item.level ?? 1;
    const language = item.language ?? "en";

    // Gerar slug a partir do nome
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
        level,
        parentExternalId: parentExternalId ? String(parentExternalId) : null,
        slug,
        extra: item as any,
      },
      update: {
        name,
        language,
        level,
        parentExternalId: parentExternalId ? String(parentExternalId) : null,
        slug,
        extra: item as any,
        syncedAt: new Date(),
      },
    });
    synced++;
  }

  console.log(`[echotik-cron] Categorias sincronizadas: ${synced}`);
  return synced;
}

// ---------------------------------------------------------------------------
// 2. Sincronizar Vídeos Trending
// ---------------------------------------------------------------------------

async function syncVideoTrend(runId: string): Promise<number> {
  const endpoint = "/api/v1/videos/trending";
  const date = todayDate();
  let body: EchotikVideosResponse;

  try {
    body = await echotikRequest<EchotikVideosResponse>(endpoint, {
      params: {
        country: "US",
        sort_by: "views",
        page: 1,
        size: 50,
      },
    });
  } catch (err) {
    console.error("[echotik-cron] Erro ao buscar vídeos trending:", err);
    throw err;
  }

  await saveRawResponse(
    endpoint,
    { country: "US", sort_by: "views", page: 1, size: 50 },
    body,
    runId,
  );

  const items = extractVideos(body);
  let synced = 0;

  for (const item of items) {
    const videoExternalId = String(item.video_id ?? item.id ?? "");
    if (!videoExternalId) continue;

    await prisma.echotikVideoTrendDaily.upsert({
      where: {
        videoExternalId_date: {
          videoExternalId,
          date,
        },
      },
      create: {
        date,
        videoExternalId,
        title: item.title ?? null,
        authorName: item.author_name ?? item.author_nickname ?? null,
        authorExternalId: item.author_id ? String(item.author_id) : null,
        views: BigInt(item.views ?? item.view_count ?? 0),
        likes: BigInt(item.likes ?? item.like_count ?? 0),
        comments: BigInt(item.comments ?? item.comment_count ?? 0),
        favorites: BigInt(item.favorites ?? item.favorite_count ?? 0),
        shares: BigInt(item.shares ?? item.share_count ?? 0),
        saleCount: BigInt(item.sale_count ?? item.sales ?? 0),
        gmv: BigInt(item.gmv ?? item.revenue ?? 0),
        currency: item.currency ?? "USD",
        country: item.country ?? "US",
        categoryId: item.category_id ? String(item.category_id) : null,
        extra: item as any,
      },
      update: {
        title: item.title ?? undefined,
        authorName: item.author_name ?? item.author_nickname ?? undefined,
        authorExternalId: item.author_id ? String(item.author_id) : undefined,
        views: BigInt(item.views ?? item.view_count ?? 0),
        likes: BigInt(item.likes ?? item.like_count ?? 0),
        comments: BigInt(item.comments ?? item.comment_count ?? 0),
        favorites: BigInt(item.favorites ?? item.favorite_count ?? 0),
        shares: BigInt(item.shares ?? item.share_count ?? 0),
        saleCount: BigInt(item.sale_count ?? item.sales ?? 0),
        gmv: BigInt(item.gmv ?? item.revenue ?? 0),
        currency: item.currency ?? "USD",
        country: item.country ?? "US",
        categoryId: item.category_id ? String(item.category_id) : undefined,
        extra: item as any,
        syncedAt: new Date(),
      },
    });
    synced++;
  }

  console.log(`[echotik-cron] Vídeos trending sincronizados: ${synced}`);
  return synced;
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
 *   - Categorias L1:    1×/dia   (~30 req/mês)
 *   - Vídeos trending:  4×/dia   (~120 req/mês)
 *   - Budget usado:     ~150/10 000 req/mês
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
    // 1. Categorias L1
    if (!skipCategories) {
      categoriesSynced = await syncCategoriesL1(run.id);
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

    // 2. Vídeos trending
    if (!skipVideos) {
      videosSynced = await syncVideoTrend(run.id);
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
