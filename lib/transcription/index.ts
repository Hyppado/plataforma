/**
 * lib/transcription/index.ts
 *
 * Public re-exports for the transcription module.
 */

export {
  requestTranscript,
  getTranscript,
  processPendingTranscripts,
} from "./service";
export type { RequestTranscriptResult, TranscriptInfo } from "./service";
export {
  getVideoCaptions,
  getVideoDownloadUrl,
  downloadVideoBuffer,
  parseCaptionToPlainText,
} from "./media";
export type { CaptionResult, VideoDownloadUrls } from "./media";
export { transcribeWithWhisper, isWhisperError } from "./whisper";
export type { WhisperResult, WhisperSegment, WhisperError } from "./whisper";
