/**
 * lib/prompt-library/embed.ts
 *
 * Resolves a user-provided video URL or embed snippet into a normalised
 * playable source plus an optional thumbnail URL. Supports the most common
 * platforms used for short-form video references.
 *
 * Supported inputs:
 *  - YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID,
 *             youtube.com/embed/ID, full <iframe> embed
 *  - Vimeo:   vimeo.com/ID, player.vimeo.com/video/ID, full <iframe> embed
 *  - TikTok:  tiktok.com/@user/video/ID, vm.tiktok.com/SLUG
 *  - Instagram: instagram.com/reel/SLUG, instagram.com/p/SLUG
 *  - Direct file URLs (mp4/webm/mov) — typically Vercel Blob
 */

export type EmbedKind = "iframe" | "video";

export interface ResolvedEmbed {
  kind: EmbedKind;
  /** Final URL to drop into <iframe src> or <video src>. */
  src: string;
  /** Thumbnail URL when one can be derived statically. */
  thumbnail: string | null;
  /** Platform label, useful for placeholders/badges. */
  platform: "youtube" | "vimeo" | "tiktok" | "instagram" | "direct";
}

// ---------------------------------------------------------------------------
// Platform extractors
// ---------------------------------------------------------------------------

function getYouTubeId(value: string): string | null {
  if (!value) return null;
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
    /youtube\.com\/shorts\/([\w-]{11})/i,
    /youtube\.com\/embed\/([\w-]{11})/i,
    /youtube-nocookie\.com\/embed\/([\w-]{11})/i,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m) return m[1];
  }
  return null;
}

function getVimeoId(value: string): string | null {
  if (!value) return null;
  const m = value.match(
    /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i,
  );
  return m?.[1] ?? null;
}

function getTikTokId(value: string): string | null {
  if (!value) return null;
  const m = value.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  return m?.[1] ?? null;
}

function getInstagramSlug(value: string): string | null {
  if (!value) return null;
  const m = value.match(/instagram\.com\/(?:reel|p|tv)\/([\w-]+)/i);
  return m?.[1] ?? null;
}

function isDirectVideoUrl(value: string): boolean {
  if (!value) return false;
  // Match common video extensions, ignoring any query string.
  return /^https?:\/\/[^?#]+\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(value);
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export function resolveEmbed(
  value: string | null | undefined,
): ResolvedEmbed | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // YouTube
  const ytId = getYouTubeId(trimmed);
  if (ytId) {
    return {
      kind: "iframe",
      src: `https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&mute=1&controls=0&playsinline=1&playlist=${ytId}&modestbranding=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      platform: "youtube",
    };
  }

  // Vimeo
  const vimeoId = getVimeoId(trimmed);
  if (vimeoId) {
    return {
      kind: "iframe",
      src: `https://player.vimeo.com/video/${vimeoId}?badge=0&autopause=0&loop=1&autoplay=1&muted=1&background=1`,
      // vumbnail.com is a public free Vimeo thumbnail proxy
      thumbnail: `https://vumbnail.com/${vimeoId}.jpg`,
      platform: "vimeo",
    };
  }

  // TikTok
  const tiktokId = getTikTokId(trimmed);
  if (tiktokId) {
    return {
      kind: "iframe",
      src: `https://www.tiktok.com/embed/v2/${tiktokId}`,
      thumbnail: null,
      platform: "tiktok",
    };
  }

  // Instagram
  const igSlug = getInstagramSlug(trimmed);
  if (igSlug) {
    return {
      kind: "iframe",
      src: `https://www.instagram.com/p/${igSlug}/embed/`,
      thumbnail: null,
      platform: "instagram",
    };
  }

  // Direct file URL (Vercel Blob, etc.)
  if (isDirectVideoUrl(trimmed)) {
    return {
      kind: "video",
      src: trimmed,
      thumbnail: null,
      platform: "direct",
    };
  }

  // If the value looks like an http(s) URL we'll still try as a video tag —
  // some Vercel Blob URLs lack an extension.
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      kind: "video",
      src: trimmed,
      thumbnail: null,
      platform: "direct",
    };
  }

  return null;
}
