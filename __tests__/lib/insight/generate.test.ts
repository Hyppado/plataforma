/**
 * Tests: lib/insight/generate.ts
 *
 * Coverage: parseInsightResponse, generateInsight (mocked HTTP)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/settings", () => ({
  getSecretSetting: vi.fn().mockResolvedValue("sk-test-key"),
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
  parseInsightResponse,
  generateInsight,
  isGenerateError,
} from "@/lib/insight/generate";

describe("lib/insight/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // parseInsightResponse
  // -----------------------------------------------------------------------

  describe("parseInsightResponse", () => {
    it("parses valid JSON with Portuguese fields", () => {
      const json = JSON.stringify({
        contexto: "O vídeo discute skincare",
        gancho: "Pergunta provocativa",
        problema: "Pele oleosa",
        solucao: "Produto X",
        cta: "Compre agora",
        copie_o_que_funcionou: "Roteiro genérico...",
      });

      const result = parseInsightResponse(json);

      expect(result).not.toBeNull();
      expect(result!.contexto).toBe("O vídeo discute skincare");
      expect(result!.gancho).toBe("Pergunta provocativa");
      expect(result!.problema).toBe("Pele oleosa");
      expect(result!.solucao).toBe("Produto X");
      expect(result!.cta).toBe("Compre agora");
      expect(result!.copie_o_que_funcionou).toBe("Roteiro genérico...");
    });

    it("parses JSON with English field fallbacks", () => {
      const json = JSON.stringify({
        context: "The video discusses skincare",
        hook: "Provocative question",
        problem: "Oily skin",
        solution: "Product X",
        call_to_action: "Buy now",
        copy_what_worked: "Generic script...",
      });

      const result = parseInsightResponse(json);

      expect(result).not.toBeNull();
      expect(result!.contexto).toBe("The video discusses skincare");
      expect(result!.gancho).toBe("Provocative question");
    });

    it("returns null for invalid JSON", () => {
      const result = parseInsightResponse("not json at all");
      expect(result).toBeNull();
    });

    it("recovers truncated JSON from max_tokens cutoff", () => {
      // Simulates a response cut off mid-value
      const truncated =
        '{\n  "contexto": "O vídeo apresenta skincare",\n  "gancho": "Pergunta provocativa",\n  "problema": "Pele oleosa",\n  "solucao": "Produto X resolve o prob';

      const result = parseInsightResponse(truncated);

      expect(result).not.toBeNull();
      expect(result!.contexto).toBe("O vídeo apresenta skincare");
      expect(result!.gancho).toBe("Pergunta provocativa");
      expect(result!.problema).toBe("Pele oleosa");
      // Truncated field gets partial value
      expect(result!.solucao).toContain("Produto X");
      // Missing fields get empty strings
      expect(result!.cta).toBe("");
      expect(result!.copie_o_que_funcionou).toBe("");
    });

    it("returns empty strings for missing fields", () => {
      const json = JSON.stringify({ contexto: "Only this" });
      const result = parseInsightResponse(json);

      expect(result).not.toBeNull();
      expect(result!.contexto).toBe("Only this");
      expect(result!.gancho).toBe("");
      expect(result!.problema).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // isGenerateError
  // -----------------------------------------------------------------------

  describe("isGenerateError", () => {
    it("returns true for error results", () => {
      expect(isGenerateError({ error: "Something failed" })).toBe(true);
    });

    it("returns false for success results", () => {
      expect(
        isGenerateError({
          sections: {
            contexto: "",
            gancho: "",
            problema: "",
            solucao: "",
            cta: "",
            copie_o_que_funcionou: "",
          },
          tokensUsed: 100,
          rawResponse: {},
        }),
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // generateInsight (mocked fetch)
  // -----------------------------------------------------------------------

  describe("generateInsight", () => {
    const settings = {
      model: "gpt-4o-mini",
      temperature: 0.7,
      top_p: 0.9,
      max_output_tokens: 800,
    };

    it("returns error when API key is not configured", async () => {
      const { getSecretSetting } = await import("@/lib/settings");
      (getSecretSetting as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      const result = await generateInsight("Test prompt", settings);

      expect(isGenerateError(result)).toBe(true);
      if (isGenerateError(result)) {
        expect(result.error).toContain("OpenAI não configurada");
      }
    });

    it("returns sections from valid OpenAI response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                contexto: "Test context",
                gancho: "Test hook",
                problema: "Test problem",
                solucao: "Test solution",
                cta: "Test CTA",
                copie_o_que_funcionou: "Test copy",
              }),
            },
          },
        ],
        usage: { total_tokens: 250 },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        }),
      );

      const result = await generateInsight("Analyze this", settings);

      expect(isGenerateError(result)).toBe(false);
      if (!isGenerateError(result)) {
        expect(result.sections.contexto).toBe("Test context");
        expect(result.tokensUsed).toBe(250);
      }

      vi.unstubAllGlobals();
    });

    it("returns error on HTTP failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          text: async () => "Rate limited",
        }),
      );

      const result = await generateInsight("Analyze this", settings);

      expect(isGenerateError(result)).toBe(true);
      if (isGenerateError(result)) {
        expect(result.error).toContain("429");
      }

      vi.unstubAllGlobals();
    });

    it("returns error when response has no content", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ choices: [{ message: { content: null } }] }),
        }),
      );

      const result = await generateInsight("Analyze this", settings);

      expect(isGenerateError(result)).toBe(true);
      if (isGenerateError(result)) {
        expect(result.error).toContain("vazia");
      }

      vi.unstubAllGlobals();
    });
  });
});
