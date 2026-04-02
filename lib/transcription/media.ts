/**
 * lib/transcription/media.ts
 *
 * Retrieves video captions/subtitles and download URLs from Echotik API.
 *
 * Two Echotik endpoints are used:
 * - `/realtime/video/captions` — returns subtitle text (fast, free)
 * - `/realtime/video/download-url` — returns video file URLs for Whisper fallback
 *
 * All media access is server-side only — never expose URLs to the browser.
 */

import { echotikRequest } from "@/lib/echotik/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("transcription/media");

// ---------------------------------------------------------------------------
// Types — Echotik caption response
// ---------------------------------------------------------------------------

interface EchotikCaptionItem {
  lang: string;
  url: string;
  format?: string;
  expire?: number;
}

interface EchotikCaptionResponse {
  code: number;
  msg: string;
  data?: {
    captions?: EchotikCaptionItem[];
    video_url?: string;
  };
}

export interface CaptionResult {
  /** Subtitle text content (from caption URL) */
  text: string;
  /** Detected language code (e.g. "pt", "en") */
  language: string;
  /** Source method used */
  source: "echotik_captions";
}

// ---------------------------------------------------------------------------
// Types — Echotik download-url response
// ---------------------------------------------------------------------------

interface EchotikDownloadUrlResponse {
  code: number;
  message?: string;
  msg?: string;
  data?: {
    play_url?: string;
    download_url?: string;
    no_watermark_download_url?: string;
    cover_url?: string;
    dynamic_cover_url?: string;
    video_id?: string;
  };
}

export interface VideoDownloadUrls {
  playUrl: string | null;
  downloadUrl: string | null;
  noWatermarkUrl: string | null;
}

// ---------------------------------------------------------------------------
// Caption retrieval
// ---------------------------------------------------------------------------

/**
 * Attempts to retrieve captions/subtitles for a video.
 * Returns the caption text and language, or null if unavailable.
 *
 * Strategy:
 * 1. Call Echotik `/realtime/video/captions` for subtitle data
 * 2. Download and parse the subtitle content
 */
export async function getVideoCaptions(
  videoExternalId: string,
): Promise<CaptionResult | null> {
  try {
    const response = await echotikRequest<EchotikCaptionResponse>(
      `/realtime/video/captions?video_id=${encodeURIComponent(videoExternalId)}`,
    );

    if (
      response.code !== 0 ||
      !response.data?.captions?.length
    ) {
      log.info("No captions available from Echotik", {
        videoExternalId,
        code: response.code,
        msg: response.msg,
      });
      return null;
    }

    // Prefer Portuguese, then English, then first available
    const captions = response.data.captions;
    const preferred =
      captions.find((c) => c.lang?.startsWith("pt")) ??
      captions.find((c) => c.lang?.startsWith("en")) ??
      captions[0];

    if (!preferred?.url) {
      log.info("Caption found but no URL", { videoExternalId });
      return null;
    }

    // Download caption content
    const captionText = await downloadCaptionContent(preferred.url);
    if (!captionText) return null;

    return {
      text: captionText,
      language: preferred.lang ?? "unknown",
      source: "echotik_captions",
    };
  } catch (error) {
    log.error("Failed to retrieve captions", {
      videoExternalId,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Video download URL retrieval
// ---------------------------------------------------------------------------

/**
 * Gets the video download URLs from Echotik.
 * Uses the `/realtime/video/download-url` endpoint with a constructed TikTok URL.
 */
export async function getVideoDownloadUrl(
  videoExternalId: string,
): Promise<VideoDownloadUrls | null> {
  try {
    const tiktokUrl = `https://www.tiktok.com/@user/video/${videoExternalId}`;

    const response = await echotikRequest<EchotikDownloadUrlResponse>(
      "/realtime/video/download-url",
      { params: { url: tiktokUrl }, timeout: 20_000 },
    );

    if (response.code !== 0 || !response.data) {
      log.info("No download URL from Echotik", {
        videoExternalId,
        code: response.code,
      });
      return null;
    }

    const { play_url, download_url, no_watermark_download_url } = response.data;

    if (!play_url && !download_url && !no_watermark_download_url) {
      log.info("Download URL response empty", { videoExternalId });
      return null;
    }

    return {
      playUrl: play_url ?? null,
      downloadUrl: download_url ?? null,
      noWatermarkUrl: no_watermark_download_url ?? null,
    };
  } catch (error) {
    log.error("Failed to get download URL", {
      videoExternalId,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Video file download
// ---------------------------------------------------------------------------

/**
 * Downloads a video file from a URL and returns it as a Buffer.
 * Uses the best available URL (no-watermark preferred).
 *
 * Max size: 25 MB (Whisper API limit).
 */
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25 MB

export async function downloadVideoBuffer(
  urls: VideoDownloadUrls,
): Promise<Buffer | null> {
  const url = urls.noWatermarkUrl ?? urls.downloadUrl ?? urls.playUrl;
  if (!url) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      log.error("Video download HTTP error", { status: response.status });
      return null;
    }

    // Check Content-Length before downloading
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_VIDEO_SIZE) {
      log.info("Video too large for Whisper", { sizeBytes: contentLength });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_VIDEO_SIZE) {
      log.info("Video too large for Whisper", { sizeBytes: arrayBuffer.byteLength });
      return null;
    }

    log.info("Video downloaded", { sizeBytes: arrayBuffer.byteLength });
    return Buffer.from(arrayBuffer);
  } catch (error) {
    log.error("Video download failed", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return null;
  }
}

/**
 * Downloads caption file content and extracts plain text.
 * Supports common subtitle formats (SRT, VTT, JSON).
 */
async function downloadCaptionContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      log.error("Caption download failed", { status: response.status, url: url.slice(0, 100) });
      return null;
    }

    const raw = await response.text();
    return parseCaptionToPlainText(raw);
  } catch (error) {
    log.error("Caption download error", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return null;
  }
}

/**
 * Parses subtitle content (SRT/VTT/JSON) into plain text.
 */
function parseCaptionToPlainText(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try JSON format first (TikTok sometimes returns JSON subtitles)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      // Array of segments: [{text: "..."}, ...]
      if (Array.isArray(parsed)) {
        const text = parsed
          .map((seg: { text?: string }) => seg.text ?? "")
          .filter(Boolean)
          .join(" ");
        return text || null;
      }
      // Object with utterances or segments
      const segments = parsed.utterances ?? parsed.segments ?? parsed.captions;
      if (Array.isArray(segments)) {
        const text = segments
          .map((seg: { text?: string }) => seg.text ?? "")
          .filter(Boolean)
          .join(" ");
        return text || null;
      }
    } catch {
      // Not valid JSON, try other formats
    }
  }

  // SRT/VTT format — strip timing lines and sequence numbers
  const lines = trimmed.split("\n");
  const textLines = lines.filter((line) => {
    const l = line.trim();
    // Skip empty lines
    if (!l) return false;
    // Skip VTT header
    if (l === "WEBVTT" || l.startsWith("WEBVTT ")) return false;
    // Skip NOTE lines
    if (l.startsWith("NOTE")) return false;
    // Skip sequence numbers (just digits)
    if (/^\d+$/.test(l)) return false;
    // Skip timestamp lines (00:00:00,000 --> 00:00:01,000 or similar)
    if (/^\d{2}:\d{2}[:\.]?\d{0,2}[.,]?\d{0,3}\s*-->/.test(l)) return false;
    return true;
  });

  const text = textLines
    .map((l) => l.replace(/<[^>]+>/g, "").trim()) // strip HTML tags
    .filter(Boolean)
    .join(" ");

  return text || null;
}
