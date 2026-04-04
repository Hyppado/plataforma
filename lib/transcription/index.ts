/**
 * lib/transcription/index.ts
 *
 * Public re-exports for the transcription module.
 */

export {
  requestTranscript,
  getTranscript,
  processPendingTranscripts,
  detectHallucination,
} from "./service";
export type { RequestTranscriptResult, TranscriptInfo } from "./service";
export { getVideoDownloadUrl, downloadVideoBuffer } from "./media";
export type { VideoDownloadUrls } from "./media";
export { transcribeWithWhisper, isWhisperError } from "./whisper";
export type { WhisperResult, WhisperSegment, WhisperError } from "./whisper";
