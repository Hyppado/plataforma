/**
 * Tests: lib/influencer-ia/generate.ts
 *
 * Coverage: buildPrompt (via generateInfluencerImage), fetchImageBuffer,
 * generateWithGemini, upload flow — all external calls mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  getSecretSettingMock,
  getSettingMock,
  uploadBufferToBlobMock,
  getPromptConfigFromDBMock,
  generateContentMock,
} = vi.hoisted(() => ({
  getSecretSettingMock: vi.fn(),
  getSettingMock: vi.fn(),
  uploadBufferToBlobMock: vi.fn(),
  getPromptConfigFromDBMock: vi.fn(),
  generateContentMock: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({
  getSecretSetting: getSecretSettingMock,
  getSetting: getSettingMock,
  SETTING_KEYS: {
    GOOGLE_AI_API_KEY: "google.ai.api_key",
    GOOGLE_AI_MODEL: "google.ai.model",
  },
}));

vi.mock("@/lib/storage/blob", () => ({
  uploadBufferToBlob: uploadBufferToBlobMock,
  isEchotikCdnUrl: () => false,
  signEchotikCoverUrl: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/admin/config", () => ({
  getPromptConfigFromDB: getPromptConfigFromDBMock,
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));

import { generateInfluencerImage } from "@/lib/influencer-ia/generate";
import type { InfluencerImageInput } from "@/lib/influencer-ia/generate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_INPUT: InfluencerImageInput = {
  avatarImageUrl: null,
  avatarName: "Ana Silva",
  avatarDescription: "Brazilian content creator",
  productImageUrl: null,
  productName: "Creme Hidratante Premium",
  productCategory: "beleza",
  pose: "De Frente",
  customPose: null,
  environment: "Casa",
  customEnvironment: null,
  style: "Casual",
  enhancements: [],
};

function makeFakeImageBuffer(): Buffer {
  return Buffer.from("fake-png-data");
}

function mockGeminiSuccess(imageB64 = "AAAA") {
  generateContentMock.mockResolvedValue({
    candidates: [
      {
        content: {
          parts: [{ inlineData: { mimeType: "image/png", data: imageB64 } }],
        },
      },
    ],
  });
}

type GeminiArgs = {
  model?: string;
  contents: Array<{
    parts: Array<{
      text?: string;
      inlineData?: { mimeType?: string; data?: string };
    }>;
  }>;
};

function getGeminiArgs(): GeminiArgs {
  const call = generateContentMock.mock.calls[0] as [GeminiArgs];
  return call[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("lib/influencer-ia/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSecretSettingMock.mockResolvedValue("fake-google-api-key");
    getSettingMock.mockResolvedValue(null); // uses default model
    uploadBufferToBlobMock.mockResolvedValue(
      "https://blob.vercel-storage.com/influencer-ia/test.png",
    );
  });

  // -------------------------------------------------------------------------
  // Auth / config guards
  // -------------------------------------------------------------------------

  it("throws when Google AI key is not configured", async () => {
    getSecretSettingMock.mockResolvedValue(null);

    await expect(generateInfluencerImage(BASE_INPUT)).rejects.toThrow(
      "Chave Google AI Studio não configurada",
    );
  });

  // -------------------------------------------------------------------------
  // Successful generation
  // -------------------------------------------------------------------------

  it("returns imageUrl on successful generation", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    const result = await generateInfluencerImage(BASE_INPUT);

    expect(result.imageUrl).toBe(
      "https://blob.vercel-storage.com/influencer-ia/test.png",
    );
    expect(uploadBufferToBlobMock).toHaveBeenCalledOnce();
  });

  it("uses custom Gemini model from settings when configured", async () => {
    getSettingMock.mockResolvedValue("gemini-custom-model");
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage(BASE_INPUT);

    expect(getGeminiArgs().model).toBe("gemini-custom-model");
  });

  it("includes product name in the Gemini request body", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage({
      ...BASE_INPUT,
      productName: "Produto Especial XYZ",
    });

    const bodyStr = JSON.stringify(getGeminiArgs());
    expect(bodyStr).toContain("Produto Especial XYZ");
  });

  // -------------------------------------------------------------------------
  // Fetch image references
  // -------------------------------------------------------------------------

  it("fetches avatar and product image buffers when URLs are provided", async () => {
    const fakeB64 = makeFakeImageBuffer().toString("base64");
    const fakeImageResponse = {
      ok: true,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: async () => Buffer.from(fakeB64, "base64").buffer,
    };

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(fakeImageResponse) // avatar fetch
        .mockResolvedValueOnce(fakeImageResponse), // product fetch
    );
    mockGeminiSuccess(fakeB64);

    const result = await generateInfluencerImage({
      ...BASE_INPUT,
      avatarImageUrl: "https://example.com/avatar.jpg",
      productImageUrl: "https://example.com/product.jpg",
    });

    expect(result.imageUrl).toContain("blob.vercel-storage.com");
    // 2 fetches: avatar + product — Gemini goes through SDK
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(generateContentMock).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it("throws when Gemini returns a non-OK status", async () => {
    generateContentMock.mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(generateInfluencerImage(BASE_INPUT)).rejects.toThrow();
  });

  it("throws when Gemini response has no image part", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "no image here" }] } }],
    });

    await expect(generateInfluencerImage(BASE_INPUT)).rejects.toThrow(
      "Google AI não retornou imagem",
    );
  });

  it("throws when blob upload fails", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));
    uploadBufferToBlobMock.mockResolvedValue(null);

    await expect(generateInfluencerImage(BASE_INPUT)).rejects.toThrow(
      "Falha ao fazer upload",
    );
  });

  // -------------------------------------------------------------------------
  // Prompt variations
  // -------------------------------------------------------------------------

  it("includes clothing placement instruction for clothing category", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage({
      ...BASE_INPUT,
      productName: "Vestido Floral",
      productCategory: "roupa",
    });

    const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
    expect(promptText).toContain("IS WEARING");
  });

  it("omits person from prompt when pose is 'Só Produto'", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage({
      ...BASE_INPUT,
      pose: "Só Produto",
      customPose: null,
    });

    const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
    expect(promptText).toContain("Product-only shot");
    expect(promptText).not.toContain("PLACEMENT");
  });

  // -------------------------------------------------------------------------
  // MIME type detection from magic bytes
  // -------------------------------------------------------------------------

  it("detects image/jpeg from magic bytes when CDN returns binary/octet-stream", async () => {
    const fakeB64 = makeFakeImageBuffer().toString("base64");

    // Real JPEG magic bytes: FF D8 FF
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const imageResponse = {
      ok: true,
      headers: { get: () => "binary/octet-stream" },
      arrayBuffer: async () =>
        jpegMagic.buffer.slice(
          jpegMagic.byteOffset,
          jpegMagic.byteOffset + jpegMagic.byteLength,
        ),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(imageResponse), // product fetch
    );
    mockGeminiSuccess(fakeB64);

    await generateInfluencerImage({
      ...BASE_INPUT,
      productImageUrl: "https://example.com/product",
    });

    // Verify the inlineData sent to Gemini uses image/jpeg, NOT binary/octet-stream
    const inlinePart = getGeminiArgs().contents[0]?.parts.find(
      (p) => p.inlineData,
    );
    expect(inlinePart?.inlineData?.mimeType).toBe("image/jpeg");
  });

  it("detects image/png from magic bytes when CDN returns application/octet-stream", async () => {
    const fakeB64 = makeFakeImageBuffer().toString("base64");

    // Real PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const imageResponse = {
      ok: true,
      headers: { get: () => "application/octet-stream" },
      arrayBuffer: async () =>
        pngMagic.buffer.slice(
          pngMagic.byteOffset,
          pngMagic.byteOffset + pngMagic.byteLength,
        ),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(imageResponse), // product fetch
    );
    mockGeminiSuccess(fakeB64);

    await generateInfluencerImage({
      ...BASE_INPUT,
      productImageUrl: "https://example.com/product.png",
    });

    const inlinePart = getGeminiArgs().contents[0]?.parts.find(
      (p) => p.inlineData,
    );
    expect(inlinePart?.inlineData?.mimeType).toBe("image/png");
  });

  it("passes correct content-type when CDN returns proper image/webp header", async () => {
    const fakeB64 = makeFakeImageBuffer().toString("base64");

    const imageResponse = {
      ok: true,
      headers: { get: () => "image/webp; charset=binary" },
      arrayBuffer: async () => Buffer.from([0x52, 0x49, 0x46, 0x46]).buffer,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(imageResponse), // product fetch
    );
    mockGeminiSuccess(fakeB64);

    await generateInfluencerImage({
      ...BASE_INPUT,
      productImageUrl: "https://example.com/product.webp",
    });

    const inlinePart = getGeminiArgs().contents[0]?.parts.find(
      (p) => p.inlineData,
    );
    // Content-Type header was a valid image type — strips params and passes through
    expect(inlinePart?.inlineData?.mimeType).toBe("image/webp");
  });

  it("uses customPose when provided (overrides preset)", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage({
      ...BASE_INPUT,
      pose: "De Frente",
      customPose: "Deitada na praia segurando o produto",
    });

    const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
    expect(promptText).toContain("Deitada na praia");
  });

  it("includes enhancement descriptions when enhancements provided", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage({
      ...BASE_INPUT,
      enhancements: ["Pele Ultra Realista", "Mãos Perfeitas"],
    });

    const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
    expect(promptText).toContain("ultra-realistic skin texture");
    expect(promptText).toContain("perfect anatomically correct hands");
  });

  // -------------------------------------------------------------------------
  // Admin-editable template integration
  // -------------------------------------------------------------------------

  describe("admin-editable image template (buildPromptFromTemplate)", () => {
    function makeConfigWithTemplate(imageTemplate: string) {
      return {
        avatarVideo: {
          image: imageTemplate,
          veoSystem: "sys",
          veoUser: "usr",
        },
        insight: { template: "", settings: {} },
        script: { template: "", settings: {} },
      };
    }

    it("uses admin-edited template from DB when available", async () => {
      // Custom template that puts product name first in a distinctive way
      const customTemplate =
        "CUSTOM_MARKER {{product_block}} THEN {{subject_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}";
      getPromptConfigFromDBMock.mockResolvedValue(
        makeConfigWithTemplate(customTemplate),
      );
      mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

      await generateInfluencerImage(BASE_INPUT);

      const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
      expect(promptText).toContain("CUSTOM_MARKER");
      // product_block should appear before subject_block in output
      expect(promptText.indexOf("CUSTOM_MARKER")).toBeLessThan(
        promptText.indexOf("Ana Silva"),
      );
    });

    it("falls back to default prompt structure when getPromptConfigFromDB throws", async () => {
      getPromptConfigFromDBMock.mockRejectedValue(new Error("DB unavailable"));
      mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

      // Should not throw — falls back gracefully
      const result = await generateInfluencerImage(BASE_INPUT);
      expect(result.imageUrl).toBeTruthy();
    });

    it("substitutes {{subject_block}} with avatar name in template", async () => {
      const tpl =
        "START {{subject_block}} MID {{product_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}";
      getPromptConfigFromDBMock.mockResolvedValue(makeConfigWithTemplate(tpl));
      mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

      await generateInfluencerImage({
        ...BASE_INPUT,
        avatarName: "Larissa Costa",
      });

      const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
      expect(promptText).toContain("Larissa Costa");
    });

    it("substitutes {{pose}} with the resolved pose description", async () => {
      const tpl =
        "{{subject_block}} {{product_block}} {{placement_block}} POSE_HERE: {{pose}} ENV: {{environment}}";
      getPromptConfigFromDBMock.mockResolvedValue(makeConfigWithTemplate(tpl));
      mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

      await generateInfluencerImage({ ...BASE_INPUT, pose: "Selfie" });

      const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
      expect(promptText).toContain("POSE_HERE:");
      expect(promptText).toContain("selfie style");
    });

    it("collapses blank lines when optional variables are absent from template", async () => {
      // Template with optional vars (style_block, enhancements_block) that
      // will be empty because input has no style/enhancements
      const tpl = [
        "{{subject_block}}",
        "{{product_block}}",
        "{{placement_block}}",
        "POSE: {{pose}}",
        "ENV: {{environment}}",
        "{{style_block}}",
        "{{enhancements_block}}",
      ].join("\n");
      getPromptConfigFromDBMock.mockResolvedValue(makeConfigWithTemplate(tpl));
      mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

      await generateInfluencerImage({
        ...BASE_INPUT,
        style: null,
        enhancements: [],
      });

      const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
      // Should not have consecutive blank lines (collapsed)
      expect(promptText).not.toContain("\n\n\n");
    });

    it("product name from input is reflected in the Gemini request with custom template", async () => {
      const tpl =
        "{{subject_block}} {{product_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}";
      getPromptConfigFromDBMock.mockResolvedValue(makeConfigWithTemplate(tpl));
      mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

      await generateInfluencerImage({
        ...BASE_INPUT,
        productName: "Produto Especial Único",
      });

      const promptText = getGeminiArgs().contents[0]?.parts[0]?.text ?? "";
      expect(promptText).toContain("Produto Especial Único");
    });
  });
});
