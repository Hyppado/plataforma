/**
 * Tests: lib/transcription/media.ts
 *
 * Tests caption parsing, video download URL retrieval, and video buffer download.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/echotik/client", () => ({
  echotikRequest: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { echotikRequest } from "@/lib/echotik/client";
import {
  getVideoCaptions,
  getVideoDownloadUrl,
  downloadVideoBuffer,
} from "@/lib/transcription/media";

const echotikRequestMock = vi.mocked(echotikRequest);

describe("lib/transcription/media", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // -----------------------------------------------------------------------
  // getVideoCaptions
  // -----------------------------------------------------------------------

  describe("getVideoCaptions", () => {
    it("returns null when Echotik returns no captions", async () => {
      echotikRequestMock.mockResolvedValue({
        code: 0,
        msg: "success",
        data: { captions: [] },
      });

      const result = await getVideoCaptions("vid-1");
      expect(result).toBeNull();
    });

    it("returns null on non-zero code", async () => {
      echotikRequestMock.mockResolvedValue({
        code: 1,
        msg: "error",
        data: null,
      });

      const result = await getVideoCaptions("vid-2");
      expect(result).toBeNull();
    });

    it("returns null when API throws", async () => {
      echotikRequestMock.mockRejectedValue(new Error("Network error"));

      const result = await getVideoCaptions("vid-3");
      expect(result).toBeNull();
    });

    it("calls Echotik API with correct path", async () => {
      echotikRequestMock.mockResolvedValue({
        code: 0,
        msg: "success",
        data: { captions: [] },
      });

      await getVideoCaptions("vid-test-123");

      expect(echotikRequestMock).toHaveBeenCalledWith(
        "/realtime/video/captions?video_id=vid-test-123",
      );
    });

    it("prefers Portuguese captions", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Olá mundo"),
      }) as unknown as typeof fetch;

      echotikRequestMock.mockResolvedValue({
        code: 0,
        msg: "success",
        data: {
          captions: [
            { lang: "en", url: "https://example.com/en.srt" },
            { lang: "pt-BR", url: "https://example.com/pt.srt" },
          ],
        },
      });

      const result = await getVideoCaptions("vid-4");

      expect(result).not.toBeNull();
      expect(result?.language).toBe("pt-BR");
      expect(result?.text).toBe("Olá mundo");
    });
  });

  // -----------------------------------------------------------------------
  // getVideoDownloadUrl
  // -----------------------------------------------------------------------

  describe("getVideoDownloadUrl", () => {
    it("returns URLs when Echotik returns data", async () => {
      echotikRequestMock.mockResolvedValue({
        code: 0,
        data: {
          play_url: "https://example.com/play.mp4",
          download_url: "https://example.com/dl.mp4",
          no_watermark_download_url: "https://example.com/nowm.mp4",
        },
      });

      const result = await getVideoDownloadUrl("vid-dl-1");

      expect(result).toEqual({
        playUrl: "https://example.com/play.mp4",
        downloadUrl: "https://example.com/dl.mp4",
        noWatermarkUrl: "https://example.com/nowm.mp4",
      });

      expect(echotikRequestMock).toHaveBeenCalledWith(
        "/realtime/video/download-url",
        {
          params: { url: "https://www.tiktok.com/@user/video/vid-dl-1" },
          timeout: 20_000,
        },
      );
    });

    it("returns null on non-zero code", async () => {
      echotikRequestMock.mockResolvedValue({
        code: 1,
        data: null,
      });

      const result = await getVideoDownloadUrl("vid-dl-2");
      expect(result).toBeNull();
    });

    it("returns null when no URLs in response", async () => {
      echotikRequestMock.mockResolvedValue({
        code: 0,
        data: {},
      });

      const result = await getVideoDownloadUrl("vid-dl-3");
      expect(result).toBeNull();
    });

    it("returns null on API error", async () => {
      echotikRequestMock.mockRejectedValue(new Error("timeout"));

      const result = await getVideoDownloadUrl("vid-dl-4");
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // downloadVideoBuffer
  // -----------------------------------------------------------------------

  describe("downloadVideoBuffer", () => {
    it("downloads video using noWatermarkUrl first", async () => {
      const fakeBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": "100" }),
        arrayBuffer: () => Promise.resolve(fakeBuffer),
      }) as unknown as typeof fetch;

      const result = await downloadVideoBuffer({
        playUrl: "https://example.com/play.mp4",
        downloadUrl: "https://example.com/dl.mp4",
        noWatermarkUrl: "https://example.com/nowm.mp4",
      });

      expect(result).not.toBeNull();
      expect(result?.length).toBe(100);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/nowm.mp4",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("falls back to downloadUrl when noWatermarkUrl is null", async () => {
      const fakeBuffer = new ArrayBuffer(50);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": "50" }),
        arrayBuffer: () => Promise.resolve(fakeBuffer),
      }) as unknown as typeof fetch;

      await downloadVideoBuffer({
        playUrl: "https://example.com/play.mp4",
        downloadUrl: "https://example.com/dl.mp4",
        noWatermarkUrl: null,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/dl.mp4",
        expect.any(Object),
      );
    });

    it("returns null when all URLs are null", async () => {
      const result = await downloadVideoBuffer({
        playUrl: null,
        downloadUrl: null,
        noWatermarkUrl: null,
      });

      expect(result).toBeNull();
    });

    it("returns null when fetch fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        headers: new Headers(),
        status: 404,
      }) as unknown as typeof fetch;

      const result = await downloadVideoBuffer({
        playUrl: null,
        downloadUrl: null,
        noWatermarkUrl: "https://example.com/nowm.mp4",
      });

      expect(result).toBeNull();
    });
  });
});
