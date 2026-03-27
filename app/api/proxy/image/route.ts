import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { echotikRequest } from "@/lib/echotik/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/proxy/image");

/** Host do CDN EchoTik que requer URLs assinadas */
const ECHOTIK_CDN_HOST = "echosell-images.tos-ap-southeast-1.volces.com";

/** Cache em memória: coverUrl original → URL assinada + expiração */
const signedUrlCache = new Map<
  string,
  { signedUrl: string; expiresAt: number }
>();

/** TTL do cache local — 12h (URLs assinadas valem 24-72h) */
const SIGNED_URL_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * GET /api/proxy/image?url=<encodedImageUrl>
 * GET /api/proxy/image?videoId=<tiktokVideoId>
 *
 * Modo 1 (url): Obtém URL assinada via EchoTik batch/cover/download e faz proxy
 * Modo 2 (videoId): Busca thumbnail via TikTok oEmbed (legacy)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = new URL(request.url);

  // --- Mode 1: EchoTik cover image proxy via ?url= ---
  const imageUrl = searchParams.get("url");
  if (imageUrl) {
    return proxyEchotikImage(imageUrl);
  }

  // --- Mode 2: TikTok oEmbed via ?videoId= (legacy) ---
  const videoId = searchParams.get("videoId");
  if (videoId && /^\d+$/.test(videoId)) {
    return proxyTikTokOembed(videoId);
  }

  return new NextResponse("Missing url or videoId parameter", { status: 400 });
}

/**
 * Obtém URL assinada do EchoTik batch/cover/download e faz proxy da imagem.
 * Usa cache em memória para evitar chamadas repetidas à API.
 */
async function proxyEchotikImage(coverUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(coverUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  // Só permite URLs do CDN EchoTik
  if (parsed.hostname !== ECHOTIK_CDN_HOST) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  try {
    // 1. Verificar cache em memória
    const cached = signedUrlCache.get(coverUrl);
    let signedUrl: string;

    if (cached && cached.expiresAt > Date.now()) {
      signedUrl = cached.signedUrl;
    } else {
      // 2. Chamar batch/cover/download para obter URL assinada
      signedUrl = await getSignedCoverUrl(coverUrl);

      // 3. Cachear URL assinada
      signedUrlCache.set(coverUrl, {
        signedUrl,
        expiresAt: Date.now() + SIGNED_URL_TTL_MS,
      });
    }

    // 4. Fazer proxy da imagem assinada
    const upstream = await fetch(signedUrl, {
      next: { revalidate: 43200 }, // Next.js data cache: 12h
    });

    if (!upstream.ok) {
      // URL assinada expirou — limpar cache e tentar novamente
      if (upstream.status === 403) {
        signedUrlCache.delete(coverUrl);
        const freshUrl = await getSignedCoverUrl(coverUrl);
        signedUrlCache.set(coverUrl, {
          signedUrl: freshUrl,
          expiresAt: Date.now() + SIGNED_URL_TTL_MS,
        });

        const retry = await fetch(freshUrl);
        if (!retry.ok) {
          return new NextResponse(null, { status: retry.status });
        }

        return buildImageResponse(retry);
      }

      return new NextResponse(null, { status: upstream.status });
    }

    return buildImageResponse(upstream);
  } catch (err) {
    log.error("Upstream error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse("Upstream error", { status: 502 });
  }
}

/** Chama a API batch/cover/download para obter URLs assinadas temporárias */
async function getSignedCoverUrl(coverUrl: string): Promise<string> {
  interface CoverDownloadResponse {
    code: number;
    message: string;
    data: Array<Record<string, string>>;
  }

  const result = await echotikRequest<CoverDownloadResponse>(
    "/api/v3/echotik/batch/cover/download",
    { params: { cover_urls: coverUrl } },
  );

  if (
    result.code !== 0 ||
    !Array.isArray(result.data) ||
    result.data.length === 0
  ) {
    throw new Error(
      `[image-proxy] batch/cover/download failed: ${result.message}`,
    );
  }

  // data é um array de { sourceUrl: signedUrl }
  const entry = result.data[0];
  const signedUrl = Object.values(entry)[0];

  if (!signedUrl) {
    throw new Error("[image-proxy] No signed URL returned");
  }

  return signedUrl;
}

/** Constrói a resposta de imagem com headers de cache */
function buildImageResponse(upstream: Response): NextResponse {
  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const body = upstream.body;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=43200", // 12h (dentro da validade da URL assinada)
    },
  });
}

/** Legacy: fetch TikTok thumbnail via oEmbed and redirect */
async function proxyTikTokOembed(videoId: string) {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/video/${videoId}`;
    const res = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 * 12 },
    });

    if (!res.ok) {
      log.warn("oEmbed returned non-OK status", {
        status: res.status,
        videoId,
      });
      return new NextResponse(null, { status: 404 });
    }

    const data = (await res.json()) as { thumbnail_url?: string };
    const thumbnailUrl = data.thumbnail_url;

    if (!thumbnailUrl) {
      return new NextResponse("No thumbnail in oEmbed response", {
        status: 404,
      });
    }

    return NextResponse.redirect(thumbnailUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=21600",
      },
    });
  } catch (err) {
    log.error("oEmbed fetch error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse("Upstream error", { status: 502 });
  }
}
