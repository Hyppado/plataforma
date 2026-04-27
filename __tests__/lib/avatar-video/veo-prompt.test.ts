/**
 * Tests: lib/avatar-video/veo-prompt.ts
 *
 * Coverage:
 *   - isVeoPromptError (type guard)
 *   - buildVeoPromptMessages (pure function)
 *   - callVeoPromptGeneration (mocked fetch)
 *   - generateAndPersistVeoPrompt (mocked prisma + callVeoPromptGeneration)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@tests/helpers/prisma-mock";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  buildAvatarVideoCreation,
  buildAvatarProfile,
  buildVideoScenario,
  buildAvatarVideoImageVariation,
  buildAvatarVideoPrompt,
} from "@tests/helpers/factories";

vi.mock("@/lib/settings", () => ({
  getSecretSetting: vi.fn().mockResolvedValue("sk-test-key"),
  getSetting: vi.fn().mockResolvedValue(null),
  SETTING_KEYS: {
    OPENAI_API_KEY: "openai.api_key",
    AVATAR_VIDEO_PROMPT_TEMPLATE: "avatar_video.prompt_template",
  },
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
  isVeoPromptError,
  buildVeoPromptMessages,
  callVeoPromptGeneration,
  generateAndPersistVeoPrompt,
} from "@/lib/avatar-video/veo-prompt";

describe("lib/avatar-video/veo-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // isVeoPromptError
  // -------------------------------------------------------------------------

  describe("isVeoPromptError()", () => {
    it("returns true for error results", () => {
      expect(isVeoPromptError({ error: "API failed" })).toBe(true);
    });

    it("returns false for success results", () => {
      expect(
        isVeoPromptError({
          promptJson: {
            prompt: "A video prompt",
            duration: 8,
            aspectRatio: "9:16",
          },
          promptText: "A video prompt",
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // buildVeoPromptMessages
  // -------------------------------------------------------------------------

  describe("buildVeoPromptMessages()", () => {
    it("returns system and user messages", () => {
      const creation = buildAvatarVideoCreation() as any;

      const messages = buildVeoPromptMessages(creation, null, null, []);

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("system");
      expect(messages[1].role).toBe("user");
    });

    it("includes product name in user message", () => {
      const creation = buildAvatarVideoCreation({
        productName: "Moisturizer Pro",
      }) as any;

      const messages = buildVeoPromptMessages(creation, null, null, []);
      const userMsg = messages[1].content;

      expect(userMsg).toContain("Moisturizer Pro");
    });

    it("includes formatted price when priceCents and currency are set", () => {
      const creation = buildAvatarVideoCreation({
        productPriceCents: 4990,
        productCurrency: "BRL",
      }) as any;

      const messages = buildVeoPromptMessages(creation, null, null, []);
      const userMsg = messages[1].content;

      expect(userMsg).toContain("BRL 49.90");
    });

    it("omits price when priceCents is null", () => {
      const creation = buildAvatarVideoCreation({
        productPriceCents: null,
        productCurrency: "BRL",
      }) as any;

      const messages = buildVeoPromptMessages(creation, null, null, []);
      const userMsg = messages[1].content;

      expect(userMsg).not.toContain("Preço:");
    });

    it("includes avatar name and description", () => {
      const creation = buildAvatarVideoCreation() as any;
      const avatar = buildAvatarProfile({
        name: "Bia",
        description: "Beauty creator",
      }) as any;

      const messages = buildVeoPromptMessages(creation, avatar, null, []);
      const userMsg = messages[1].content;

      expect(userMsg).toContain("Bia");
      expect(userMsg).toContain("Beauty creator");
    });

    it("includes tone, duration, and takeCount in user message", () => {
      const creation = buildAvatarVideoCreation({
        tone: "energetic",
        duration: "30s",
        takeCount: 3,
      }) as any;

      const messages = buildVeoPromptMessages(creation, null, null, []);
      const userMsg = messages[1].content;

      expect(userMsg).toContain("energetic");
      expect(userMsg).toContain("30s");
      expect(userMsg).toContain("N\u00famero de takes: 3");
    });

    it("defaults to 1 take when takeCount is null", () => {
      const creation = buildAvatarVideoCreation({ takeCount: null }) as any;

      const messages = buildVeoPromptMessages(creation, null, null, []);
      const userMsg = messages[1].content;

      expect(userMsg).toContain("N\u00famero de takes: 1");
    });

    it("uses custom system prompt when provided", () => {
      const creation = buildAvatarVideoCreation() as any;
      const customPrompt =
        "Voc\u00ea \u00e9 um prompt engineer especializado em VEO 3.";

      const messages = buildVeoPromptMessages(
        creation,
        null,
        null,
        [],
        customPrompt,
      );

      expect(messages[0].content).toBe(customPrompt);
    });

    it("falls back to default system prompt when systemPrompt is null", () => {
      const creation = buildAvatarVideoCreation() as any;

      const messages = buildVeoPromptMessages(creation, null, null, [], null);

      expect(messages[0].content).toContain("VEO 3");
    });

    it("includes takes schema in user message matching takeCount", () => {
      const creation = buildAvatarVideoCreation({ takeCount: 2 }) as any;

      const messages = buildVeoPromptMessages(creation, null, null, []);
      const userMsg = messages[1].content;

      // Schema should mention camera and spoken lines
      expect(userMsg).toContain("cameraDirection");
      expect(userMsg).toContain("spokenLines");
      expect(userMsg).toContain("visualDirection");
    });

    it("includes scenario name and promptHint", () => {
      const creation = buildAvatarVideoCreation() as any;
      const scenario = buildVideoScenario({
        name: "Demo Rápido",
        promptHint: "Mostre o produto em 3 ângulos",
      }) as any;

      const messages = buildVeoPromptMessages(creation, null, scenario, []);
      const userMsg = messages[1].content;

      expect(userMsg).toContain("Demo Rápido");
      expect(userMsg).toContain("Mostre o produto em 3 ângulos");
    });

    it("includes sorted image blob URLs when ready variations present", () => {
      const creation = buildAvatarVideoCreation() as any;
      const variations = [
        buildAvatarVideoImageVariation({
          blobUrl: "https://blob/img1.jpg",
          sortOrder: 1,
          status: "READY",
        }),
        buildAvatarVideoImageVariation({
          blobUrl: "https://blob/img0.jpg",
          sortOrder: 0,
          status: "READY",
        }),
      ] as any[];

      const messages = buildVeoPromptMessages(creation, null, null, variations);
      const userMsg = messages[1].content;

      expect(userMsg).toContain("https://blob/img0.jpg");
      expect(userMsg).toContain("https://blob/img1.jpg");
      // img0 (sortOrder 0) should appear before img1 (sortOrder 1)
      expect(userMsg.indexOf("img0")).toBeLessThan(userMsg.indexOf("img1"));
    });

    it("skips null blobUrls in image variations", () => {
      const creation = buildAvatarVideoCreation() as any;
      const variations = [
        buildAvatarVideoImageVariation({
          blobUrl: null,
          sortOrder: 0,
          status: "READY",
        }),
      ] as any[];

      const messages = buildVeoPromptMessages(creation, null, null, variations);
      const userMsg = messages[1].content;

      expect(userMsg).not.toContain("Imagens de referência geradas:");
    });
  });

  // -------------------------------------------------------------------------
  // callVeoPromptGeneration
  // -------------------------------------------------------------------------

  describe("callVeoPromptGeneration()", () => {
    const messages = [
      { role: "system" as const, content: "You are an AI." },
      { role: "user" as const, content: "Generate a prompt." },
    ];

    it("returns error when API key is not configured", async () => {
      const { getSecretSetting } = await import("@/lib/settings");
      (getSecretSetting as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      const result = await callVeoPromptGeneration(messages);

      expect(isVeoPromptError(result)).toBe(true);
      if (isVeoPromptError(result)) {
        expect(result.error).toContain("não configurada");
      }
    });

    it("returns error on non-200 HTTP response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: () => Promise.resolve("Rate limited"),
        }),
      );

      const result = await callVeoPromptGeneration(messages);

      expect(isVeoPromptError(result)).toBe(true);
      if (isVeoPromptError(result)) {
        expect(result.error).toContain("429");
      }
    });

    it("returns error when response is not valid JSON", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: "not json at all" } }],
            }),
        }),
      );

      const result = await callVeoPromptGeneration(messages);

      expect(isVeoPromptError(result)).toBe(true);
      if (isVeoPromptError(result)) {
        expect(result.error).toContain("JSON válido");
      }
    });

    it("returns error when prompt field is missing", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                { message: { content: JSON.stringify({ duration: 8 }) } },
              ],
            }),
        }),
      );

      const result = await callVeoPromptGeneration(messages);

      expect(isVeoPromptError(result)).toBe(true);
      if (isVeoPromptError(result)) {
        expect(result.error).toContain('"prompt"');
      }
    });

    it("returns parsed prompt on successful response", async () => {
      const promptPayload = {
        prompt: "A beautiful video of a product",
        duration: 8,
        aspectRatio: "9:16",
        style: "ugc",
        language: "pt-BR",
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                { message: { content: JSON.stringify(promptPayload) } },
              ],
            }),
        }),
      );

      const result = await callVeoPromptGeneration(messages);

      expect(isVeoPromptError(result)).toBe(false);
      if (!isVeoPromptError(result)) {
        expect(result.promptText).toBe("A beautiful video of a product");
        expect(result.promptJson.duration).toBe(8);
        expect(result.promptJson.aspectRatio).toBe("9:16");
      }
    });

    it("returns network error when fetch throws", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network timeout")),
      );

      const result = await callVeoPromptGeneration(messages);

      expect(isVeoPromptError(result)).toBe(true);
      if (isVeoPromptError(result)) {
        expect(result.error).toContain("Network timeout");
      }
    });
  });

  // -------------------------------------------------------------------------
  // generateAndPersistVeoPrompt
  // -------------------------------------------------------------------------

  describe("generateAndPersistVeoPrompt()", () => {
    it("upserts prompt row in PROCESSING state before generating", async () => {
      const { getSetting } = await import("@/lib/settings");
      (getSetting as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const creation = buildAvatarVideoCreation({ id: "creation-1" }) as any;
      const promptRow = buildAvatarVideoPrompt({
        id: "prompt-1",
        creationId: "creation-1",
      });

      (
        prismaMock.avatarVideoPrompt.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue(promptRow);
      (
        prismaMock.avatarVideoPrompt.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(promptRow);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      prompt: "A video",
                      duration: 8,
                      aspectRatio: "9:16",
                    }),
                  },
                },
              ],
            }),
        }),
      );

      const result = await generateAndPersistVeoPrompt(
        creation,
        null,
        null,
        [],
      );

      expect(prismaMock.avatarVideoPrompt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creationId: "creation-1" },
          create: expect.objectContaining({ status: "PROCESSING" }),
        }),
      );
      expect(result.ok).toBe(true);
    });

    it("updates prompt row to READY on success", async () => {
      const creation = buildAvatarVideoCreation({ id: "creation-1" }) as any;
      const promptRow = buildAvatarVideoPrompt({ id: "prompt-1" });

      (
        prismaMock.avatarVideoPrompt.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue(promptRow);
      (
        prismaMock.avatarVideoPrompt.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...promptRow,
        status: "READY",
      });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ prompt: "Video prompt" }),
                  },
                },
              ],
            }),
        }),
      );

      await generateAndPersistVeoPrompt(creation, null, null, []);

      expect(prismaMock.avatarVideoPrompt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "READY" }),
        }),
      );
    });

    it("updates prompt row to FAILED on generation error", async () => {
      const creation = buildAvatarVideoCreation({ id: "creation-2" }) as any;
      const promptRow = buildAvatarVideoPrompt({ id: "prompt-2" });

      (
        prismaMock.avatarVideoPrompt.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue(promptRow);
      (
        prismaMock.avatarVideoPrompt.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...promptRow,
        status: "FAILED",
      });

      // API key not configured → generation returns error
      const { getSecretSetting } = await import("@/lib/settings");
      (getSecretSetting as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      const result = await generateAndPersistVeoPrompt(
        creation,
        null,
        null,
        [],
      );

      expect(result.ok).toBe(false);
      expect(prismaMock.avatarVideoPrompt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });
  });
});
