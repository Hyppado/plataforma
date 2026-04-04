/**
 * Tests: lib/transcription/service.ts
 *
 * Coverage: requestTranscript (sync flow: captions → download → whisper),
 *          getTranscript, processPendingTranscripts (cron retry)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@tests/helpers/prisma-mock";
import { prismaMock } from "@tests/helpers/prisma-mock";

// Mock the media and whisper modules
const {
  getVideoCaptionsMock,
  getVideoDownloadUrlMock,
  downloadVideoBufferMock,
  transcribeWithWhisperMock,
} = vi.hoisted(() => ({
  getVideoCaptionsMock: vi.fn(),
  getVideoDownloadUrlMock: vi.fn(),
  downloadVideoBufferMock: vi.fn(),
  transcribeWithWhisperMock: vi.fn(),
}));

vi.mock("@/lib/transcription/media", () => ({
  getVideoCaptions: getVideoCaptionsMock,
  getVideoDownloadUrl: getVideoDownloadUrlMock,
  downloadVideoBuffer: downloadVideoBufferMock,
}));

vi.mock("@/lib/transcription/whisper", () => ({
  transcribeWithWhisper: transcribeWithWhisperMock,
  isWhisperError: (result: unknown) =>
    result !== null &&
    typeof result === "object" &&
    "error" in (result as Record<string, unknown>),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  requestTranscript,
  getTranscript,
  processPendingTranscripts,
} from "@/lib/transcription/service";

describe("lib/transcription/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVideoCaptionsMock.mockResolvedValue(null);
    getVideoDownloadUrlMock.mockResolvedValue(null);
    downloadVideoBufferMock.mockResolvedValue(null);
    transcribeWithWhisperMock.mockResolvedValue({
      error: "API key not configured",
    });
  });

  // -----------------------------------------------------------------------
  // requestTranscript
  // -----------------------------------------------------------------------

  describe("requestTranscript", () => {
    it("returns existing READY transcript without reprocessing", async () => {
      const existing = {
        id: "t1",
        videoExternalId: "vid-123",
        status: "READY",
        transcriptText: "Hello world",
      };
      (
        prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existing);

      const result = await requestTranscript("vid-123", "user-1");

      expect(result.isNew).toBe(false);
      expect(result.status).toBe("READY");
      expect(result.transcriptText).toBe("Hello world");
      expect(prismaMock.videoTranscript.create).not.toHaveBeenCalled();
    });

    it("re-processes existing FAILED transcript", async () => {
      const existing = {
        id: "t-fail",
        videoExternalId: "vid-fail",
        status: "FAILED",
        transcriptText: null,
      };
      (
        prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existing);
      (
        prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "t-fail",
        videoExternalId: "vid-fail",
        status: "FAILED",
      });

      // No captions, no download URL → FAILED
      const result = await requestTranscript("vid-fail", "user-1");

      expect(result.status).toBe("FAILED");
      expect(prismaMock.videoTranscript.create).not.toHaveBeenCalled();
      // Should have been marked PROCESSING first
      expect(prismaMock.videoTranscript.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "t-fail" },
          data: expect.objectContaining({ status: "PROCESSING" }),
        }),
      );
    });

    it("creates record and returns READY via captions", async () => {
      (
        prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prismaMock.videoTranscript.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "t3",
        videoExternalId: "vid-789",
        status: "PENDING",
      });

      getVideoCaptionsMock.mockResolvedValue({
        text: "Caption text here",
        language: "pt",
        source: "echotik_captions",
      });

      (
        prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>
      ).mockImplementation(
        async ({
          data,
        }: {
          data: { status: string; transcriptText?: string };
        }) => ({
          id: "t3",
          videoExternalId: "vid-789",
          status: data.status,
          transcriptText: data.transcriptText ?? null,
        }),
      );

      const result = await requestTranscript("vid-789", "user-1");

      expect(result.status).toBe("READY");
      expect(result.transcriptText).toBe("Caption text here");
      expect(result.isNew).toBe(true);
      // Whisper should NOT have been called
      expect(getVideoDownloadUrlMock).not.toHaveBeenCalled();
      expect(transcribeWithWhisperMock).not.toHaveBeenCalled();
    });

    it("falls back to Whisper when captions unavailable", async () => {
      (
        prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prismaMock.videoTranscript.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "t4",
        videoExternalId: "vid-whisper",
        status: "PENDING",
      });

      getVideoCaptionsMock.mockResolvedValue(null);
      getVideoDownloadUrlMock.mockResolvedValue({
        playUrl: "https://example.com/play.mp4",
        downloadUrl: "https://example.com/dl.mp4",
        noWatermarkUrl: "https://example.com/nowm.mp4",
      });
      downloadVideoBufferMock.mockResolvedValue(Buffer.from("fake-video"));
      transcribeWithWhisperMock.mockResolvedValue({
        text: "Whisper transcription result",
        language: "en",
        duration: 30.5,
        segments: [{ start: 0, end: 10, text: "Whisper transcription result" }],
      });

      (
        prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>
      ).mockImplementation(
        async ({
          data,
        }: {
          data: { status: string; transcriptText?: string };
        }) => ({
          id: "t4",
          videoExternalId: "vid-whisper",
          status: data.status,
          transcriptText: data.transcriptText ?? null,
        }),
      );

      const result = await requestTranscript("vid-whisper", "user-1");

      expect(result.status).toBe("READY");
      expect(result.transcriptText).toBe("Whisper transcription result");
      expect(result.isNew).toBe(true);
      expect(getVideoDownloadUrlMock).toHaveBeenCalledWith("vid-whisper");
      expect(transcribeWithWhisperMock).toHaveBeenCalled();
    });

    it("returns FAILED when no captions and no download URL", async () => {
      (
        prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prismaMock.videoTranscript.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "t5",
        videoExternalId: "vid-nodl",
        status: "PENDING",
      });

      getVideoCaptionsMock.mockResolvedValue(null);
      getVideoDownloadUrlMock.mockResolvedValue(null);

      (
        prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "t5",
        videoExternalId: "vid-nodl",
        status: "FAILED",
      });

      const result = await requestTranscript("vid-nodl", "user-1");

      expect(result.status).toBe("FAILED");
      expect(result.transcriptText).toBeNull();
      expect(result.isNew).toBe(true);
    });

    it("returns FAILED when Whisper returns error", async () => {
      (
        prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prismaMock.videoTranscript.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "t6",
        videoExternalId: "vid-nowhisper",
        status: "PENDING",
      });

      getVideoCaptionsMock.mockResolvedValue(null);
      getVideoDownloadUrlMock.mockResolvedValue({
        playUrl: null,
        downloadUrl: "https://example.com/dl.mp4",
        noWatermarkUrl: null,
      });
      downloadVideoBufferMock.mockResolvedValue(Buffer.from("video-data"));
      transcribeWithWhisperMock.mockResolvedValue({
        error: "Whisper API error (401): Unauthorized",
      });

      (
        prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "t6",
        videoExternalId: "vid-nowhisper",
        status: "FAILED",
      });

      const result = await requestTranscript("vid-nowhisper", "user-1");

      expect(result.status).toBe("FAILED");
      expect(result.errorMessage).toBe("Whisper API error (401): Unauthorized");
    });
  });

  // -----------------------------------------------------------------------
  // getTranscript
  // -----------------------------------------------------------------------

  describe("getTranscript", () => {
    it("returns transcript info when found", async () => {
      const row = {
        videoExternalId: "vid-100",
        status: "READY",
        transcriptText: "Test",
        language: "en",
        durationSeconds: 120,
        readyAt: new Date(),
        createdAt: new Date(),
      };
      (
        prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(row);

      const result = await getTranscript("vid-100");

      expect(result).toEqual(row);
    });

    it("returns null when not found", async () => {
      (
        prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getTranscript("nonexistent");

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // processPendingTranscripts (cron retry)
  // -----------------------------------------------------------------------

  describe("processPendingTranscripts", () => {
    it("returns zero stats when no failed transcripts", async () => {
      (
        prismaMock.videoTranscript.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const stats = await processPendingTranscripts();

      expect(stats).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    });

    it("retries FAILED transcript with full pipeline (captions succeed)", async () => {
      (
        prismaMock.videoTranscript.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: "t10",
          videoExternalId: "vid-10",
          status: "FAILED",
          retryCount: 1,
        },
      ]);

      getVideoCaptionsMock.mockResolvedValue({
        text: "Caption from cron retry",
        language: "en",
        source: "echotik_captions",
      });

      (
        prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>
      ).mockImplementation(async ({ data }: { data: { status: string } }) => ({
        id: "t10",
        videoExternalId: "vid-10",
        status: data.status,
      }));

      const stats = await processPendingTranscripts();

      expect(stats.processed).toBe(1);
      expect(stats.succeeded).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it("retries FAILED transcript with Whisper fallback", async () => {
      (
        prismaMock.videoTranscript.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: "t11",
          videoExternalId: "vid-11",
          status: "FAILED",
          retryCount: 0,
        },
      ]);

      getVideoCaptionsMock.mockResolvedValue(null);
      getVideoDownloadUrlMock.mockResolvedValue({
        playUrl: null,
        downloadUrl: "https://example.com/dl.mp4",
        noWatermarkUrl: "https://example.com/nowm.mp4",
      });
      downloadVideoBufferMock.mockResolvedValue(Buffer.from("video"));
      transcribeWithWhisperMock.mockResolvedValue({
        text: "Whisper from cron",
        language: "en",
        duration: 15,
        segments: [],
      });

      (
        prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>
      ).mockImplementation(async ({ data }: { data: { status: string } }) => ({
        id: "t11",
        videoExternalId: "vid-11",
        status: data.status,
      }));

      const stats = await processPendingTranscripts();

      expect(stats.processed).toBe(1);
      expect(stats.succeeded).toBe(1);
    });

    it("counts as failed when full pipeline fails", async () => {
      (
        prismaMock.videoTranscript.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: "t12",
          videoExternalId: "vid-12",
          status: "FAILED",
          retryCount: 2,
        },
      ]);

      getVideoCaptionsMock.mockResolvedValue(null);
      getVideoDownloadUrlMock.mockResolvedValue(null);

      (
        prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      const stats = await processPendingTranscripts();

      expect(stats.processed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });
});
