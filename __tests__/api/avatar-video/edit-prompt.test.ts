/**
 * Tests: app/api/avatar-video/creations/[id]/edit-prompt/route.ts
 *
 * PATCH /api/avatar-video/creations/:id/edit-prompt
 *
 * Coverage: auth, body validation, success, error codes.
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

const saveEditedPromptMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/avatar-video/service", () => ({
  saveEditedPrompt: saveEditedPromptMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { PATCH } from "@/app/api/avatar-video/creations/[id]/edit-prompt/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATION_ID = "creation-abc";
const USER_ID = "user-abc";

function makeParams() {
  return { params: { id: CREATION_ID } };
}

function makeRequest(body: unknown) {
  return new Request(
    `http://localhost/api/avatar-video/creations/${CREATION_ID}/edit-prompt`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as any;
}

function makePromptReadyCreation() {
  const prompt = buildAvatarVideoPrompt({
    id: "prompt-1",
    creationId: CREATION_ID,
    status: "READY",
    promptText: "Original prompt",
    isEdited: false,
  });
  return buildAvatarVideoCreation({
    id: CREATION_ID,
    userId: USER_ID,
    status: "PROMPT_READY",
    prompt,
  }) as any;
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("PATCH /api/avatar-video/creations/[id]/edit-prompt — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await PATCH(makeRequest({ promptText: "text" }), makeParams());

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

describe("PATCH — body validation", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request(
      `http://localhost/api/avatar-video/creations/${CREATION_ID}/edit-prompt`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      },
    ) as any;

    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(400);
  });

  it("returns 400 when promptText is missing", async () => {
    const res = await PATCH(makeRequest({ promptJson: {} }), makeParams());

    expect(res.status).toBe(400);
  });

  it("returns 400 when promptText is not a string", async () => {
    const res = await PATCH(makeRequest({ promptText: 42 }), makeParams());

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe("PATCH — success", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 with updated creation on success", async () => {
    const creation = makePromptReadyCreation();
    saveEditedPromptMock.mockResolvedValue({ ok: true, data: creation });

    const res = await PATCH(
      makeRequest({ promptText: "My edited prompt" }),
      makeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("creation");
    expect(body.creation.id).toBe(CREATION_ID);
  });

  it("passes promptJson to service when provided", async () => {
    const creation = makePromptReadyCreation();
    saveEditedPromptMock.mockResolvedValue({ ok: true, data: creation });

    const promptJson = { prompt: "hello", takes: [] };
    await PATCH(makeRequest({ promptText: "hello", promptJson }), makeParams());

    expect(saveEditedPromptMock).toHaveBeenCalledWith(
      USER_ID,
      CREATION_ID,
      "hello",
      promptJson,
    );
  });

  it("calls service without promptJson when not provided", async () => {
    const creation = makePromptReadyCreation();
    saveEditedPromptMock.mockResolvedValue({ ok: true, data: creation });

    await PATCH(makeRequest({ promptText: "just text" }), makeParams());

    expect(saveEditedPromptMock).toHaveBeenCalledWith(
      USER_ID,
      CREATION_ID,
      "just text",
      undefined,
    );
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe("PATCH — error handling", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 404 when creation not found", async () => {
    saveEditedPromptMock.mockResolvedValue({
      ok: false,
      error: "Não encontrada.",
      code: "not_found",
    });

    const res = await PATCH(makeRequest({ promptText: "x" }), makeParams());

    expect(res.status).toBe(404);
  });

  it("returns 409 when status does not allow editing", async () => {
    saveEditedPromptMock.mockResolvedValue({
      ok: false,
      error: "Edição requer PROMPT_READY.",
      code: "invalid_state",
    });

    const res = await PATCH(makeRequest({ promptText: "x" }), makeParams());

    expect(res.status).toBe(409);
  });

  it("returns 500 on internal error", async () => {
    saveEditedPromptMock.mockResolvedValue({
      ok: false,
      error: "Erro interno.",
      code: "internal",
    });

    const res = await PATCH(makeRequest({ promptText: "x" }), makeParams());

    expect(res.status).toBe(500);
  });
});
