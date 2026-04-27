/**
 * Tests: app/api/avatar-video/creations/[id]/route.ts
 *
 * GET  /api/avatar-video/creations/[id] — Load creation state
 * PATCH /api/avatar-video/creations/[id] — Update selections
 *
 * Coverage: auth, GET success/404/500, PATCH input validation per field,
 * partial updates, all service result codes, success response.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makePostRequest,
} from "@tests/helpers/auth";
import { buildAvatarVideoCreation } from "@tests/helpers/factories";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const updateCreationSelectionsMock = vi.hoisted(() => vi.fn());
const getCreationDetailMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/avatar-video/service", () => ({
  updateCreationSelections: updateCreationSelectionsMock,
  getCreationDetail: getCreationDetailMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { PATCH, GET } from "@/app/api/avatar-video/creations/[id]/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATION_ID = "creation-abc";

function makeParams() {
  return { params: { id: CREATION_ID } };
}

function makePatchRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/avatar-video/creations/${CREATION_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeCreation(overrides: Record<string, unknown> = {}) {
  return buildAvatarVideoCreation({
    id: CREATION_ID,
    userId: "user-test-id",
    ...overrides,
  });
}

function mockServiceOk(overrides: Record<string, unknown> = {}) {
  updateCreationSelectionsMock.mockResolvedValue({
    ok: true,
    data: makeCreation(overrides),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/avatar-video/creations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: "user-test-id" });
    mockServiceOk();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const res = await PATCH(makePatchRequest({}), makeParams());
    expect(res.status).toBe(401);
  });

  // ── Input validation — body ───────────────────────────────────────────────

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest(
      `http://localhost/api/avatar-video/creations/${CREATION_ID}`,
      {
        method: "PATCH",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });

  // ── Input validation — per field ──────────────────────────────────────────

  it("returns 400 when avatarId is not a string", async () => {
    const res = await PATCH(makePatchRequest({ avatarId: 123 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/avatarId/i);
  });

  it("returns 400 when uploadedAvatarImageUrl is not a string", async () => {
    const res = await PATCH(
      makePatchRequest({ uploadedAvatarImageUrl: true }),
      makeParams(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/uploadedAvatarImageUrl/i);
  });

  it("returns 400 when scenarioId is not a string", async () => {
    const res = await PATCH(makePatchRequest({ scenarioId: [] }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/scenarioId/i);
  });

  it("returns 400 when customScenarioDescription is not a string", async () => {
    const res = await PATCH(
      makePatchRequest({ customScenarioDescription: 99 }),
      makeParams(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/customScenarioDescription/i);
  });

  it("returns 400 when tone is not a string", async () => {
    const res = await PATCH(makePatchRequest({ tone: {} }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tone/i);
  });

  it("returns 400 when duration is not a string", async () => {
    const res = await PATCH(
      makePatchRequest({ duration: false }),
      makeParams(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duration/i);
  });

  it("returns 400 when takeCount is not an integer", async () => {
    const res = await PATCH(makePatchRequest({ takeCount: 1.5 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takeCount/i);
  });

  it("returns 400 when takeCount is less than 1", async () => {
    const res = await PATCH(makePatchRequest({ takeCount: 0 }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when takeCount is greater than 5", async () => {
    const res = await PATCH(makePatchRequest({ takeCount: 6 }), makeParams());
    expect(res.status).toBe(400);
  });

  it("accepts null for nullable fields", async () => {
    const res = await PATCH(
      makePatchRequest({ avatarId: null, scenarioId: null, tone: null }),
      makeParams(),
    );
    expect(res.status).toBe(200);
  });

  // ── Service delegation ────────────────────────────────────────────────────

  it("maps avatarId → avatarProfileId in selections", async () => {
    await PATCH(makePatchRequest({ avatarId: "avatar-1" }), makeParams());
    expect(updateCreationSelectionsMock).toHaveBeenCalledWith(
      "user-test-id",
      CREATION_ID,
      expect.objectContaining({ avatarProfileId: "avatar-1" }),
    );
  });

  it("maps scenarioId → videoScenarioId in selections", async () => {
    await PATCH(makePatchRequest({ scenarioId: "scenario-1" }), makeParams());
    expect(updateCreationSelectionsMock).toHaveBeenCalledWith(
      "user-test-id",
      CREATION_ID,
      expect.objectContaining({ videoScenarioId: "scenario-1" }),
    );
  });

  it("passes uploadedAvatarImageUrl directly", async () => {
    const url = "https://blob.vercel.app/avatar.jpg";
    await PATCH(
      makePatchRequest({ uploadedAvatarImageUrl: url }),
      makeParams(),
    );
    expect(updateCreationSelectionsMock).toHaveBeenCalledWith(
      "user-test-id",
      CREATION_ID,
      expect.objectContaining({ uploadedAvatarImageUrl: url }),
    );
  });

  it("passes customScenarioDescription directly", async () => {
    await PATCH(
      makePatchRequest({
        customScenarioDescription: "Sell the product in a casual kitchen scene",
      }),
      makeParams(),
    );
    expect(updateCreationSelectionsMock).toHaveBeenCalledWith(
      "user-test-id",
      CREATION_ID,
      expect.objectContaining({
        customScenarioDescription: "Sell the product in a casual kitchen scene",
      }),
    );
  });

  it("passes tone, duration, and takeCount directly", async () => {
    await PATCH(
      makePatchRequest({ tone: "energetic", duration: "30s", takeCount: 3 }),
      makeParams(),
    );
    expect(updateCreationSelectionsMock).toHaveBeenCalledWith(
      "user-test-id",
      CREATION_ID,
      expect.objectContaining({
        tone: "energetic",
        duration: "30s",
        takeCount: 3,
      }),
    );
  });

  it("omits keys not present in the body (partial update)", async () => {
    await PATCH(makePatchRequest({ tone: "casual" }), makeParams());
    const [, , selections] = updateCreationSelectionsMock.mock.calls[0];
    expect(Object.keys(selections)).toEqual(["tone"]);
    expect("avatarProfileId" in selections).toBe(false);
    expect("videoScenarioId" in selections).toBe(false);
  });

  it("includes all provided keys in one call", async () => {
    await PATCH(
      makePatchRequest({
        avatarId: "a-1",
        uploadedAvatarImageUrl: "https://blob.vercel.app/img.jpg",
        scenarioId: "s-1",
        customScenarioDescription: "desc",
        tone: "professional",
        duration: "60s",
        takeCount: 2,
      }),
      makeParams(),
    );
    const [, , selections] = updateCreationSelectionsMock.mock.calls[0];
    expect(Object.keys(selections)).toHaveLength(7);
  });

  // ── Success response ───────────────────────────────────────────────────────

  it("returns 200 with the updated creation", async () => {
    const res = await PATCH(
      makePatchRequest({ avatarId: "a-1" }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("creation");
    expect(body.creation.id).toBe(CREATION_ID);
  });

  // ── Service error propagation ─────────────────────────────────────────────

  it("returns 404 when service returns not_found", async () => {
    updateCreationSelectionsMock.mockResolvedValue({
      ok: false,
      error: "Criação não encontrada.",
      code: "not_found",
    });
    const res = await PATCH(
      makePatchRequest({ avatarId: "a-1" }),
      makeParams(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when service returns invalid_state", async () => {
    updateCreationSelectionsMock.mockResolvedValue({
      ok: false,
      error: "Não é possível alterar seleções.",
      code: "invalid_state",
    });
    const res = await PATCH(
      makePatchRequest({ avatarId: "a-1" }),
      makeParams(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("seleções");
  });

  it("returns 500 when service returns internal error", async () => {
    updateCreationSelectionsMock.mockResolvedValue({
      ok: false,
      error: "DB error",
      code: "internal",
    });
    const res = await PATCH(
      makePatchRequest({ avatarId: "a-1" }),
      makeParams(),
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/avatar-video/creations/[id]
// ---------------------------------------------------------------------------

describe("GET /api/avatar-video/creations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeGetRequest() {
    return new NextRequest(
      `http://localhost/api/avatar-video/creations/${CREATION_ID}`,
      { method: "GET" },
    );
  }

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 200 with creation DTO on success", async () => {
    mockAuthenticatedUser("user-test-id");
    const creation = makeCreation({ status: "IMAGES_READY" });
    getCreationDetailMock.mockResolvedValue({ ok: true, data: creation });

    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creation.id).toBe(creation.id);
    expect(body.creation.status).toBe("IMAGES_READY");
    expect(body.creation.userId).toBe("user-test-id");
    expect(getCreationDetailMock).toHaveBeenCalledWith(
      "user-test-id",
      CREATION_ID,
    );
  });

  it("returns 404 when creation not found or belongs to another user", async () => {
    mockAuthenticatedUser("user-test-id");
    getCreationDetailMock.mockResolvedValue({
      ok: false,
      error: "Creation not found",
      code: "not_found",
    });

    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 500 when service returns internal error", async () => {
    mockAuthenticatedUser("user-test-id");
    getCreationDetailMock.mockResolvedValue({
      ok: false,
      error: "DB error",
      code: "internal",
    });

    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 on unexpected throw", async () => {
    mockAuthenticatedUser("user-test-id");
    getCreationDetailMock.mockRejectedValue(new Error("unexpected"));

    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("unexpected");
  });

  it("returns 400 when id param is empty", async () => {
    mockAuthenticatedUser("user-test-id");
    const req = new NextRequest(
      "http://localhost/api/avatar-video/creations/",
      { method: "GET" },
    );
    const res = await GET(req, { params: { id: "" } });
    expect(res.status).toBe(400);
  });
});
