/**
 * Tests: lib/insight/service.ts
 *
 * Coverage: requestInsight (sync flow: transcript → OpenAI → persist),
 *          getInsight (read existing insight), buildPrompt
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@tests/helpers/prisma-mock";
import { prismaMock } from "@tests/helpers/prisma-mock";

// Mock dependencies
const { generateInsightMock } = vi.hoisted(() => ({
  generateInsightMock: vi.fn(),
}));

vi.mock("@/lib/insight/generate", () => ({
  generateInsight: generateInsightMock,
  isGenerateError: (result: unknown) =>
    result !== null &&
    typeof result === "object" &&
    "error" in (result as Record<string, unknown>),
}));

const { getTranscriptMock, requestTranscriptMock } = vi.hoisted(() => ({
  getTranscriptMock: vi.fn(),
  requestTranscriptMock: vi.fn(),
}));

vi.mock("@/lib/transcription/service", () => ({
  getTranscript: getTranscriptMock,
  requestTranscript: requestTranscriptMock,
}));

const { getPromptConfigFromDBMock } = vi.hoisted(() => ({
  getPromptConfigFromDBMock: vi.fn(),
}));

vi.mock("@/lib/admin/config", () => ({
  getPromptConfigFromDB: getPromptConfigFromDBMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { requestInsight, getInsight } from "@/lib/insight/service";

const DEFAULT_PROMPT_CONFIG = {
  insight: {
    template:
      "Analyze: {{transcript_text}} for {{video_title}} by {{video_creator}}",
    settings: {
      model: "gpt-4o-mini",
      temperature: 0.7,
      top_p: 0.9,
      max_output_tokens: 800,
    },
  },
  script: {
    template: "Script template",
    settings: {
      model: "gpt-4o-mini",
      temperature: 0.8,
      top_p: 0.95,
      max_output_tokens: 1500,
    },
  },
};

describe("lib/insight/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPromptConfigFromDBMock.mockResolvedValue(DEFAULT_PROMPT_CONFIG);
    getTranscriptMock.mockResolvedValue(null);
    requestTranscriptMock.mockResolvedValue({
      status: "FAILED",
      transcriptText: null,
      errorMessage: "No transcript",
      isNew: false,
    });
    generateInsightMock.mockResolvedValue({ error: "Not configured" });
  });

  // -----------------------------------------------------------------------
  // requestInsight
  // -----------------------------------------------------------------------

  describe("requestInsight", () => {
    it("returns existing READY insight without reprocessing", async () => {
      const existing = {
        id: "ins-1",
        videoExternalId: "vid-123",
        userId: "user-1",
        status: "READY",
        contextText: "Context text",
        hookText: "Hook text",
        problemText: "Problem text",
        solutionText: "Solution text",
        ctaText: "CTA text",
        copyWorkedText: "Copy text",
        errorMessage: null,
        tokensUsed: 150,
      };
      (
        prismaMock.videoInsight.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existing);

      const result = await requestInsight("vid-123", "user-1");

      expect(result.isNew).toBe(false);
      expect(result.status).toBe("READY");
      expect(result.contextText).toBe("Context text");
      expect(result.hookText).toBe("Hook text");
      expect(result.copyWorkedText).toBe("Copy text");
      // Should NOT call generate
      expect(generateInsightMock).not.toHaveBeenCalled();
    });

    it("re-processes FAILED insight", async () => {
      const existing = {
        id: "ins-2",
        videoExternalId: "vid-456",
        userId: "user-1",
        status: "FAILED",
        errorMessage: "Previous error",
        contextText: null,
        hookText: null,
        problemText: null,
        solutionText: null,
        ctaText: null,
        copyWorkedText: null,
        tokensUsed: 0,
      };
      (
        prismaMock.videoInsight.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existing);
      (
        prismaMock.videoInsight.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...existing,
        status: "FAILED",
        errorMessage: "No transcript",
      });

      // No transcript available
      getTranscriptMock.mockResolvedValue(null);
      requestTranscriptMock.mockResolvedValue({
        status: "FAILED",
        transcriptText: null,
        errorMessage: "Could not transcribe",
        isNew: false,
      });

      const result = await requestInsight("vid-456", "user-1");

      expect(result.status).toBe("FAILED");
      expect(result.errorMessage).toBeTruthy();
    });

    it("creates new insight and generates from existing transcript", async () => {
      // No existing insight
      (
        prismaMock.videoInsight.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      // Create returns a new record
      const newInsight = {
        id: "ins-new",
        videoExternalId: "vid-789",
        userId: "user-1",
        status: "PENDING",
      };
      (
        prismaMock.videoInsight.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(newInsight);

      // Mock update for PROCESSING and READY states
      (
        prismaMock.videoInsight.update as ReturnType<typeof vi.fn>
      ).mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...newInsight,
          ...data,
          videoExternalId: "vid-789",
        }),
      );

      // Existing transcript
      getTranscriptMock.mockResolvedValue({
        status: "READY",
        transcriptText: "Hello, this is a test transcript.",
      });

      // OpenAI returns sections
      generateInsightMock.mockResolvedValue({
        sections: {
          contexto: "Test context",
          gancho: "Test hook",
          problema: "Test problem",
          solucao: "Test solution",
          cta: "Test CTA",
          copie_o_que_funcionou: "Test copy",
        },
        tokensUsed: 200,
        rawResponse: { choices: [] },
      });

      const result = await requestInsight(
        "vid-789",
        "user-1",
        "Video Title",
        "creator123",
      );

      expect(result.isNew).toBe(true);
      expect(result.status).toBe("READY");
      expect(result.tokensUsed).toBe(200);

      // Verify prompt was built with substituted variables
      expect(generateInsightMock).toHaveBeenCalledWith(
        expect.stringContaining("Hello, this is a test transcript."),
        DEFAULT_PROMPT_CONFIG.insight.settings,
      );
      expect(generateInsightMock).toHaveBeenCalledWith(
        expect.stringContaining("Video Title"),
        expect.any(Object),
      );
      expect(generateInsightMock).toHaveBeenCalledWith(
        expect.stringContaining("creator123"),
        expect.any(Object),
      );
    });

    it("generates transcript if none exists, then generates insight", async () => {
      (
        prismaMock.videoInsight.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prismaMock.videoInsight.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "ins-new-2",
        videoExternalId: "vid-no-transcript",
        userId: "user-1",
        status: "PENDING",
      });
      (
        prismaMock.videoInsight.update as ReturnType<typeof vi.fn>
      ).mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: "ins-new-2",
          videoExternalId: "vid-no-transcript",
          ...data,
        }),
      );

      // No existing transcript
      getTranscriptMock.mockResolvedValue(null);

      // requestTranscript generates one
      requestTranscriptMock.mockResolvedValue({
        status: "READY",
        transcriptText: "Generated transcript text",
        isNew: true,
      });

      generateInsightMock.mockResolvedValue({
        sections: {
          contexto: "C",
          gancho: "G",
          problema: "P",
          solucao: "S",
          cta: "CTA",
          copie_o_que_funcionou: "Copy",
        },
        tokensUsed: 100,
        rawResponse: {},
      });

      const result = await requestInsight("vid-no-transcript", "user-1");

      expect(result.status).toBe("READY");
      expect(requestTranscriptMock).toHaveBeenCalledWith(
        "vid-no-transcript",
        "user-1",
      );
    });

    it("fails when OpenAI returns an error", async () => {
      (
        prismaMock.videoInsight.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prismaMock.videoInsight.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "ins-err",
        videoExternalId: "vid-err",
        userId: "user-1",
        status: "PENDING",
      });
      (
        prismaMock.videoInsight.update as ReturnType<typeof vi.fn>
      ).mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: "ins-err",
          videoExternalId: "vid-err",
          ...data,
        }),
      );

      getTranscriptMock.mockResolvedValue({
        status: "READY",
        transcriptText: "Some text",
      });

      generateInsightMock.mockResolvedValue({
        error: "Chave OpenAI não configurada. Peça ao administrador.",
      });

      const result = await requestInsight("vid-err", "user-1");

      expect(result.status).toBe("FAILED");
      expect(result.errorMessage).toContain("OpenAI");
    });

    it("returns PROCESSING insight unchanged", async () => {
      const processing = {
        id: "ins-proc",
        videoExternalId: "vid-proc",
        userId: "user-1",
        status: "PROCESSING",
        contextText: null,
        hookText: null,
        problemText: null,
        solutionText: null,
        ctaText: null,
        copyWorkedText: null,
        errorMessage: null,
        tokensUsed: 0,
      };
      (
        prismaMock.videoInsight.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(processing);

      const result = await requestInsight("vid-proc", "user-1");

      expect(result.status).toBe("PROCESSING");
      expect(result.isNew).toBe(false);
      expect(generateInsightMock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getInsight
  // -----------------------------------------------------------------------

  describe("getInsight", () => {
    it("returns insight when found", async () => {
      const insight = {
        videoExternalId: "vid-123",
        status: "READY",
        contextText: "Context",
        hookText: "Hook",
        problemText: "Problem",
        solutionText: "Solution",
        ctaText: "CTA",
        copyWorkedText: "Copy",
        errorMessage: null,
        createdAt: new Date("2025-01-01"),
        readyAt: new Date("2025-01-01"),
      };
      (
        prismaMock.videoInsight.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(insight);

      const result = await getInsight("vid-123", "user-1");

      expect(result).not.toBeNull();
      expect(result!.status).toBe("READY");
      expect(result!.contextText).toBe("Context");
    });

    it("returns null when not found", async () => {
      (
        prismaMock.videoInsight.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getInsight("vid-missing", "user-1");

      expect(result).toBeNull();
    });
  });
});
