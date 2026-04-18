import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxyIfEchotikCdn } from "@/lib/echotik/trending";
import { newProductDateWindow } from "@/lib/echotik/dates";
import type { ProductDTO } from "@/lib/types/dto";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/trending/new-products");

export const dynamic = "force-dynamic";

/**
 * GET /api/trending/new-products
 *
 * Returns products first crawled by Echotik in the last 3 days.
 * Data comes from EchotikProductDetail.firstCrawlDt (populated by syncNewProducts cron).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const region = (searchParams.get("region") || "US").toUpperCase();
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get("pageSize") || "24", 10), 1),
      100,
    );
    const daysBack = Math.min(
      Math.max(parseInt(searchParams.get("days") || "3", 10), 1),
      30,
    );

    const { min } = newProductDateWindow(daysBack);
    const minDt = parseInt(min, 10);

    const where = {
      firstCrawlDt: { gte: minDt },
      region: region,
    };

    const [rows, total] = await Promise.all([
      prisma.echotikProductDetail.findMany({
        where,
        orderBy: { firstCrawlDt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.echotikProductDetail.count({ where }),
    ]);

    const items: ProductDTO[] = rows.map((r) => ({
      id: r.productExternalId,
      name: r.productName || "",
      imageUrl: r.blobUrl || proxyIfEchotikCdn(r.coverUrl ?? null),
      category: r.categoryId ?? "",
      priceBRL: Number(r.avgPrice) / 100,
      launchDate: r.fetchedAt.toISOString(),
      isNew: true,
      rating: Number(r.rating ?? 0),
      sales: 0,
      avgPriceBRL: Number(r.avgPrice) / 100,
      commissionRate: Number(r.commissionRate ?? 0),
      revenueBRL: 0,
      liveRevenueBRL: 0,
      videoRevenueBRL: 0,
      mallRevenueBRL: 0,
      currency: "USD",
      creatorCount: 0,
      creatorConversionRate: 0,
      sourceUrl: `https://echotik.live/products/${r.productExternalId}`,
      tiktokUrl: `https://www.tiktok.com/view/product/${r.productExternalId}`,
      dateRange: `${daysBack}d`,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
        range: `${daysBack}d`,
        availableRegions: ["US"],
      },
    });
  } catch (err) {
    log.error("Failed to fetch new products", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch new products" },
      { status: 500 },
    );
  }
}
