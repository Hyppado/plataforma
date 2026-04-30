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

const { getSecretSettingMock, getSettingMock, uploadBufferToBlobMock } =
  vi.hoisted(() => ({
    getSecretSettingMock: vi.fn(),
    getSettingMock: vi.fn(),
    uploadBufferToBlobMock: vi.fn(),
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
  const responsePayload = {
    candidates: [
      {
        content: {
          parts: [{ inlineData: { mimeType: "image/png", data: imageB64 } }],
        },
      },
    ],
  };

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responsePayload,
    }),
  );
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

    const [fetchUrl] = (vi.mocked(fetch).mock.calls[0] ?? []) as [string];
    expect(fetchUrl).toContain("gemini-custom-model");
  });

  it("includes product name in the Gemini request body", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage({
      ...BASE_INPUT,
      productName: "Produto Especial XYZ",
    });

    const call = vi.mocked(fetch).mock.calls[0];
    const requestBody = JSON.parse(
      (call?.[1] as RequestInit)?.body as string,
    ) as unknown;
    const bodyStr = JSON.stringify(requestBody);
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

    const geminiResponse = {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: fakeB64 } }],
            },
          },
        ],
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(fakeImageResponse) // avatar fetch
        .mockResolvedValueOnce(fakeImageResponse) // product fetch
        .mockResolvedValueOnce(geminiResponse), // Gemini call
    );

    const result = await generateInfluencerImage({
      ...BASE_INPUT,
      avatarImageUrl: "https://example.com/avatar.jpg",
      productImageUrl: "https://example.com/product.jpg",
    });

    expect(result.imageUrl).toContain("blob.vercel-storage.com");
    // 3 fetches: avatar, product, gemini
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it("throws when Gemini returns a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      }),
    );

    await expect(generateInfluencerImage(BASE_INPUT)).rejects.toThrow(
      "Google AI falhou (429)",
    );
  });

  it("throws when Gemini response has no image part", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "no image here" }] } }],
        }),
      }),
    );

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

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit)?.body as string) as {
      contents: Array<{ parts: Array<{ text?: string }> }>;
    };
    const promptText = body.contents[0]?.parts[0]?.text ?? "";
    expect(promptText).toContain("IS WEARING");
  });

  it("omits person from prompt when pose is 'Só Produto'", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage({
      ...BASE_INPUT,
      pose: "Só Produto",
      customPose: null,
    });

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit)?.body as string) as {
      contents: Array<{ parts: Array<{ text?: string }> }>;
    };
    const promptText = body.contents[0]?.parts[0]?.text ?? "";
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
    const geminiResponse = {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: fakeB64 } }],
            },
          },
        ],
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(imageResponse) // product fetch
        .mockResolvedValueOnce(geminiResponse), // Gemini call
    );

    await generateInfluencerImage({
      ...BASE_INPUT,
      productImageUrl: "https://example.com/product",
    });

    // Verify the inlineData sent to Gemini uses image/jpeg, NOT binary/octet-stream
    const geminiCall = vi.mocked(fetch).mock.calls[1];
    const body = JSON.parse(
      (geminiCall?.[1] as RequestInit)?.body as string,
    ) as {
      contents: Array<{ parts: Array<{ inlineData?: { mimeType?: string } }> }>;
    };
    const inlinePart = body.contents[0]?.parts.find((p) => p.inlineData);
    expect(inlinePart?.inlineData?.mimeType).toBe("image/jpeg");
  });

  it("detects image/png from magic bytes when CDN returns application/octet-stream", async () => {
    const fakeB64 = makeFakeImageBuffer().toString("base64");

    // Real PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const imageResponse = {
      ok: true,
      headers: { get: () => "application/octet-stream" },
      arrayBuffer: async () =>
        pngMagic.buffer.slice(
          pngMagic.byteOffset,
          pngMagic.byteOffset + pngMagic.byteLength,
        ),
    };
    const geminiResponse = {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: fakeB64 } }],
            },
          },
        ],
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(imageResponse) // product fetch
        .mockResolvedValueOnce(geminiResponse), // Gemini call
    );

    await generateInfluencerImage({
      ...BASE_INPUT,
      productImageUrl: "https://example.com/product.png",
    });

    const geminiCall = vi.mocked(fetch).mock.calls[1];
    const body = JSON.parse(
      (geminiCall?.[1] as RequestInit)?.body as string,
    ) as {
      contents: Array<{ parts: Array<{ inlineData?: { mimeType?: string } }> }>;
    };
    const inlinePart = body.contents[0]?.parts.find((p) => p.inlineData);
    expect(inlinePart?.inlineData?.mimeType).toBe("image/png");
  });

  it("passes correct content-type when CDN returns proper image/webp header", async () => {
    const fakeB64 = makeFakeImageBuffer().toString("base64");

    const imageResponse = {
      ok: true,
      headers: { get: () => "image/webp; charset=binary" },
      arrayBuffer: async () => Buffer.from([0x52, 0x49, 0x46, 0x46]).buffer,
    };
    const geminiResponse = {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: fakeB64 } }],
            },
          },
        ],
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(imageResponse) // product fetch
        .mockResolvedValueOnce(geminiResponse), // Gemini call
    );

    await generateInfluencerImage({
      ...BASE_INPUT,
      productImageUrl: "https://example.com/product.webp",
    });

    const geminiCall = vi.mocked(fetch).mock.calls[1];
    const body = JSON.parse(
      (geminiCall?.[1] as RequestInit)?.body as string,
    ) as {
      contents: Array<{ parts: Array<{ inlineData?: { mimeType?: string } }> }>;
    };
    const inlinePart = body.contents[0]?.parts.find((p) => p.inlineData);
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

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit)?.body as string) as {
      contents: Array<{ parts: Array<{ text?: string }> }>;
    };
    const promptText = body.contents[0]?.parts[0]?.text ?? "";
    expect(promptText).toContain("Deitada na praia");
  });

  it("includes enhancement descriptions when enhancements provided", async () => {
    mockGeminiSuccess(makeFakeImageBuffer().toString("base64"));

    await generateInfluencerImage({
      ...BASE_INPUT,
      enhancements: ["Pele Ultra Realista", "Mãos Perfeitas"],
    });

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit)?.body as string) as {
      contents: Array<{ parts: Array<{ text?: string }> }>;
    };
    const promptText = body.contents[0]?.parts[0]?.text ?? "";
    expect(promptText).toContain("ultra-realistic skin texture");
    expect(promptText).toContain("perfect anatomically correct hands");
  });
});
