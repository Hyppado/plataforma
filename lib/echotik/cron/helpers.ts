/**
 * lib/echotik/cron/helpers.ts — Shared utilities for EchoTik cron modules
 *
 * Date computation, hashing, dedup, region config, and raw payload storage.
 */

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Hash / date helpers
// ---------------------------------------------------------------------------

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function todayDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Retorna ontem à meia-noite UTC */
export function yesterdayDate(): Date {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Formata data como yyyy-MM-dd para a API */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Retorna a segunda-feira (UTC) da semana contendo a data dada */
export function getMondayOf(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** Retorna o 1º dia (UTC) do mês contendo a data dada */
export function getFirstOfMonth(d: Date): Date {
  const first = new Date(d);
  first.setUTCDate(1);
  first.setUTCHours(0, 0, 0, 0);
  return first;
}

/**
 * Extrai o primeiro category_id do campo product_category_list (JSON string).
 */
export function extractCategoryId(productCategoryList: string): string | null {
  try {
    const arr = JSON.parse(productCategoryList || "[]");
    return arr?.[0]?.category_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Extrai a primeira URL de imagem do campo cover_url da API.
 * cover_url é um JSON string: [{ "url":"https://...jpeg","index":4 }, ...]
 */
export function extractFirstCoverUrl(
  coverUrlField: string | null | undefined,
): string | null {
  if (!coverUrlField) return null;
  try {
    const arr = JSON.parse(coverUrlField);
    if (Array.isArray(arr) && arr.length > 0) {
      const sorted = arr.sort(
        (a: { index: number }, b: { index: number }) =>
          (a.index ?? 0) - (b.index ?? 0),
      );
      return sorted[0]?.url ?? null;
    }
  } catch {
    if (coverUrlField.startsWith("http")) return coverUrlField;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Moeda local de cada região suportada
// ---------------------------------------------------------------------------

export const REGION_CURRENCY: Record<string, string> = {
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

// ---------------------------------------------------------------------------
// Candidate dates for ranklist queries
// ---------------------------------------------------------------------------

/**
 * Builds the list of candidate dates to try for a given ranking cycle.
 * cycle=1 (daily): yesterday, twoDaysAgo
 * cycle=2 (weekly): thisMonday, lastMonday, yesterday
 * cycle=3 (monthly): thisMonth, lastMonth, yesterday
 */
export function getCandidateDates(rankingCycle: 1 | 2 | 3): Date[] {
  const yesterday = yesterdayDate();

  if (rankingCycle === 1) {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    twoDaysAgo.setUTCHours(0, 0, 0, 0);
    return [yesterday, twoDaysAgo];
  }

  if (rankingCycle === 2) {
    const thisMonday = getMondayOf(yesterday);
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    return [thisMonday, lastMonday, yesterday];
  }

  // cycle === 3
  const thisMonth = getFirstOfMonth(yesterday);
  const lastMonth = new Date(thisMonth);
  lastMonth.setUTCMonth(thisMonth.getUTCMonth() - 1);
  return [thisMonth, lastMonth, yesterday];
}

// ---------------------------------------------------------------------------
// Smart scheduling — should skip?
// ---------------------------------------------------------------------------

/**
 * Checks if a successful IngestionRun exists within the given interval.
 * Returns true → skip.
 */
export async function shouldSkip(
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
// Stale RUNNING cleanup
// ---------------------------------------------------------------------------

/**
 * Marks RUNNING IngestionRun records older than `staleMinutes` as FAILED.
 *
 * Vercel hard-kills functions at the 60s limit, which can prevent the
 * orchestrator's catch/finally from updating the record. This cleanup
 * runs at the start of each cron tick to prevent orphaned RUNNING records
 * from accumulating.
 */
export async function cleanupStaleRuns(
  staleMinutes = 5,
  log?: Logger,
): Promise<number> {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);

  const result = await prisma.ingestionRun.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: cutoff },
    },
    data: {
      status: "FAILED",
      endedAt: new Date(),
      errorMessage: "Timed out — stale RUNNING record cleaned up",
    },
  });

  if (result.count > 0) {
    log?.warn("Cleaned up stale RUNNING records", { count: result.count });
  }

  return result.count;
}

// ---------------------------------------------------------------------------
// Excessive-failure backoff
// ---------------------------------------------------------------------------

/**
 * Returns true if a source has too many recent failures, meaning the cron
 * should temporarily skip it and let other sources proceed.
 *
 * Prevents a single problematic region from monopolising every cron tick
 * with repeated retries (e.g. GB had 43 RUNNING/FAILED records in one day).
 *
 * After `windowHours` without new failures the counter resets naturally.
 */
export async function hasExcessiveFailures(
  source: string,
  maxRecent = 5,
  windowHours = 2,
): Promise<boolean> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const failCount = await prisma.ingestionRun.count({
    where: {
      source,
      status: "FAILED",
      startedAt: { gte: since },
    },
  });

  return failCount >= maxRecent;
}

// ---------------------------------------------------------------------------
// Raw payload storage (dedup by SHA-256)
// ---------------------------------------------------------------------------

export async function saveRawResponse(
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
      fetchedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Active regions
// ---------------------------------------------------------------------------

/**
 * Returns the list of active regions from the database.
 * The Region table is the single source of truth — manage regions there.
 * Falls back to ["BR", "US", "JP"] only if the table is empty (e.g. local dev
 * before running `prisma db seed`).
 */
export async function getConfiguredRegions(): Promise<string[]> {
  const rows = await prisma.region.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (rows.length > 0) return rows.map((r) => r.code);
  // Fallback for empty DB (local dev only — run `npx prisma db seed` to fix)
  return ["BR", "US", "JP"];
}

// ---------------------------------------------------------------------------
// Shared upsert for product details cache
// ---------------------------------------------------------------------------

export async function upsertProductDetail(
  item: import("./types").EchotikProductDetailItem,
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
