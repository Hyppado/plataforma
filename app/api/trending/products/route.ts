import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PRODUCT_RANK_FIELDS,
  productSortToField,
} from "@/lib/echotik/rankFields";
import {
  proxyIfEchotikCdn,
  rangeToCycles,
  resolveCycleAndDate,
  getAvailableRegions,
} from "@/lib/echotik/trending";
import type { ProductDTO } from "@/lib/types/dto";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/trending/products");

export const dynamic = "force-dynamic";

/**
 * GET /api/trending/products
 *
 * DB-first: reads from EchotikProductTrendDaily.
 * Returns empty array when DB is empty (cron hasn't run yet).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") || "7d") as "1d" | "7d" | "30d";
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get("pageSize") || "24", 10), 1),
      100,
    );
    const search = searchParams.get("search") || undefined;
    const region = (searchParams.get("region") || "US").toUpperCase();
    const sort = searchParams.get("sort") || "sales";
    const rankField = productSortToField(sort);

    const { candidates } = rangeToCycles(range);

    const { latest, rankingCycle } = await resolveCycleAndDate({
      model: "product",
      region,
      rankField,
      candidates,
    });

    const availableRegions = await getAvailableRegions("product");

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
      where.OR = [{ productName: { contains: q, mode: "insensitive" } }];
    }

    const [rows, total] = await Promise.all([
      prisma.echotikProductTrendDaily.findMany({
        where,
        orderBy: { rankPosition: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.echotikProductTrendDaily.count({ where }),
    ]);

    // Batch-fetch product detail images from cache
    const productIds = rows.map((r) => r.productExternalId);
    const detailRows = await prisma.echotikProductDetail.findMany({
      where: { productExternalId: { in: productIds } },
      select: {
        productExternalId: true,
        coverUrl: true,
        rating: true,
        blobUrl: true,
      },
    });
    const detailMap = new Map(detailRows.map((d) => [d.productExternalId, d]));

    const items: ProductDTO[] = rows.map((r) => {
      const detail = detailMap.get(r.productExternalId);
      return {
        id: r.productExternalId,
        name: r.productName || "",
        imageUrl:
          detail?.blobUrl || proxyIfEchotikCdn(detail?.coverUrl ?? null),
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
        currency: r.currency,
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
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
        range,
        availableRegions,
        effectiveRankingCycle: rankingCycle,
        availableSorts: PRODUCT_RANK_FIELDS,
        currentSort: sort,
      },
    });
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 },
    );
  }
}
