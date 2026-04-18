import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxyIfEchotikCdn } from "@/lib/echotik/trending";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/trending/products/[id]");

export const dynamic = "force-dynamic";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface CoverUrlItem {
  url: string;
  index: number;
}

interface SpecificationItem {
  name: string;
  value: string;
}

export interface ProductDetailResponse {
  id: string;
  name: string;
  images: string[]; // sorted by index, blob-proxied
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  currency: string;
  commissionRate: number; // 0–100
  rating: number;
  reviewCount: number;
  freeShipping: boolean;
  category: string | null;
  salesTotal: number;
  sales7d: number;
  sales30d: number;
  sales90d: number;
  gmvTotal: number;
  gmv7d: number;
  gmv30d: number;
  videoCount: number;
  liveCount: number;
  creatorCount: number;
  salesTrend: 0 | 1 | 2; // 0=stable, 1=rising, 2=falling
  specification: SpecificationItem[];
  tiktokUrl: string;
  sourceUrl: string;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function safeParseJson<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return null;
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// --------------------------------------------------------------------------
// Route
// --------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const productId = params.id;

  try {
    const [detail, trend] = await Promise.all([
      prisma.echotikProductDetail.findUnique({
        where: { productExternalId: productId },
      }),
      prisma.echotikProductTrendDaily.findFirst({
        where: { productExternalId: productId },
        orderBy: { date: "desc" },
      }),
    ]);

    if (!detail && !trend) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Parse extra JSON from detail for rich fields
    const extra = safeParseJson<Record<string, unknown>>(detail?.extra ?? null);

    // Images — cover_url is a JSON string with [{url, index}]
    const coverItems = safeParseJson<CoverUrlItem[]>(
      extra?.cover_url ?? detail?.coverUrl ?? null,
    );
    const images: string[] = [];
    if (Array.isArray(coverItems)) {
      const sorted = [...coverItems].sort((a, b) => a.index - b.index);
      for (const item of sorted) {
        if (item.url) {
          const proxied = proxyIfEchotikCdn(item.url);
          if (proxied) images.push(proxied);
        }
      }
    }
    // Fallback to single cover
    if (images.length === 0 && detail?.blobUrl) images.push(detail.blobUrl);
    if (images.length === 0 && detail?.coverUrl) {
      const proxied = proxyIfEchotikCdn(detail.coverUrl);
      if (proxied) images.push(proxied);
    }

    // Specification
    const specification: SpecificationItem[] =
      safeParseJson<SpecificationItem[]>(extra?.specification ?? null) ?? [];

    // Resolve currency from trend row or extra
    const currency =
      trend?.currency ||
      (typeof extra?.currency === "string" ? extra.currency : "USD");

    // Sales & GMV — prefer extra (full payload), fallback to trend row
    const salesTotal = num(extra?.total_sale_cnt) || num(trend?.saleCount);
    const sales7d = num(extra?.total_sale_7d_cnt);
    const sales30d = num(extra?.total_sale_30d_cnt);
    const sales90d = num(extra?.total_sale_90d_cnt);

    // GMV from extra is in native currency (floats), trend.gmv is in cents
    const gmvTotal =
      num(extra?.total_sale_gmv_amt) || (trend ? Number(trend.gmv) / 100 : 0);
    const gmv7d = num(extra?.total_sale_gmv_7d_amt);
    const gmv30d = num(extra?.total_sale_gmv_30d_amt);

    const videoCount = num(extra?.total_video_cnt) || num(trend?.videoCount);
    const liveCount = num(extra?.total_live_cnt) || num(trend?.liveCount);
    const creatorCount =
      num(extra?.total_ifl_cnt) || num(trend?.influencerCount);

    const commissionRate = Number(
      detail?.commissionRate ?? extra?.product_commission_rate ?? 0,
    );

    const result: ProductDetailResponse = {
      id: productId,
      name:
        detail?.productName ||
        trend?.productName ||
        (typeof extra?.product_name === "string" ? extra.product_name : "") ||
        "",
      images,
      minPrice:
        detail?.minPrice != null
          ? Number(detail.minPrice) / 100 // EchotikProductDetail stores cents
          : Number(trend?.minPrice ?? 0), // EchotikProductTrendDaily stores raw float
      maxPrice:
        detail?.maxPrice != null
          ? Number(detail.maxPrice) / 100
          : Number(trend?.maxPrice ?? 0),
      avgPrice:
        detail?.avgPrice != null
          ? Number(detail.avgPrice) / 100
          : Number(trend?.avgPrice ?? 0),
      currency,
      commissionRate,
      rating: Number(detail?.rating ?? extra?.product_rating ?? 0),
      reviewCount: num(extra?.review_count),
      freeShipping: num(extra?.free_shipping) === 1,
      category: detail?.categoryId || trend?.categoryId || null,
      salesTotal,
      sales7d,
      sales30d,
      sales90d,
      gmvTotal,
      gmv7d,
      gmv30d,
      videoCount,
      liveCount,
      creatorCount,
      salesTrend: (num(extra?.sales_trend_flag) as 0 | 1 | 2) ?? 0,
      specification,
      tiktokUrl: `https://www.tiktok.com/view/product/${productId}`,
      sourceUrl: `https://echotik.live/products/${productId}`,
    };

    return NextResponse.json(result);
  } catch (err) {
    log.error("GET product detail failed", {
      productId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to load product details" },
      { status: 500 },
    );
  }
}
