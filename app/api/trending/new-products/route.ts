import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxyIfEchotikCdn } from "@/lib/echotik/trending";
import type { ProductDTO } from "@/lib/types/dto";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/trending/new-products");

export const dynamic = "force-dynamic";

/**
 * GET /api/trending/new-products
 *
 * Returns all products currently in EchotikProductDetail for the given region.
 * The cron (syncNewProducts) is responsible for keeping only the most recent
 * window of new products in the table — this route just serves whatever is there.
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

    const where = { region };

    const [rows, total] = await Promise.all([
      prisma.echotikProductDetail.findMany({
        where,
        orderBy: { fetchedAt: "desc" },
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
      dateRange: "new",
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
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
