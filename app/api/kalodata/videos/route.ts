import { NextRequest, NextResponse } from "next/server";
import { parseTopVideos7d } from "@/lib/kalodata/xlsx-parser";
import type { TimeRange, VideoDTO } from "@/lib/types/kalodata";
import {
  isShortTikTokUrl,
  resolveShortTikTokUrl,
  normalizeTikTokUrlToCanonical,
  fetchTikTokOEmbed,
  withConcurrency,
} from "@/lib/kalodata/tiktok";

// Force dynamic rendering so oEmbed fetches run server-side
export const dynamic = "force-dynamic";

/**
 * Enriches a parsed VideoDTO with:
 * 1) Canonical TikTok URL (resolves short links)
 * 2) Real thumbnail from TikTok oEmbed
 */
async function enrichVideo(video: VideoDTO): Promise<VideoDTO> {
  const rawUrl = video.tiktokUrl;
  const creatorUsername = video.creatorHandle; // e.g. "@ba.heck"

  // Step 1: Resolve redirects for shortened links
  let resolvedUrl: string | null = null;
  if (rawUrl && isShortTikTokUrl(rawUrl)) {
    resolvedUrl = await resolveShortTikTokUrl(rawUrl, 8000);
  }

  // Step 2: Build canonical URL
  const canonical = normalizeTikTokUrlToCanonical({
    rawUrl,
    creatorUsername,
    resolvedUrl,
  });

  // Step 3: Fetch oEmbed thumbnail (with retry)
  const oEmbedUrl = canonical ?? resolvedUrl ?? rawUrl;
  let thumbnailUrl: string | null = null;

  if (oEmbedUrl) {
    // First attempt with 20s timeout
    let oembed = await fetchTikTokOEmbed(oEmbedUrl, 20000);

    // Retry once if failed (with 2s delay)
    if (!oembed?.thumbnail_url) {
      await new Promise((r) => setTimeout(r, 2000));
      oembed = await fetchTikTokOEmbed(oEmbedUrl, 20000);
    }

    thumbnailUrl = oembed?.thumbnail_url ?? null;
  }

  return {
    ...video,
    tiktokUrl: canonical ?? rawUrl,
    thumbnailUrl,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") as TimeRange) || "7d";
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || undefined;

    // Parse from XLSX
    let videos = await parseTopVideos7d();

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      videos = videos.filter(
        (v) =>
          v.title.toLowerCase().includes(searchLower) ||
          v.creatorHandle.toLowerCase().includes(searchLower),
      );
    }

    // Sort by revenue and limit results
    const sortedVideos = [...videos].sort(
      (a, b) => b.revenueBRL - a.revenueBRL,
    );
    const limitedVideos = sortedVideos.slice(0, limit);

    // Enrich with canonical URLs + thumbnails (sequential to avoid TikTok rate limiting)
    const enrichedVideos = await withConcurrency(limitedVideos, 1, enrichVideo);

    return NextResponse.json({
      success: true,
      data: {
        items: enrichedVideos,
        total: videos.length,
        range,
      },
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json({
      success: true,
      data: {
        items: [],
        total: 0,
        range: "7d",
        error: "Failed to load videos",
      },
    });
  }
}
