/**
 * Tests: lib/avatar-video/image-prompt.ts
 *
 * Coverage:
 *   - isImageGenerationError (type guard)
 *   - buildImagePromptText (pure function)
 *   - generateImageVariation (mocked prisma — DB interactions)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@tests/helpers/prisma-mock";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  buildAvatarVideoCreation,
  buildAvatarProfile,
  buildVideoScenario,
  buildAvatarVideoImageVariation,
} from "@tests/helpers/factories";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const { getSecretSettingMock, getSettingMock } = vi.hoisted(() => ({
  getSecretSettingMock: vi.fn(),
  getSettingMock: vi.fn(),
}));
vi.mock("@/lib/settings", () => ({
  getSecretSetting: getSecretSettingMock,
  getSetting: getSettingMock,
  SETTING_KEYS: {
    GOOGLE_AI_API_KEY: "google_ai.api_key",
    GOOGLE_AI_MODEL: "google_ai.model",
  },
}));

const { uploadImageToBlobMock, uploadBufferToBlobMock } = vi.hoisted(() => ({
  uploadImageToBlobMock: vi.fn(),
  uploadBufferToBlobMock: vi.fn(),
}));
vi.mock("@/lib/storage/blob", () => ({
  uploadImageToBlob: uploadImageToBlobMock,
  uploadBufferToBlob: uploadBufferToBlobMock,
}));

import {
  isImageGenerationError,
  buildImagePromptText,
  generateImageVariation,
} from "@/lib/avatar-video/image-prompt";

describe("lib/avatar-video/image-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: API key not configured — generateImageVariation falls through to FAILED
    getSecretSettingMock.mockResolvedValue(null);
    getSettingMock.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // isImageGenerationError
  // -------------------------------------------------------------------------

  describe("isImageGenerationError()", () => {
    it("returns true for error results", () => {
      expect(isImageGenerationError({ error: "Failed" })).toBe(true);
    });

    it("returns false for success results", () => {
      expect(
        isImageGenerationError({
          variationId: "var-1",
          blobUrl: "https://blob.test/img.jpg",
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // buildImagePromptText
  // -------------------------------------------------------------------------

  describe("buildImagePromptText()", () => {
    it("includes avatar name and description when avatar is set", () => {
      const creation = buildAvatarVideoCreation() as any;
      const avatar = buildAvatarProfile({
        name: "Maria",
        description: "Lifestyle influencer",
      }) as any;

      const text = buildImagePromptText(creation, avatar, null);

      expect(text).toContain("Maria");
      expect(text).toContain("Lifestyle influencer");
    });

    it("uses generic subject when avatar is null", () => {
      const creation = buildAvatarVideoCreation() as any;

      const text = buildImagePromptText(creation, null, null);

      expect(text).toContain("a young content creator");
    });

    it("includes product name when set on creation", () => {
      const creation = buildAvatarVideoCreation({
        productName: "Serum X",
      }) as any;

      const text = buildImagePromptText(creation, null, null);

      expect(text).toContain("Serum X");
    });

    it("uses category-appropriate interaction for skincare", () => {
      const creation = buildAvatarVideoCreation({
        productName: "Creme X",
        productCategory: "Skincare",
      }) as any;

      const text = buildImagePromptText(creation, null, null);

      expect(text).toContain("Creme X");
      expect(text).toContain("holding");
      expect(text).toContain("face");
    });

    it("includes scenario promptHint when provided", () => {
      const creation = buildAvatarVideoCreation() as any;
      const scenario = buildVideoScenario({
        promptHint: "Fale sobre os benefícios",
      }) as any;

      const text = buildImagePromptText(creation, null, scenario);

      expect(text).toContain("Fale sobre os benefícios");
    });

    it("omits scenario context when promptHint is null", () => {
      const creation = buildAvatarVideoCreation() as any;
      const scenario = buildVideoScenario({ promptHint: null }) as any;

      const text = buildImagePromptText(creation, null, scenario);

      expect(text).not.toContain("Fale sobre os benefícios");
      expect(text).toContain("SETTING:");
    });

    it("always appends the quality suffix", () => {
      const creation = buildAvatarVideoCreation() as any;

      const text = buildImagePromptText(creation, null, null);

      expect(text).toContain("photorealistic");
      expect(text).toContain("TikTok Shop");
    });

    it("instructs model to wear clothing, with gender fallback note", () => {
      const creation = buildAvatarVideoCreation({
        productName: "Linen Shirt",
        productCategory: "Clothing",
      }) as any;

      const text = buildImagePromptText(creation, null, null);

      expect(text).toContain("Linen Shirt");
      expect(text).toContain("wearing");
      expect(text).toContain("gender");
    });

    it("places home products in a home setting", () => {
      const creation = buildAvatarVideoCreation({
        productName: "Air Fryer",
        productCategory: "Home Kitchen",
      }) as any;

      const text = buildImagePromptText(creation, null, null);

      expect(text).toContain("Air Fryer");
      expect(text).toContain("home");
      expect(text).toContain("SETTING:");
    });

    it("includes anti-distortion and no-hallucination rules", () => {
      const creation = buildAvatarVideoCreation() as any;

      const text = buildImagePromptText(creation, null, null);

      expect(text).toContain("Do NOT distort");
      expect(text).toContain("Do NOT invent");
      expect(text).toContain("source of truth");
    });

    it("combines all elements when all are present", () => {
      const creation = buildAvatarVideoCreation({
        productName: "Creme facial",
        productCategory: "Beleza",
      }) as any;
      const avatar = buildAvatarProfile({
        name: "João",
        description: "Tech reviewer",
      }) as any;
      const scenario = buildVideoScenario({
        promptHint: "Mostre o produto em uso",
      }) as any;

      const text = buildImagePromptText(creation, avatar, scenario);

      expect(text).toContain("João");
      expect(text).toContain("Tech reviewer");
      expect(text).toContain("Creme facial");
      expect(text).toContain("Mostre o produto em uso");
      expect(text).toContain("photorealistic");
    });
  });

  // -------------------------------------------------------------------------
  // generateImageVariation
  // -------------------------------------------------------------------------

  describe("generateImageVariation()", () => {
    it("creates a variation row in PROCESSING state before calling API", async () => {
      const variation = buildAvatarVideoImageVariation({
        id: "var-1",
        status: "PROCESSING",
      });
      (
        prismaMock.avatarVideoImageVariation.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);
      // The stub _callImageGenerationAPI always throws — update to FAILED
      (
        prismaMock.avatarVideoImageVariation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...variation,
        status: "FAILED",
      });

      const result = await generateImageVariation(
        "creation-1",
        0,
        "test prompt",
      );

      expect(prismaMock.avatarVideoImageVariation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creationId: "creation-1",
            sortOrder: 0,
            status: "PROCESSING",
          }),
        }),
      );
      // The stub throws, so the result should be an error
      expect(result.ok).toBe(false);
    });

    it("marks variation FAILED and returns ServiceErr when API throws", async () => {
      const variation = buildAvatarVideoImageVariation({ id: "var-fail" });
      (
        prismaMock.avatarVideoImageVariation.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);
      (
        prismaMock.avatarVideoImageVariation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);

      const result = await generateImageVariation("creation-1", 0, "prompt");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("internal");
      }
      // Should have called update with FAILED status
      expect(prismaMock.avatarVideoImageVariation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("returns ServiceErr with code internal on prisma failure", async () => {
      (
        prismaMock.avatarVideoImageVariation.create as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error("DB connection lost"));

      const result = await generateImageVariation("creation-1", 0, "prompt");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("internal");
      }
    });

    it("marks variation FAILED when Google AI API key is not configured", async () => {
      getSecretSettingMock.mockResolvedValue(null);
      const variation = buildAvatarVideoImageVariation({ id: "var-nokey" });
      (
        prismaMock.avatarVideoImageVariation.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);
      (
        prismaMock.avatarVideoImageVariation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);

      const result = await generateImageVariation("creation-1", 0, "prompt");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("internal");
      expect(prismaMock.avatarVideoImageVariation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("persists blobUrl and returns ok on successful generation", async () => {
      getSecretSettingMock.mockResolvedValue("test-google-key");
      uploadBufferToBlobMock.mockResolvedValue(
        "https://blob.vercel.app/avatar-video/var-ok.png",
      );

      const variation = buildAvatarVideoImageVariation({ id: "var-ok" });
      (
        prismaMock.avatarVideoImageVariation.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);
      (
        prismaMock.avatarVideoImageVariation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...variation,
        blobUrl: "https://blob.vercel.app/avatar-video/var-ok.png",
        status: "READY",
      });

      // Google AI returns base64-encoded image data in candidates
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { inlineData: { mimeType: "image/png", data: "AAAA" } },
                  ],
                },
              },
            ],
          }),
        }),
      );

      const result = await generateImageVariation(
        "creation-1",
        0,
        "test prompt",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blobUrl).toBe(
          "https://blob.vercel.app/avatar-video/var-ok.png",
        );
        expect(result.data.variationId).toBe("var-ok");
      }
      expect(uploadBufferToBlobMock).toHaveBeenCalledWith(
        expect.any(Buffer),
        "avatar-video/var-ok.png",
        "image/png",
      );
      expect(prismaMock.avatarVideoImageVariation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blobUrl: "https://blob.vercel.app/avatar-video/var-ok.png",
            status: "READY",
          }),
        }),
      );
    });

    it("marks variation FAILED when Google AI returns non-ok status", async () => {
      getSecretSettingMock.mockResolvedValue("test-google-key");
      const variation = buildAvatarVideoImageVariation({ id: "var-apierr" });
      (
        prismaMock.avatarVideoImageVariation.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);
      (
        prismaMock.avatarVideoImageVariation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded",
        }),
      );

      const result = await generateImageVariation("creation-1", 0, "prompt");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("internal");
      expect(prismaMock.avatarVideoImageVariation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("marks variation FAILED when blob upload returns null", async () => {
      getSecretSettingMock.mockResolvedValue("test-google-key");
      uploadBufferToBlobMock.mockResolvedValue(null);

      const variation = buildAvatarVideoImageVariation({ id: "var-blobfail" });
      (
        prismaMock.avatarVideoImageVariation.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);
      (
        prismaMock.avatarVideoImageVariation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { inlineData: { mimeType: "image/png", data: "AAAA" } },
                  ],
                },
              },
            ],
          }),
        }),
      );

      const result = await generateImageVariation("creation-1", 0, "prompt");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("internal");
    });

    it("calls Google AI when reference images are provided", async () => {
      getSecretSettingMock.mockResolvedValue("test-google-key");
      uploadBufferToBlobMock.mockResolvedValue(
        "https://blob.vercel.app/avatar-video/var-ref.png",
      );

      const variation = buildAvatarVideoImageVariation({ id: "var-ref" });
      (
        prismaMock.avatarVideoImageVariation.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(variation);
      (
        prismaMock.avatarVideoImageVariation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...variation,
        blobUrl: "https://blob.vercel.app/avatar-video/var-ref.png",
        status: "READY",
      });

      const calledUrls: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string) => {
          calledUrls.push(url as string);
          if ((url as string).includes("generativelanguage.googleapis.com")) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                candidates: [
                  {
                    content: {
                      parts: [
                        { inlineData: { mimeType: "image/png", data: "AAAA" } },
                      ],
                    },
                  },
                ],
              }),
            });
          }
          // Reference image download
          return Promise.resolve({
            ok: true,
            headers: { get: () => "image/png" },
            arrayBuffer: async () => new ArrayBuffer(100),
          });
        }),
      );

      const result = await generateImageVariation(
        "creation-1",
        0,
        "test prompt",
        "https://blob.vercel.app/avatar.png",
        "https://blob.vercel.app/product.png",
      );

      expect(result.ok).toBe(true);
      expect(
        calledUrls.some((u) => u.includes("generativelanguage.googleapis.com")),
      ).toBe(true);
    });
  });
});
