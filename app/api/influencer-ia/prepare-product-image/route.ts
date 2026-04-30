/**
 * app/api/influencer-ia/prepare-product-image/route.ts
 *
 * POST /api/influencer-ia/prepare-product-image
 *
 * Pre-fetches a product image (signing Echotik CDN URLs if needed), uploads
 * it to Vercel Blob, and returns a stable, fast-to-fetch blob URL.
 *
 * The Influencer IA generate endpoint then receives this blob URL instead of
 * the raw Echotik CDN URL — eliminating the cover-sign + CDN download time
 * from the synchronous Gemini generation path (which currently can push us
 * past Google's timeout).
 *
 * Body: { url: string }
 * Response: { blobUrl: string }
 *
 * Cached in-memory by source URL for the lifetime of the function instance.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import {
  isEchotikCdnUrl,
  signEchotikCoverUrl,
  uploadBufferToBlob,
} from "@/lib/storage/blob";
import { createHash } from "node:crypto";

const log = createLogger("api/influencer-ia/prepare-product-image");

/** Process-local cache: source URL → prepared blob URL. */
const blobCache = new Map<string, string>();

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  const sourceUrl = body.url?.trim();
  if (!sourceUrl) {
    return NextResponse.json({ error: "url é obrigatório" }, { status: 400 });
  }

  // Already a Vercel Blob URL — pass through.
  if (sourceUrl.includes(".public.blob.vercel-storage.com")) {
    return NextResponse.json({ blobUrl: sourceUrl });
  }

  // Cache hit — return immediately.
  const cached = blobCache.get(sourceUrl);
  if (cached) {
    return NextResponse.json({ blobUrl: cached });
  }

  try {
    // Resolve to a fetchable URL (sign if Echotik CDN).
    let fetchUrl = sourceUrl;
    if (isEchotikCdnUrl(sourceUrl)) {
      const signed = await signEchotikCoverUrl(sourceUrl);
      if (!signed) {
        return NextResponse.json(
          { error: "Falha ao assinar URL do produto" },
          { status: 502 },
        );
      }
      fetchUrl = signed;
    } else {
      // Only allow https for non-Echotik
      try {
        const parsed = new URL(sourceUrl);
        if (parsed.protocol !== "https:") {
          return NextResponse.json(
            { error: "Apenas URLs HTTPS são permitidas" },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json({ error: "URL inválida" }, { status: 400 });
      }
    }

    // Download the image bytes.
    const res = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Hyppado/1.0; +https://hyppado.com)",
        Accept: "image/webp,image/png,image/jpeg,image/*,*/*",
        Referer: "https://hyppado.com/",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Falha ao baixar imagem (${res.status})` },
        { status: 502 },
      );
    }

    const rawContentType = res.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "Imagem vazia" }, { status: 502 });
    }

    // Detect actual MIME type from magic bytes — CDNs sometimes return
    // "binary/octet-stream" or "application/octet-stream" even for images.
    // Only treat as generic binary when the primary MIME type (before params) is a binary type.
    const detectMimeType = (buf: Buffer): string => {
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
        return "image/jpeg";
      if (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      )
        return "image/png";
      if (buf[0] === 0x52 && buf[1] === 0x49 && buf[4] === 0x57)
        return "image/webp";
      if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46)
        return "image/gif";
      return "image/jpeg"; // safe fallback for Google AI
    };
    const primaryType = rawContentType.split(";")[0].trim().toLowerCase();
    const isGenericBinary =
      !primaryType ||
      primaryType === "application/octet-stream" ||
      primaryType === "binary/octet-stream" ||
      primaryType === "application/binary";
    const contentType = isGenericBinary ? detectMimeType(buffer) : primaryType;

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const hash = createHash("sha256")
      .update(sourceUrl)
      .digest("hex")
      .slice(0, 16);
    const blobPath = `influencer-ia/products/${hash}.${ext}`;

    const blobUrl = await uploadBufferToBlob(buffer, blobPath, contentType);
    if (!blobUrl) {
      return NextResponse.json(
        { error: "Falha ao salvar imagem" },
        { status: 502 },
      );
    }

    blobCache.set(sourceUrl, blobUrl);
    log.info("Product image prepared", {
      sourceHost: (() => {
        try {
          return new URL(sourceUrl).hostname;
        } catch {
          return "?";
        }
      })(),
      bytes: buffer.byteLength,
    });

    return NextResponse.json({ blobUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("prepare-product-image failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
