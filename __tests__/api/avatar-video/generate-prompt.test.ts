/**
 * Tests: app/api/avatar-video/creations/[id]/generate-prompt/route.ts
 *
 * POST /api/avatar-video/creations/:id/generate-prompt
 *
 * Coverage: auth, CONCEPT_READY → PROMPT_READY (first generation),
 *           PROMPT_READY → PROMPT_READY (regeneration),
 *           not_found (404), invalid_state (409), internal (500),
 *           success response shape (creation + prompt).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";
import {
  buildAvatarVideoCreation,
  buildAvatarVideoPrompt,
} from "@tests/helpers/factories";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const startPromptGenerationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/avatar-video/service", () => ({
  startPromptGeneration: startPromptGenerationMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from "@/app/api/avatar-video/creations/[id]/generate-prompt/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATION_ID = "creation-xyz";
const USER_ID = "user-456";

function makeParams() {
  return { params: { id: CREATION_ID } };
}

function makeRequest() {
  return new Request(
    `http://localhost/api/avatar-video/creations/${CREATION_ID}/generate-prompt`,
    { method: "POST" },
  ) as any;
}

function makePromptReadyCreation() {
  const prompt = buildAvatarVideoPrompt({
    id: "prompt-1",
    creationId: CREATION_ID,
    status: "READY",
    promptJson: {
      prompt: "Um vídeo de produto para TikTok",
      duration: 30,
      aspectRatio: "9:16",
      style: "ugc",
      language: "pt-BR",
      takes: [
        {
          index: 1,
          cameraDirection: "Plano médio",
          visualDirection: "Avatar segura o produto",
          spokenLines: "Esse produto é incrível!",
        },
      ],
    },
    promptText: "Um vídeo de produto para TikTok",
  });
  return buildAvatarVideoCreation({
    id: CREATION_ID,
    userId: USER_ID,
    status: "PROMPT_READY",
    imageVariations: [],
    prompt,
  }) as any;
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("POST /api/avatar-video/creations/[id]/generate-prompt — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Success: CONCEPT_READY → PROMPT_READY (first generation)
// ---------------------------------------------------------------------------

describe("POST — first prompt generation", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 with creation DTO including prompt JSON on success", async () => {
    const creation = makePromptReadyCreation();
    startPromptGenerationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("creation");
    expect(body.creation.id).toBe(CREATION_ID);
    expect(body.creation.status).toBe("PROMPT_READY");
    expect(body.creation.prompt).not.toBeNull();
    expect(startPromptGenerationMock).toHaveBeenCalledWith(
      USER_ID,
      CREATION_ID,
    );
  });

  it("includes takes in the prompt JSON when present", async () => {
    const creation = makePromptReadyCreation();
    startPromptGenerationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.creation.prompt.promptJson.takes).toHaveLength(1);
    expect(body.creation.prompt.promptJson.takes[0]).toMatchObject({
      index: 1,
      cameraDirection: expect.any(String),
      visualDirection: expect.any(String),
      spokenLines: expect.any(String),
    });
  });
});

// ---------------------------------------------------------------------------
// Success: PROMPT_READY → PROMPT_READY (regeneration)
// ---------------------------------------------------------------------------

describe("POST — prompt regeneration", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 on regeneration from PROMPT_READY status", async () => {
    const creation = makePromptReadyCreation();
    startPromptGenerationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe("POST — error handling", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 404 when creation not found", async () => {
    startPromptGenerationMock.mockResolvedValue({
      ok: false,
      error: "Criação não encontrada.",
      code: "not_found",
    });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
  });

  it("returns 409 when status does not allow prompt generation", async () => {
    startPromptGenerationMock.mockResolvedValue({
      ok: false,
      error: "Geração de prompt requer status CONCEPT_READY ou PROMPT_READY (atual: \"DRAFT\").",
      code: "invalid_state",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(409);
  });

  it("returns 409 when no READY image variations exist", async () => {
    startPromptGenerationMock.mockResolvedValue({
      ok: false,
      error: "Nenhuma imagem pronta.",
      code: "invalid_state",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(409);
  });

  it("returns 500 on internal error from service", async () => {
    startPromptGenerationMock.mockResolvedValue({
      ok: false,
      error: "Erro interno.",
      code: "internal",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });

  it("returns 500 when service throws unexpectedly", async () => {
    startPromptGenerationMock.mockRejectedValue(
      new Error("Unexpected failure"),
    );

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });
});
