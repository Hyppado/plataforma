/**
 * Tests: lib/influencer-ia/veo-prompt.ts
 *
 * Coverage: generateVeoPrompts — API key guard, prompt count, structure,
 * fallback padding, OpenAI error propagation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { getSecretSettingMock } = vi.hoisted(() => ({
  getSecretSettingMock: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({
  getSecretSetting: getSecretSettingMock,
  SETTING_KEYS: { OPENAI_API_KEY: "openai.api_key" },
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
  generateVeoPrompts,
  PART_LABELS,
} from "@/lib/influencer-ia/veo-prompt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOpenAIResponse(parts: string[]) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({ parts }),
          },
        },
      ],
    }),
    text: async () => "",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("lib/influencer-ia/veo-prompt — generateVeoPrompts()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSecretSettingMock.mockResolvedValue("sk-test-key");
  });

  it("throws when OpenAI key is not configured", async () => {
    getSecretSettingMock.mockResolvedValue(null);

    await expect(
      generateVeoPrompts("Produto Teste", null, "ugc", "short"),
    ).rejects.toThrow("Chave OpenAI não configurada");
  });

  it("returns correct number of parts for 'short' duration", async () => {
    const expectedCount = PART_LABELS.short.length;
    const fakePrompts = Array.from(
      { length: expectedCount },
      (_, i) => `Prompt part ${i + 1}`,
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse(fakePrompts)));

    const result = await generateVeoPrompts("Produto A", null, "ugc", "short");

    expect(result).toHaveLength(expectedCount);
    expect(result[0]?.part).toBe(1);
    expect(result[expectedCount - 1]?.part).toBe(expectedCount);
  });

  it("returns correct number of parts for 'medium' duration", async () => {
    const expectedCount = PART_LABELS.medium.length;
    const fakePrompts = Array.from(
      { length: expectedCount },
      (_, i) => `Prompt ${i + 1}`,
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse(fakePrompts)));

    const result = await generateVeoPrompts("Produto B", null, "ugc", "medium");
    expect(result).toHaveLength(expectedCount);
  });

  it("returns correct number of parts for 'full' duration", async () => {
    const expectedCount = PART_LABELS.full.length;
    const fakePrompts = Array.from(
      { length: expectedCount },
      (_, i) => `Prompt ${i + 1}`,
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse(fakePrompts)));

    const result = await generateVeoPrompts("Produto C", null, "ugc", "full");
    expect(result).toHaveLength(expectedCount);
  });

  it("each part has required fields", async () => {
    const fakePrompts = ["Gancho prompt", "CTA prompt"];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse(fakePrompts)));

    const result = await generateVeoPrompts("Creme X", "beleza", "ugc", "short");

    for (const part of result) {
      expect(part).toMatchObject({
        aspect_ratio: "9:16",
        duration: 8,
        audio: true,
        part: expect.any(Number),
        label: expect.any(String),
        prompt: expect.any(String),
        _metadata: {
          part: expect.any(Number),
          total_parts: expect.any(Number),
          product: "Creme X",
          label: expect.any(String),
        },
      });
    }
  });

  it("labels match PART_LABELS for the given duration", async () => {
    const fakePrompts = ["p1", "p2"];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse(fakePrompts)));

    const result = await generateVeoPrompts("Produto", null, "ugc", "short");

    expect(result.map((p) => p.label)).toEqual(PART_LABELS.short);
  });

  it("pads with fallback prompts when AI returns fewer parts than expected", async () => {
    // AI returns only 1 part, but short expects 2
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse(["Only gancho"])));

    const result = await generateVeoPrompts("Produto", null, "ugc", "short");

    expect(result).toHaveLength(PART_LABELS.short.length);
    // The padded part should contain a fallback string
    expect(result[1]?.prompt).toContain("Produto");
  });

  it("pads fully when AI returns empty parts array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse([])));

    const result = await generateVeoPrompts("Prod", null, "ugc", "short");

    expect(result).toHaveLength(PART_LABELS.short.length);
    for (const part of result) {
      expect(part.prompt.length).toBeGreaterThan(0);
    }
  });

  it("handles invalid JSON in AI response gracefully (uses fallbacks)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not valid json at all" } }],
        }),
      }),
    );

    const result = await generateVeoPrompts("Prod", null, "ugc", "short");
    expect(result).toHaveLength(PART_LABELS.short.length);
  });

  it("throws when OpenAI returns a non-OK HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "rate limit",
      }),
    );

    await expect(
      generateVeoPrompts("Prod", null, "ugc", "short"),
    ).rejects.toThrow("OpenAI HTTP 429");
  });

  it("includes product category in the OpenAI request when provided", async () => {
    const fakePrompts = ["p1", "p2"];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse(fakePrompts)));

    await generateVeoPrompts("Creme Solar", "beleza", "review", "short");

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit)?.body as string) as { messages: Array<{ content: string }> };
    const userMessage = body.messages.find((m) => m.content.includes("beleza"));
    expect(userMessage).toBeDefined();
  });

  it("sends correct style description to OpenAI", async () => {
    const fakePrompts = ["p1", "p2"];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOpenAIResponse(fakePrompts)));

    await generateVeoPrompts("Prod", null, "unboxing", "short");

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit)?.body as string) as { messages: Array<{ content: string }> };
    const userMessage = body.messages[body.messages.length - 1]?.content ?? "";
    expect(userMessage).toContain("unboxing");
  });
});
