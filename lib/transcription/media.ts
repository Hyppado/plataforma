/**
 * lib/transcription/media.ts
 *
 * Retrieves video captions/subtitles from Echotik API.
 * The primary source is the `/realtime/video/captions` endpoint
 * which returns subtitle URLs and data for TikTok videos.
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
