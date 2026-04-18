/**
 * Shared utilities for trending API routes (videos / products / creators).
 *
 * Extracted to eliminate ~90% code duplication across the three route files.
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// CDN proxy helper
// ---------------------------------------------------------------------------

export const ECHOTIK_CDN = "echosell-images.tos-ap-southeast-1.volces.com";

/**
 * Rewrites Echotik CDN image URLs through the local proxy to avoid CORS and
 * hotlinking issues. Returns the original URL for non-CDN URLs.
 *
 * NOTE: This is the FALLBACK path for images not yet uploaded to Vercel Blob.
 * Trending routes should prefer blobUrl/avatarBlobUrl when available.
 * Once all images are migrated to Blob, proxy calls should drop to zero.
 *
 * @param url  Original image URL (may be null or undefined)
 * @param fallback  Value to return when url is empty (default: "")
 */
export function proxyIfEchotikCdn(url: string | null | undefined): string;
export function proxyIfEchotikCdn(
  url: string | null | undefined,
  fallback: string,
): string;
export function proxyIfEchotikCdn(
  url: string | null | undefined,
  fallback = "",
): string {
  if (!url) return fallback;
  try {
    if (new URL(url).hostname === ECHOTIK_CDN) {
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // malformed URL — return as-is
  }
  return url;
}

// ---------------------------------------------------------------------------
// Cycle / date resolution
// ---------------------------------------------------------------------------

type RangeParam = "1d" | "7d" | "30d";
type RankingCycle = 1 | 2 | 3;

/**
 * Map a range string to the Echotik ranking cycle.
 * Echotik ranklist API only supports:
 *   "1d"  → rank_type 1 (daily)
 *   "7d"  → rank_type 2 (weekly, every Monday)
 *   "30d" → rank_type 3 (monthly, first day of month)
 */
export function rangeToCycles(range: RangeParam): {
  requested: RankingCycle;
  candidates: RankingCycle[];
} {
  if (range === "1d") return { requested: 1, candidates: [1] };
  if (range === "7d") return { requested: 2, candidates: [2, 1] };
  return { requested: 3, candidates: [3, 2, 1] };
}

type TrendingModel = "video" | "product" | "creator";

interface ResolveCycleArgs {
  model: TrendingModel;
  region: string;
  rankField: number;
  candidates: RankingCycle[];
}

interface ResolveCycleResult {
  latest: Date | null;
  rankingCycle: RankingCycle;
}

/**
 * Finds the most recent snapshot date for the trending model, trying each
 * candidate cycle from most- to least-preferred.
 *
 * Returns `{ latest: null }` when no data exists (cron hasn't run yet).
 */
export async function resolveCycleAndDate({
  model,
  region,
  rankField,
  candidates,
}: ResolveCycleArgs): Promise<ResolveCycleResult> {
  for (const cycle of candidates) {
    let candidate: { date: Date } | null = null;

    if (model === "video") {
      candidate = await prisma.echotikVideoTrendDaily.findFirst({
        where: { country: region, rankingCycle: cycle, rankField },
        orderBy: { date: "desc" },
        select: { date: true },
      });
    } else if (model === "product") {
      candidate = await prisma.echotikProductTrendDaily.findFirst({
        where: { country: region, rankingCycle: cycle, rankField },
        orderBy: { date: "desc" },
        select: { date: true },
      });
    } else {
      candidate = await prisma.echotikCreatorTrendDaily.findFirst({
        where: { country: region, rankingCycle: cycle, rankField },
        orderBy: { date: "desc" },
        select: { date: true },
      });
    }

    if (candidate) {
      return { latest: candidate.date, rankingCycle: cycle };
    }
  }

  return { latest: null, rankingCycle: candidates[0] };
}

/**
 * Returns the sorted list of distinct countries available for a given model.
 */
export async function getAvailableRegions(
  model: TrendingModel,
): Promise<string[]> {
  if (model === "video") {
    const rows = await prisma.echotikVideoTrendDaily.findMany({
      distinct: ["country"],
      select: { country: true },
    });
    return rows.map((r) => r.country).sort();
  } else if (model === "product") {
    const rows = await prisma.echotikProductTrendDaily.findMany({
      distinct: ["country"],
      select: { country: true },
    });
    return rows.map((r) => r.country).sort();
  } else {
    const rows = await prisma.echotikCreatorTrendDaily.findMany({
      distinct: ["country"],
      select: { country: true },
    });
    return rows.map((r) => r.country).sort();
  }
}
