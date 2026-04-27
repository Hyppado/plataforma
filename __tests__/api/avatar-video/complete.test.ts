/**
 * Tests: app/api/avatar-video/creations/[id]/complete/route.ts
 *
 * POST /api/avatar-video/creations/:id/complete
 *
 * Coverage: auth, PROMPT_READY → COMPLETED, not_found (404),
 *           invalid_state (409), internal (500).
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

const completeCreationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/avatar-video/service", () => ({
  completeCreation: completeCreationMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from "@/app/api/avatar-video/creations/[id]/complete/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATION_ID = "creation-complete-xyz";
const USER_ID = "user-complete-xyz";

function makeParams() {
  return { params: { id: CREATION_ID } };
}

function makeRequest() {
  return new Request(
    `http://localhost/api/avatar-video/creations/${CREATION_ID}/complete`,
    { method: "POST" },
  ) as any;
}

function makeCompletedCreation() {
  return buildAvatarVideoCreation({
    id: CREATION_ID,
    userId: USER_ID,
    status: "COMPLETED",
  }) as any;
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("POST /api/avatar-video/creations/[id]/complete — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe("POST — success", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 with completed creation", async () => {
    const creation = makeCompletedCreation();
    completeCreationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("creation");
    expect(body.creation.status).toBe("COMPLETED");
    expect(completeCreationMock).toHaveBeenCalledWith(USER_ID, CREATION_ID);
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
    completeCreationMock.mockResolvedValue({
      ok: false,
      error: "Não encontrada.",
      code: "not_found",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(404);
  });

  it("returns 409 when status is not PROMPT_READY", async () => {
    completeCreationMock.mockResolvedValue({
      ok: false,
      error: "Finalizar requer PROMPT_READY.",
      code: "invalid_state",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(409);
  });

  it("returns 500 on internal error", async () => {
    completeCreationMock.mockResolvedValue({
      ok: false,
      error: "Erro interno.",
      code: "internal",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });
});
