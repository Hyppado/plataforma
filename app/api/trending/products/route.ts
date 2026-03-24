import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PRODUCT_RANK_FIELDS,
  productSortToField,
} from "@/lib/echotik/rankFields";
import type { ProductDTO } from "@/lib/types/dto";

const ECHOTIK_CDN = "echosell-images.tos-ap-southeast-1.volces.com";

/** Wraps echosell-images URLs through the image proxy */
function proxyIfEchotikCdn(url: string | null): string {
  if (!url) return "";
  try {
    if (new URL(url).hostname === ECHOTIK_CDN) {
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}

export const dynamic = "force-dynamic";

/**
 * GET /api/trending/products
 *
 * DB-first: reads from EchotikProductTrendDaily.
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
    const rankField = productSortToField(sort);

    const requestedRankingCycle = range === "1d" ? 1 : range === "7d" ? 2 : 3;
    const cycleCandidates: Array<1 | 2 | 3> =
      range === "1d" ? [1] : range === "7d" ? [2, 1] : [3, 2, 1];

    // Find the most recent snapshot for the best available cycle
    let latest: { date: Date } | null = null;
    let rankingCycle = requestedRankingCycle;
    for (const cycle of cycleCandidates) {
      const candidate = await prisma.echotikProductTrendDaily.findFirst({
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
    const availableRegionsRaw = await prisma.echotikProductTrendDaily.findMany({
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
      where.OR = [{ productName: { contains: q, mode: "insensitive" } }];
    }

    const rows = await prisma.echotikProductTrendDaily.findMany({
      where,
      orderBy: { rankPosition: "asc" },
      take: limit,
    });

    // Batch-fetch product detail images from cache
    const productIds = rows.map((r) => r.productExternalId);
    const detailRows = await prisma.echotikProductDetail.findMany({
      where: { productExternalId: { in: productIds } },
      select: { productExternalId: true, coverUrl: true, rating: true },
    });
    const detailMap = new Map(detailRows.map((d) => [d.productExternalId, d]));

    const items: ProductDTO[] = rows.map((r) => {
      const detail = detailMap.get(r.productExternalId);
      return {
        id: r.productExternalId,
        name: r.productName || "",
        imageUrl: proxyIfEchotikCdn(detail?.coverUrl ?? null),
        category: r.categoryId ?? "",
        priceBRL: r.avgPrice,
        launchDate: r.date.toISOString(),
        rating: Number(detail?.rating ?? 0),
        sales: Number(r.saleCount),
        avgPriceBRL: r.avgPrice,
        commissionRate: r.commissionRate,
        revenueBRL: Number(r.gmv) / 100,
        liveRevenueBRL: 0,
        videoRevenueBRL: 0,
        mallRevenueBRL: 0,
        creatorCount: Number(r.influencerCount),
        creatorConversionRate: 0,
        sourceUrl: `https://echotik.live/products/${r.productExternalId}`,
        tiktokUrl: `https://www.tiktok.com/view/product/${r.productExternalId}`,
        dateRange: range,
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
        availableSorts: PRODUCT_RANK_FIELDS,
        currentSort: sort,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({
      success: true,
      data: { items: [], total: 0, error: String(error) },
    });
  }
}
