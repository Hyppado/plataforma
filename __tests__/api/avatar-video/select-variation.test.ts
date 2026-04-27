/**
 * Tests: app/api/avatar-video/creations/[id]/select-variation/route.ts
 *
 * PATCH /api/avatar-video/creations/:id/select-variation
 *
 * Coverage: auth, body validation, service success/errors, status mapping.
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

const selectImageVariationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/avatar-video/service", () => ({
  selectImageVariation: selectImageVariationMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { PATCH } from "@/app/api/avatar-video/creations/[id]/select-variation/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATION_ID = "creation-abc";
const VARIATION_ID = "variation-xyz";
const USER_ID = "user-123";

function makeParams() {
  return { params: { id: CREATION_ID } };
}

function makeRequest(body: unknown) {
  return new Request(
    `http://localhost/api/avatar-video/creations/${CREATION_ID}/select-variation`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as any;
}

function makeCreation() {
  return buildAvatarVideoCreation({
    id: CREATION_ID,
    userId: USER_ID,
    status: "IMAGES_READY",
    selectedImageVariationId: VARIATION_ID,
  }) as any;
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("PATCH select-variation — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();
    const res = await PATCH(makeRequest({ variationId: VARIATION_ID }), makeParams());
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

describe("PATCH select-variation — body validation", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 400 for non-JSON body", async () => {
    const req = new Request(
      `http://localhost/api/avatar-video/creations/${CREATION_ID}/select-variation`,
      { method: "PATCH", body: "not json" },
    ) as any;
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when variationId is a number", async () => {
    const res = await PATCH(makeRequest({ variationId: 42 }), makeParams());
    expect(res.status).toBe(400);
  });

  it("accepts null variationId (clears selection)", async () => {
    selectImageVariationMock.mockResolvedValue({
      ok: true,
      data: makeCreation(),
    });
    const res = await PATCH(makeRequest({ variationId: null }), makeParams());
    expect(res.status).toBe(200);
    expect(selectImageVariationMock).toHaveBeenCalledWith(USER_ID, CREATION_ID, null);
  });
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe("PATCH select-variation — success", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it("returns 200 with creation when selection succeeds", async () => {
    const creation = makeCreation();
    selectImageVariationMock.mockResolvedValue({ ok: true, data: creation });

    const res = await PATCH(makeRequest({ variationId: VARIATION_ID }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("creation");
    expect(body.creation.id).toBe(CREATION_ID);
    expect(selectImageVariationMock).toHaveBeenCalledWith(
      USER_ID,
      CREATION_ID,
      VARIATION_ID,
    );
  });
});

// ---------------------------------------------------------------------------
// Service errors → HTTP status mapping
// ---------------------------------------------------------------------------

describe("PATCH select-variation — service error mapping", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ id: USER_ID });
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: USER_ID });
  });

  it.each([
    ["not_found", 404],
    ["invalid_state", 409],
    ["internal", 500],
  ] as const)("maps %s → %i", async (code, expectedStatus) => {
    selectImageVariationMock.mockResolvedValue({
      ok: false,
      error: "Erro",
      code,
    });

    const res = await PATCH(makeRequest({ variationId: VARIATION_ID }), makeParams());
    expect(res.status).toBe(expectedStatus);
  });
});
