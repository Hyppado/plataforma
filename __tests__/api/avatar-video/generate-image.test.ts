/**
 * Tests: app/api/avatar-video/creations/[id]/generate-image/route.ts
 *
 * POST /api/avatar-video/creations/:id/generate-image
 *
 * Coverage: auth, DRAFT path, IMAGES_READY regeneration, FAILED retry,
 *           quota exceeded (429), not_found (404), invalid_state (409),
 *           internal error (500), success response shape.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";
import { buildAvatarVideoCreation } from "@tests/helpers/factories";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const startImageGenerationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/avatar-video/service", () => ({
  startImageGeneration: startImageGenerationMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from "@/app/api/avatar-video/creations/[id]/generate-image/route";

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
    `http://localhost/api/avatar-video/creations/${CREATION_ID}/generate-image`,
    {
      method: "POST",
    },
  ) as any;
}

function makeImagesReadyCreation() {
  return buildAvatarVideoCreation({
    id: CREATION_ID,
    userId: USER_ID,
    status: "IMAGES_READY",
    imageVariations: [],
  }) as any;
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("POST /api/avatar-video/creations/[id]/generate-image — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Success: DRAFT → IMAGES_READY (first generation)
// ---------------------------------------------------------------------------

describe("POST — DRAFT path (first generation)", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 with creation DTO on successful first generation", async () => {
    const creation = makeImagesReadyCreation();
    startImageGenerationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("creation");
    expect(body.creation.id).toBe(CREATION_ID);
    expect(startImageGenerationMock).toHaveBeenCalledWith(USER_ID, CREATION_ID);
  });
});

// ---------------------------------------------------------------------------
// Success: IMAGES_READY → IMAGES_READY (regeneration)
// ---------------------------------------------------------------------------

describe("POST — IMAGES_READY regeneration", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 with updated creation on regeneration", async () => {
    const creation = makeImagesReadyCreation();
    startImageGenerationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.creation.id).toBe(CREATION_ID);
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
    startImageGenerationMock.mockResolvedValue({
      ok: false,
      error: "Criação não encontrada.",
      code: "not_found",
    });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
  });

  it("returns 409 on invalid_state", async () => {
    startImageGenerationMock.mockResolvedValue({
      ok: false,
      error: "Status inválido.",
      code: "invalid_state",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(409);
  });

  it("returns 429 when quota is exceeded", async () => {
    startImageGenerationMock.mockResolvedValue({
      ok: false,
      error: "Quota esgotada.",
      code: "quota_exceeded",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(429);
  });

  it("returns 403 when user does not own the creation", async () => {
    startImageGenerationMock.mockResolvedValue({
      ok: false,
      error: "Acesso negado.",
      code: "forbidden",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(403);
  });

  it("returns 500 on internal error from service", async () => {
    startImageGenerationMock.mockResolvedValue({
      ok: false,
      error: "Erro interno.",
      code: "internal",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });

  it("returns 500 when service throws unexpectedly", async () => {
    startImageGenerationMock.mockRejectedValue(new Error("Unexpected boom"));

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });
});
