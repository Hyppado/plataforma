import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/proxy/image?videoId=<tiktokVideoId>
 *
 * Busca o thumbnail via TikTok oEmbed (que retorna URL assinada pública)
 * e redireciona o browser diretamente para ela.
 *
 * O CDN EchoTik (echosell-images.tos-ap-southeast-1.volces.com) bloqueia
 * acesso público externo (403 AccessDenied). A oEmbed do TikTok retorna
 * URLs assinadas válidas por meses, que funcionam diretamente no browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId || !/^\d+$/.test(videoId)) {
    return new NextResponse("Missing or invalid videoId", { status: 400 });
  }

  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/video/${videoId}`;
    const res = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 * 12 }, // cache for 12 hours
    });

    if (!res.ok) {
      console.warn(
        `[image-proxy] oEmbed returned ${res.status} for videoId=${videoId}`,
      );
      return new NextResponse(null, { status: 404 });
    }

    const data = (await res.json()) as { thumbnail_url?: string };
    const thumbnailUrl = data.thumbnail_url;

    if (!thumbnailUrl) {
      return new NextResponse("No thumbnail in oEmbed response", {
        status: 404,
      });
    }

    // Redirect the browser to the signed TikTok CDN URL.
    // Signed URLs from oEmbed typically expire in several months.
    return NextResponse.redirect(thumbnailUrl, {
      status: 302,
      headers: {
        // Tell the browser to cache this redirect for 6 hours
        "Cache-Control": "public, max-age=21600",
      },
    });
  } catch (err) {
    console.error("[image-proxy] oEmbed fetch error:", err);
    return new NextResponse("Upstream error", { status: 502 });
  }
}
