/**
 * lib/transcription/whisper.ts
 *
 * OpenAI Whisper integration for video transcription.
 * Server-side only — the API key never reaches the browser.
 *
 * Uses the Audio API with the Whisper model to transcribe audio
 * from a provided audio/video buffer.
 */

import { getSecretSetting, getSetting, SETTING_KEYS } from "@/lib/settings";
import { createLogger } from "@/lib/logger";

const log = createLogger("transcription/whisper");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

export interface WhisperResult {
  text: string;
  language: string;
  duration: number;
  segments: WhisperSegment[];
}

export interface WhisperError {
  error: string;
}

export function isWhisperError(
  result: WhisperResult | WhisperError,
): result is WhisperError {
  return "error" in result;
}

// ---------------------------------------------------------------------------
// Whisper transcription
// ---------------------------------------------------------------------------

/**
 * Transcribes an audio buffer using OpenAI Whisper API.
 *
 * @param audioBuffer - Raw audio/video file buffer
 * @param filename    - Filename hint (e.g. "video.mp4") for mime type inference
 * @returns Transcription result or null on failure
 */
export async function transcribeWithWhisper(
  audioBuffer: Buffer,
  filename: string = "audio.mp4",
): Promise<WhisperResult | WhisperError> {
  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    log.error("OpenAI API key not configured");
    return { error: "OpenAI API key not configured in settings" };
  }

  const model =
    (await getSetting(SETTING_KEYS.OPENAI_WHISPER_MODEL)) ?? "whisper-1";
  const languageSetting =
    (await getSetting(SETTING_KEYS.OPENAI_WHISPER_LANGUAGE)) ?? "auto";

  // Build multipart form data
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], {
    type: getMimeType(filename),
  });
  formData.append("file", blob, filename);
  formData.append("model", model);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  // Only set language if not "auto" — let Whisper detect when auto
  if (languageSetting !== "auto") {
    formData.append("language", languageSetting);
  }

  log.info("Sending to Whisper API", {
    model,
    language: languageSetting,
    sizeBytes: audioBuffer.length,
  });

  try {
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(120_000), // 2 min timeout for large files
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      log.error("Whisper API error", {
        status: response.status,
        body: errorText.slice(0, 300),
      });
      return {
        error: `Whisper API error (${response.status}): ${errorText.slice(0, 200)}`,
      };
    }

    const data = await response.json();

    const segments: WhisperSegment[] = (data.segments ?? []).map(
      (seg: { start: number; end: number; text: string }) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text?.trim() ?? "",
      }),
    );

    return {
      text: data.text?.trim() ?? "",
      language: data.language ?? "unknown",
      duration: data.duration ?? 0,
      segments,
    };
  } catch (error) {
    log.error("Whisper transcription failed", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return {
      error:
        error instanceof Error ? error.message : "Whisper transcription failed",
    };
  }
}

/**
 * Infers mime type from filename extension.
 */
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    m4a: "audio/mp4",
    wav: "audio/wav",
    webm: "audio/webm",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  return mimeMap[ext ?? ""] ?? "application/octet-stream";
}
