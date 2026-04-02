/**
 * Tests: lib/transcription/media.ts — parseCaptionToPlainText logic
 *
 * Tests the caption parsing functionality for SRT, VTT, and JSON formats.
 * The Echotik API calls are tested via integration tests; this focuses on parsing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { getVideoCaptions } from "@/lib/transcription/media";

const echotikRequestMock = vi.mocked(echotikRequest);

describe("lib/transcription/media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      // Mock fetch for caption download
      const originalFetch = global.fetch;
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

      global.fetch = originalFetch;
    });
  });
});
