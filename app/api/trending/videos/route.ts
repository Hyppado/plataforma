import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VIDEO_RANK_FIELDS, videoSortToField } from "@/lib/echotik/rankFields";
import {
  rangeToCycles,
  resolveCycleAndDate,
  getAvailableRegions,
} from "@/lib/echotik/trending";
import type { VideoDTO, ProductDTO } from "@/lib/types/dto";

export const dynamic = "force-dynamic";

/**
 * Extrai product IDs do campo extra.video_products de um vídeo.
 * Os IDs (ex: 1730657715722490842) excedem Number.MAX_SAFE_INTEGER,
 * então usamos regex ao invés de JSON.parse para evitar perda de precisão.
 */
function extractProductIds(extra: Record<string, unknown> | null): string[] {
  if (!extra?.video_products) return [];
  const raw = String(extra.video_products);
  const matches = raw.match(/\d{10,}/g);
  return matches ?? [];
}

/**
 * GET /api/trending/videos
 *
 * DB-first: reads from EchotikVideoTrendDaily.
 * Enriches each video with product data from EchotikProductDetail cache.
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
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get("pageSize") || "24", 10), 1),
      100,
    );
    const search = searchParams.get("search") || undefined;
    const region = (searchParams.get("region") || "US").toUpperCase();
    const sort = searchParams.get("sort") || "sales";
    const rankField = videoSortToField(sort);

    const { candidates } = rangeToCycles(range);

    const { latest, rankingCycle } = await resolveCycleAndDate({
      model: "video",
      region,
      rankField,
      candidates,
    });

    const availableRegions = await getAvailableRegions("video");

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
        { title: { contains: q, mode: "insensitive" } },
        { authorName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.echotikVideoTrendDaily.findMany({
        where,
        orderBy: { rankPosition: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.echotikVideoTrendDaily.count({ where }),
    ]);

    // Collect all product IDs from video extras for batch lookup
    const productIdSet = new Set<string>();
    for (const r of rows) {
      const extra = r.extra as Record<string, unknown> | null;
      for (const pid of extractProductIds(extra)) {
        productIdSet.add(pid);
      }
    }

    // Batch fetch product details from cache
    const productMap = new Map<
      string,
      {
        productExternalId: string;
        productName: string | null;
        coverUrl: string | null;
        avgPrice: unknown;
        minPrice: unknown;
        commissionRate: unknown;
        rating: unknown;
        categoryId: string | null;
      }
    >();

    if (productIdSet.size > 0) {
      const productDetails = await prisma.echotikProductDetail.findMany({
        where: { productExternalId: { in: Array.from(productIdSet) } },
        select: {
          productExternalId: true,
          productName: true,
          coverUrl: true,
          avgPrice: true,
          minPrice: true,
          commissionRate: true,
          rating: true,
          categoryId: true,
        },
      });
      for (const pd of productDetails) {
        productMap.set(pd.productExternalId, pd);
      }
    }

    const items: VideoDTO[] = rows.map((r) => {
      const extra = r.extra as Record<string, unknown> | null;

      // Build product DTO from cache if available
      const videoProductIds = extractProductIds(extra);
      let product: ProductDTO | undefined;
      if (videoProductIds.length > 0) {
        const pd = productMap.get(videoProductIds[0]);
        if (pd) {
          const price = Number(pd.avgPrice ?? pd.minPrice ?? 0) / 100;
          const rawImg = pd.coverUrl || "";
          const proxyImg = rawImg
            ? `/api/proxy/image?url=${encodeURIComponent(rawImg)}`
            : "";
          product = {
            id: pd.productExternalId,
            name: pd.productName || "Produto",
            imageUrl: proxyImg,
            category: pd.categoryId || "",
            priceBRL: price,
            launchDate: "",
            rating: Number(pd.rating ?? 0),
            sales: 0,
            avgPriceBRL: price,
            commissionRate: Number(pd.commissionRate ?? 0),
            revenueBRL: 0,
            liveRevenueBRL: 0,
            videoRevenueBRL: 0,
            mallRevenueBRL: 0,
            creatorCount: 0,
            creatorConversionRate: 0,
            sourceUrl: "",
            tiktokUrl: "",
            dateRange: range,
          };
        }
      }

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
        product,
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
        availableSorts: VIDEO_RANK_FIELDS,
        currentSort: sort,
      },
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load videos" },
      { status: 500 },
    );
  }
}
