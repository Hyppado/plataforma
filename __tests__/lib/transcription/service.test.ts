/**
 * Tests: lib/transcription/service.ts
 *
 * Coverage: requestTranscript (new, existing, captions success/fail),
 *          getTranscript, processPendingTranscripts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@tests/helpers/prisma-mock";
import { prismaMock } from "@tests/helpers/prisma-mock";

// Mock the media module
const { getVideoCaptionsMock } = vi.hoisted(() => ({
  getVideoCaptionsMock: vi.fn(),
}));

vi.mock("@/lib/transcription/media", () => ({
  getVideoCaptions: getVideoCaptionsMock,
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
  });

  // -----------------------------------------------------------------------
  // requestTranscript
  // -----------------------------------------------------------------------

  describe("requestTranscript", () => {
    it("returns existing transcript without creating new one", async () => {
      const existing = {
        id: "t1",
        videoExternalId: "vid-123",
        status: "READY",
        transcriptText: "Hello world",
      };
      (prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const result = await requestTranscript("vid-123", "user-1");

      expect(result.isNew).toBe(false);
      expect(result.status).toBe("READY");
      expect(result.transcriptText).toBe("Hello world");
      expect(prismaMock.videoTranscript.create).not.toHaveBeenCalled();
    });

    it("creates PENDING record and tries captions", async () => {
      (prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prismaMock.videoTranscript.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t2",
        videoExternalId: "vid-456",
        status: "PENDING",
        requestedByUserId: "user-1",
      });

      // Captions not available
      getVideoCaptionsMock.mockResolvedValue(null);

      const result = await requestTranscript("vid-456", "user-1");

      expect(result.isNew).toBe(true);
      expect(result.status).toBe("PENDING");
      expect(result.transcriptText).toBeNull();
      expect(prismaMock.videoTranscript.create).toHaveBeenCalledWith({
        data: {
          videoExternalId: "vid-456",
          status: "PENDING",
          requestedByUserId: "user-1",
        },
      });
    });

    it("sets READY immediately when captions available", async () => {
      (prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prismaMock.videoTranscript.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t3",
        videoExternalId: "vid-789",
        status: "PENDING",
      });

      getVideoCaptionsMock.mockResolvedValue({
        text: "Caption text here",
        language: "pt",
        source: "echotik_captions",
      });

      (prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t3",
        videoExternalId: "vid-789",
        status: "READY",
        transcriptText: "Caption text here",
      });

      const result = await requestTranscript("vid-789", "user-1");

      expect(result.status).toBe("READY");
      expect(result.transcriptText).toBe("Caption text here");
      expect(result.isNew).toBe(true);
      expect(prismaMock.videoTranscript.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "t3" },
          data: expect.objectContaining({
            status: "READY",
            transcriptText: "Caption text here",
            language: "pt",
            source: "echotik_captions",
          }),
        }),
      );
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
      (prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(row);

      const result = await getTranscript("vid-100");

      expect(result).toEqual(row);
    });

    it("returns null when not found", async () => {
      (prismaMock.videoTranscript.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getTranscript("nonexistent");

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // processPendingTranscripts
  // -----------------------------------------------------------------------

  describe("processPendingTranscripts", () => {
    it("returns zero stats when no pending transcripts", async () => {
      (prismaMock.videoTranscript.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const stats = await processPendingTranscripts();

      expect(stats).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    });

    it("processes pending transcript with successful captions", async () => {
      (prismaMock.videoTranscript.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "t10", videoExternalId: "vid-10", status: "PENDING", retryCount: 0 },
      ]);

      getVideoCaptionsMock.mockResolvedValue({
        text: "Caption from cron",
        language: "en",
        source: "echotik_captions",
      });

      (prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const stats = await processPendingTranscripts();

      expect(stats.processed).toBe(1);
      expect(stats.succeeded).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it("marks FAILED after max retries", async () => {
      (prismaMock.videoTranscript.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "t11", videoExternalId: "vid-11", status: "PENDING", retryCount: 2 },
      ]);

      getVideoCaptionsMock.mockResolvedValue(null);
      (prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const stats = await processPendingTranscripts();

      expect(stats.processed).toBe(1);
      expect(stats.failed).toBe(1);

      // Check that the second update call (after PROCESSING) sets FAILED
      const updateCalls = (prismaMock.videoTranscript.update as ReturnType<typeof vi.fn>).mock.calls;
      const failedCall = updateCalls.find(
        (call: unknown[]) => (call[0] as { data: { status: string } }).data.status === "FAILED",
      );
      expect(failedCall).toBeTruthy();
    });
  });
});
