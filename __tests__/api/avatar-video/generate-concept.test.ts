/**
 * Tests: app/api/avatar-video/creations/[id]/generate-concept/route.ts
 *
 * POST /api/avatar-video/creations/:id/generate-concept
 *
 * Coverage:
 *   - Auth guard (401 unauthenticated)
 *   - Success: IMAGES_READY → CONCEPT_READY (first generation)
 *   - Success: CONCEPT_READY → CONCEPT_READY (regeneration)
 *   - Error: not_found (404)
 *   - Error: invalid_state — wrong status (409)
 *   - Error: invalid_state — no READY images (409)
 *   - Error: internal (500)
 *   - Error: unexpected service throw (500)
 *   - Response shape includes creation + concept
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";
import {
  buildAvatarVideoCreation,
  buildAvatarVideoConcept,
  buildAvatarVideoImageVariation,
} from "@tests/helpers/factories";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const startConceptGenerationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/avatar-video/service", () => ({
  startConceptGeneration: startConceptGenerationMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from "@/app/api/avatar-video/creations/[id]/generate-concept/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATION_ID = "creation-abc";
const USER_ID = "user-123";

function makeParams() {
  return { params: { id: CREATION_ID } };
}

function makeRequest() {
  return new Request(
    `http://localhost/api/avatar-video/creations/${CREATION_ID}/generate-concept`,
    { method: "POST" },
  ) as any;
}

function makeReadyImage() {
  return buildAvatarVideoImageVariation({
    creationId: CREATION_ID,
    status: "READY",
    blobUrl: "https://example.com/image.png",
  });
}

function makeConceptReadyConcept() {
  return buildAvatarVideoConcept({
    id: "concept-1",
    creationId: CREATION_ID,
    status: "READY",
    videoIdea: "Um unboxing rápido mostrando o produto em uso.",
    hook: "Você precisa ver esse produto!",
    copy: "Esse produto mudou minha rotina completamente.",
    cta: "Compre agora pelo link na bio!",
    scenes: [
      { sceneNumber: 1, goal: "Captar atenção", description: "Avatar abre a caixa." },
      { sceneNumber: 2, goal: "Demonstrar benefício", description: "Avatar usa o produto." },
    ],
  });
}

function makeConceptReadyCreation() {
  return buildAvatarVideoCreation({
    id: CREATION_ID,
    userId: USER_ID,
    status: "CONCEPT_READY",
    imageVariations: [makeReadyImage()],
    concept: makeConceptReadyConcept(),
    prompt: null,
  }) as any;
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("POST /api/avatar-video/creations/[id]/generate-concept — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Success: IMAGES_READY → CONCEPT_READY (first generation)
// ---------------------------------------------------------------------------

describe("POST — first concept generation", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 with creation DTO including concept on success", async () => {
    const creation = makeConceptReadyCreation();
    startConceptGenerationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("creation");
    expect(body.creation.id).toBe(CREATION_ID);
    expect(body.creation.status).toBe("CONCEPT_READY");
    expect(body.creation.concept).not.toBeNull();
    expect(startConceptGenerationMock).toHaveBeenCalledWith(
      USER_ID,
      CREATION_ID,
    );
  });

  it("includes hook, copy, cta and scenes in concept data", async () => {
    const creation = makeConceptReadyCreation();
    startConceptGenerationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.creation.concept.hook).toBe("Você precisa ver esse produto!");
    expect(body.creation.concept.cta).toBe("Compre agora pelo link na bio!");
    expect(body.creation.concept.scenes).toHaveLength(2);
    expect(body.creation.concept.scenes[0]).toMatchObject({
      sceneNumber: 1,
      goal: expect.any(String),
      description: expect.any(String),
    });
  });

  it("calls startConceptGeneration with correct userId and creationId", async () => {
    const creation = makeConceptReadyCreation();
    startConceptGenerationMock.mockResolvedValue({ ok: true, data: creation });

    await POST(makeRequest(), makeParams());

    expect(startConceptGenerationMock).toHaveBeenCalledTimes(1);
    expect(startConceptGenerationMock).toHaveBeenCalledWith(
      USER_ID,
      CREATION_ID,
    );
  });
});

// ---------------------------------------------------------------------------
// Success: CONCEPT_READY → CONCEPT_READY (regeneration)
// ---------------------------------------------------------------------------

describe("POST — concept regeneration", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 on regeneration from CONCEPT_READY status", async () => {
    const creation = makeConceptReadyCreation();
    startConceptGenerationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect((await res.json()).creation.concept).not.toBeNull();
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
    startConceptGenerationMock.mockResolvedValue({
      ok: false,
      error: "Criação não encontrada.",
      code: "not_found",
    });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
  });

  it("returns 409 when status does not allow concept generation", async () => {
    startConceptGenerationMock.mockResolvedValue({
      ok: false,
      error: `Geração de conceito requer status IMAGES_READY ou CONCEPT_READY (atual: "DRAFT").`,
      code: "invalid_state",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(409);
  });

  it("returns 409 when no READY image variations exist", async () => {
    startConceptGenerationMock.mockResolvedValue({
      ok: false,
      error: "Nenhuma imagem pronta. Gere as imagens primeiro.",
      code: "invalid_state",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(409);
  });

  it("returns 500 on internal error from service", async () => {
    startConceptGenerationMock.mockResolvedValue({
      ok: false,
      error: "Erro interno na geração de conceito.",
      code: "internal",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });

  it("returns 500 when service throws unexpectedly", async () => {
    startConceptGenerationMock.mockRejectedValue(
      new Error("Unexpected failure"),
    );

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });
});
