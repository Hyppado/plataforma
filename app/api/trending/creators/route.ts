import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_RANK_FIELDS,
  creatorSortToField,
} from "@/lib/echotik/rankFields";
import type { CreatorDTO } from "@/lib/types/dto";

const ECHOTIK_CDN = "echosell-images.tos-ap-southeast-1.volces.com";

/** Wraps echosell-images URLs through the image proxy */
function proxyIfEchotikCdn(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    if (new URL(url).hostname === ECHOTIK_CDN) {
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}

export const dynamic = "force-dynamic";

/**
 * GET /api/trending/creators
 *
 * DB-first: reads from EchotikCreatorTrendDaily.
 * Returns empty array when DB is empty (cron hasn't run yet).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") || "7d") as
      | "1d"
      | "7d"
      | "30d"
      | "90d";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100", 10),
      1000,
    );
    const search = searchParams.get("search") || undefined;
    const region = (searchParams.get("region") || "US").toUpperCase();
    const sort = searchParams.get("sort") || "sales";
    const rankField = creatorSortToField(sort);

    const requestedRankingCycle = range === "1d" ? 1 : range === "7d" ? 2 : 3;
    const cycleCandidates: Array<1 | 2 | 3> =
      range === "1d" ? [1] : range === "7d" ? [2, 1] : [3, 2, 1];

    // Find the most recent snapshot for the best available cycle
    let latest: { date: Date } | null = null;
    let rankingCycle = requestedRankingCycle;
    for (const cycle of cycleCandidates) {
      const candidate = await prisma.echotikCreatorTrendDaily.findFirst({
        where: { country: region, rankingCycle: cycle, rankField },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      if (candidate) {
        latest = candidate;
        rankingCycle = cycle;
        break;
      }
    }

    // Available regions
    const availableRegionsRaw = await prisma.echotikCreatorTrendDaily.findMany({
      distinct: ["country"],
      select: { country: true },
    });
    const availableRegions = availableRegionsRaw.map((r) => r.country).sort();

    if (!latest) {
      return NextResponse.json({
        success: true,
        data: { items: [], total: 0, range, availableRegions },
      });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      date: latest.date,
      country: region,
      rankingCycle,
      rankField,
    };
    if (search) {
      const q = search.toLowerCase();
      where.OR = [
        { nickName: { contains: q, mode: "insensitive" } },
        { uniqueId: { contains: q, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.echotikCreatorTrendDaily.findMany({
      where,
      orderBy: { rankPosition: "asc" },
      take: limit,
    });

    const items: CreatorDTO[] = rows.map((r) => {
      return {
        id: r.userExternalId,
        name: r.nickName || r.uniqueId || "",
        handle: r.uniqueId ? `@${r.uniqueId}` : "",
        followers: Number(r.followersCount),
        revenueBRL: Number(r.gmv) / 100,
        productCount: Number(r.productCount),
        liveCount: Number(r.liveCount),
        liveGmvBRL: 0,
        videoCount: Number(r.videoCount),
        videoGmvBRL: 0,
        views: Number(r.diggCount),
        debutDate: r.date.toISOString(),
        sourceUrl: `https://echotik.live/influencer/${r.uniqueId || r.userExternalId}`,
        tiktokUrl: r.uniqueId ? `https://www.tiktok.com/@${r.uniqueId}` : "",
        dateRange: range,
        avatarUrl: proxyIfEchotikCdn(r.avatar) || undefined,
        ecScore: r.ecScore,
        category: r.category || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: items.length,
        range,
        availableRegions,
        effectiveRankingCycle: rankingCycle,
        availableSorts: CREATOR_RANK_FIELDS,
        currentSort: sort,
      },
    });
  } catch (error) {
    console.error("Error fetching creators:", error);
    return NextResponse.json({
      success: true,
      data: { items: [], total: 0, error: String(error) },
    });
  }
}
