import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { VideoDTO } from "@/lib/types/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/trending/videos
 *
 * DB-first: reads from EchotikVideoTrendDaily.
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
      parseInt(searchParams.get("limit") || "50", 10),
      200,
    );
    const search = searchParams.get("search") || undefined;
    const region = (searchParams.get("region") || "US").toUpperCase();

    const requestedRankingCycle = range === "1d" ? 1 : range === "7d" ? 2 : 3;
    const cycleCandidates: Array<1 | 2 | 3> =
      range === "1d" ? [1] : range === "7d" ? [2, 1] : [3, 2, 1];

    // Find the most recent snapshot for the best available cycle
    let latest: { date: Date } | null = null;
    let rankingCycle = requestedRankingCycle;
    for (const cycle of cycleCandidates) {
      const candidate = await prisma.echotikVideoTrendDaily.findFirst({
        where: { country: region, rankingCycle: cycle },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      if (candidate) {
        latest = candidate;
        rankingCycle = cycle;
        break;
      }
    }

    // Available regions (for frontend filter population)
    const availableRegionsRaw = await prisma.echotikVideoTrendDaily.findMany({
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
    };
    if (search) {
      const q = search.toLowerCase();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { authorName: { contains: q, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.echotikVideoTrendDaily.findMany({
      where,
      orderBy: { saleCount: "desc" },
      take: limit,
    });

    const items: VideoDTO[] = rows.map((r) => {
      const extra = r.extra as Record<string, unknown> | null;
      return {
        id: r.videoExternalId,
        title: r.title || "",
        duration: "0:00",
        creatorHandle: r.authorName ? `@${r.authorName}` : "",
        publishedAt: r.date.toISOString(),
        revenueBRL: Number(r.gmv) / 100,
        currency: r.currency,
        sales: Number(r.saleCount),
        views: Number(r.views),
        gpmBRL: 0,
        cpaBRL: 0,
        adRatio: 0,
        adCostBRL: 0,
        roas: 0,
        sourceUrl: "",
        tiktokUrl: `https://www.tiktok.com/@${r.authorName || "user"}/video/${r.videoExternalId}`,
        thumbnailUrl: `/api/proxy/image?videoId=${r.videoExternalId}`,
        dateRange: range,
        categoryId: r.categoryId ?? undefined,
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
      },
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json({
      success: true,
      data: { items: [], total: 0, range: "7d", error: "Failed to load" },
    });
  }
}
