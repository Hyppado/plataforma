/**
 * GET /api/influencer-ia/product-images?productId=XXX
 *
 * Returns all cover image URLs for a product from the cached EchotikProductDetail.
 * Used to populate the variation picker in the Influencer IA wizard.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/influencer-ia/product-images");

interface CoverUrlItem {
  url?: string;
  index?: number;
}

function parseCoverUrls(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return (arr as CoverUrlItem[])
      .filter((item) => typeof item.url === "string" && item.url)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((item) => item.url as string);
  } catch {
    if (raw.startsWith("http")) return [raw];
    return [];
  }
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json(
        { error: "productId é obrigatório." },
        { status: 400 },
      );
    }

    const detail = await prisma.echotikProductDetail.findUnique({
      where: { productExternalId: productId },
      select: { coverUrl: true, blobUrl: true, extra: true },
    });

    if (!detail) {
      return NextResponse.json({ images: [], rawImages: [] });
    }

    // The raw cover_url JSON string is stored in extra.cover_url
    const extra = detail.extra as Record<string, unknown> | null;
    const rawCoverUrl = extra?.cover_url as unknown;
    let rawImages = parseCoverUrls(rawCoverUrl);

    // Fallback: use the extracted single URL if JSON parsing yielded nothing
    if (rawImages.length === 0) {
      const fallback = detail.blobUrl ?? detail.coverUrl;
      if (fallback) rawImages = [fallback];
    }

    // Replace the first raw URL with the blobUrl if available (served faster from Vercel Blob)
    if (detail.blobUrl && rawImages.length > 0) {
      rawImages[0] = detail.blobUrl;
    }

    // Wrap non-blob URLs in the image proxy so the browser can load them
    const BLOB_HOST = "public.blob.vercel-storage.com";
    const images = rawImages.map((url) => {
      try {
        const { hostname } = new URL(url);
        if (hostname.endsWith(BLOB_HOST)) return url; // already a public blob URL
      } catch {
        return url;
      }
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    });

    log.info("product-images fetched", { productId, count: images.length });

    // rawImages: absolute URLs usable server-side (for generate API)
    // images: display URLs (proxied where necessary for the browser)
    return NextResponse.json({ images, rawImages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("product-images failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
