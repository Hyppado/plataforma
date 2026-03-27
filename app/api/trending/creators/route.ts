import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_RANK_FIELDS,
  creatorSortToField,
} from "@/lib/echotik/rankFields";
import {
  proxyIfEchotikCdn,
  rangeToCycles,
  resolveCycleAndDate,
  getAvailableRegions,
} from "@/lib/echotik/trending";
import type { CreatorDTO } from "@/lib/types/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/trending/creators
 *
 * DB-first: reads from EchotikCreatorTrendDaily.
 * Returns empty array when DB is empty (cron hasn't run yet).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") || "7d") as
      | "1d"
      | "7d"
      | "30d"
      | "90d";
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get("pageSize") || "24", 10), 1),
      100,
    );
    const search = searchParams.get("search") || undefined;
    const region = (searchParams.get("region") || "US").toUpperCase();
    const sort = searchParams.get("sort") || "sales";
    const rankField = creatorSortToField(sort);

    const { candidates } = rangeToCycles(range);

    const { latest, rankingCycle } = await resolveCycleAndDate({
      model: "creator",
      region,
      rankField,
      candidates,
    });

    const availableRegions = await getAvailableRegions("creator");

    if (!latest) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
          page,
          pageSize,
          hasMore: false,
          range,
          availableRegions,
        },
      });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      date: latest,
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

    const [rows, total] = await Promise.all([
      prisma.echotikCreatorTrendDaily.findMany({
        where,
        orderBy: { rankPosition: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.echotikCreatorTrendDaily.count({ where }),
    ]);

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
        likes: Number(r.diggCount),
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
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
        range,
        availableRegions,
        effectiveRankingCycle: rankingCycle,
        availableSorts: CREATOR_RANK_FIELDS,
        currentSort: sort,
      },
    });
  } catch (error) {
    console.error("Error fetching creators:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load creators" },
      { status: 500 },
    );
  }
}
