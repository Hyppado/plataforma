/**
 * lib/echotik/cron/cacheDownloadUrls.ts — Cron module: pre-cache video download URLs
 *
 * Fetches ephemeral download URLs from Echotik for trending videos and stores
 * them in the database, so the transcription pipeline can use them without
 * making on-demand Echotik API calls.
 *
 * Download URLs are ephemeral (expire after hours/days), so we only pre-cache
 * for recent trending videos. The transcription pipeline checks the cache age
 * and re-fetches if stale.
 */

import { prisma } from "@/lib/prisma";
import { echotikRequest } from "@/lib/echotik/client";
import type { Logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max videos to cache per invocation */
const BATCH_SIZE = 15;

/** Max age before a cached download URL is considered stale (hours) */
export const DOWNLOAD_URL_MAX_AGE_HOURS = 12;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EchotikDownloadUrlResponse {
  code: number;
  message?: string;
  msg?: string;
  data?: {
    play_url?: string;
    download_url?: string;
    no_watermark_download_url?: string;
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Fetches a download URL from Echotik and stores it in the database.
 */
async function cacheDownloadUrlForVideo(
  videoExternalId: string,
  log: Logger,
): Promise<boolean> {
  try {
    const tiktokUrl = `https://www.tiktok.com/@user/video/${videoExternalId}`;

    const response = await echotikRequest<EchotikDownloadUrlResponse>(
      "/api/v3/realtime/video/download-url",
      { params: { url: tiktokUrl }, timeout: 20_000 },
    );

    if (response.code !== 0 || !response.data) {
      log.info("No download URL from Echotik", {
        videoExternalId,
        code: response.code,
      });
      return false;
    }

    const url =
      response.data.no_watermark_download_url ??
      response.data.download_url ??
      response.data.play_url;

    if (!url) {
      log.info("Download URL response empty", { videoExternalId });
      return false;
    }

    // Update all trend records for this video with the cached URL
    await prisma.echotikVideoTrendDaily.updateMany({
      where: { videoExternalId },
      data: {
        downloadUrl: url,
        downloadUrlFetchedAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    log.error("Failed to cache download URL", {
      videoExternalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export interface CacheDownloadUrlsResult {
  cached: number;
  attempted: number;
}

/**
 * Pre-caches download URLs for recent trending videos that don't have one yet
 * or whose cached URL is stale.
 */
export async function cachePendingDownloadUrls(
  log: Logger,
  deadlineMs?: number,
): Promise<CacheDownloadUrlsResult> {
  const staleThreshold = new Date(
    Date.now() - DOWNLOAD_URL_MAX_AGE_HOURS * 60 * 60 * 1000,
  );

  // Find distinct videos needing download URL caching
  // Prioritize videos with no URL, then those with stale URLs
  const videos = await prisma.echotikVideoTrendDaily.findMany({
    where: {
      OR: [
        { downloadUrl: null },
        { downloadUrlFetchedAt: { lt: staleThreshold } },
      ],
    },
    select: { videoExternalId: true },
    distinct: ["videoExternalId"],
    take: BATCH_SIZE,
    orderBy: { date: "desc" },
  });

  if (videos.length === 0) {
    log.info("No videos need download URL caching");
    return { cached: 0, attempted: 0 };
  }

  log.info("Caching download URLs", { count: videos.length });
  let cached = 0;

  for (const video of videos) {
    if (deadlineMs && Date.now() > deadlineMs) {
      log.info("Deadline approaching, stopping download URL caching", {
        cached,
        remaining: videos.length - cached,
      });
      break;
    }

    const success = await cacheDownloadUrlForVideo(video.videoExternalId, log);
    if (success) cached++;
  }

  log.info("Download URLs cached", { cached, total: videos.length });
  return { cached, attempted: videos.length };
}
