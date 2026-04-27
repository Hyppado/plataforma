/**
 * Tests: app/api/avatar-video/creations/route.ts
 *
 * POST /api/avatar-video/creations
 *
 * Coverage: auth, input validation, product lookup (detail/trend/both/neither),
 * draft creation, product update, success response, error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makePostRequest,
} from "@tests/helpers/auth";
import { buildAvatarVideoCreation } from "@tests/helpers/factories";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const getOrCreateDraftCreationMock = vi.hoisted(() => vi.fn());
const updateCreationProductMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  echotikProductDetail: {
    findUnique: vi.fn(),
  },
  echotikProductTrendDaily: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/avatar-video/service", () => ({
  getOrCreateDraftCreation: getOrCreateDraftCreationMock,
  updateCreationProduct: updateCreationProductMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from "@/app/api/avatar-video/creations/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRODUCT_EXTERNAL_ID = "prod-123";
const SELECTED_IMAGE_URL = "https://cdn.example.com/img.jpg";

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    productExternalId: PRODUCT_EXTERNAL_ID,
    selectedProductImageUrl: SELECTED_IMAGE_URL,
    source: "products-hype",
    ...overrides,
  };
}

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    productName: "Cool Product",
    blobUrl: "https://blob.vercel.app/img.jpg",
    coverUrl: "https://echotik.cdn/img.jpg",
    avgPrice: 1990,
    categoryId: "cat-1",
    ...overrides,
  };
}

function makeTrend(overrides: Record<string, unknown> = {}) {
  return {
    productName: "Trend Product",
    avgPrice: 2490,
    categoryId: "cat-trend",
    currency: "USD",
    ...overrides,
  };
}

function makeDraftCreation() {
  return buildAvatarVideoCreation({
    id: "creation-abc",
    userId: "user-test-id",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/avatar-video/creations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedUser({ id: "user-test-id" });
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue(makeDetail());
    prismaMock.echotikProductTrendDaily.findFirst.mockResolvedValue(
      makeTrend(),
    );
    getOrCreateDraftCreationMock.mockResolvedValue({
      ok: true,
      data: makeDraftCreation(),
    });
    updateCreationProductMock.mockResolvedValue({
      ok: true,
      data: makeDraftCreation(),
    });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(401);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/avatar-video/creations", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/inválido/i);
  });

  it("returns 400 when productExternalId is missing", async () => {
    const res = await POST(
      makePostRequest(
        "/api/avatar-video/creations",
        makeBody({ productExternalId: "" }),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/productExternalId/i);
  });

  it("returns 400 when selectedProductImageUrl is missing", async () => {
    const res = await POST(
      makePostRequest(
        "/api/avatar-video/creations",
        makeBody({ selectedProductImageUrl: "" }),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/selectedProductImageUrl/i);
  });

  it("returns 400 when source is invalid", async () => {
    const res = await POST(
      makePostRequest(
        "/api/avatar-video/creations",
        makeBody({ source: "videos-hype" }),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source/i);
  });

  it("accepts 'new-products' as a valid source", async () => {
    const res = await POST(
      makePostRequest(
        "/api/avatar-video/creations",
        makeBody({ source: "new-products" }),
      ),
    );
    expect(res.status).toBe(201);
  });

  // ── Product validation ─────────────────────────────────────────────────────

  it("returns 404 when product is not found in any table", async () => {
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue(null);
    prismaMock.echotikProductTrendDaily.findFirst.mockResolvedValue(null);
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/não encontrado/i);
  });

  it("accepts product found only in EchotikProductDetail (new product)", async () => {
    prismaMock.echotikProductTrendDaily.findFirst.mockResolvedValue(null);
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(201);
  });

  it("accepts product found only in EchotikProductTrendDaily (hype product without detail)", async () => {
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue(null);
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(201);
  });

  // ── Product snapshot building ──────────────────────────────────────────────

  it("passes blobUrl as productImageUrl when detail has blobUrl", async () => {
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(201);
    const [[, , product]] = updateCreationProductMock.mock.calls;
    expect(product.productImageUrl).toBe("https://blob.vercel.app/img.jpg");
    expect(product.productSelectedImageUrl).toBe(SELECTED_IMAGE_URL);
  });

  it("falls back to coverUrl when blobUrl is null", async () => {
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue(
      makeDetail({ blobUrl: null }),
    );
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    const [[, , product]] = updateCreationProductMock.mock.calls;
    expect(product.productImageUrl).toBe("https://echotik.cdn/img.jpg");
  });

  it("falls back to selectedProductImageUrl when detail has no image", async () => {
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue(
      makeDetail({ blobUrl: null, coverUrl: null }),
    );
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    const [[, , product]] = updateCreationProductMock.mock.calls;
    expect(product.productImageUrl).toBe(SELECTED_IMAGE_URL);
  });

  it("uses detail productName over trend productName", async () => {
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    const [[, , product]] = updateCreationProductMock.mock.calls;
    expect(product.productName).toBe("Cool Product");
  });

  it("falls back to trend productName when detail has no name", async () => {
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue(
      makeDetail({ productName: null }),
    );
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    const [[, , product]] = updateCreationProductMock.mock.calls;
    expect(product.productName).toBe("Trend Product");
  });

  it("uses trend currency", async () => {
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    const [[, , product]] = updateCreationProductMock.mock.calls;
    expect(product.productCurrency).toBe("USD");
  });

  it("defaults currency to USD when no trend", async () => {
    prismaMock.echotikProductTrendDaily.findFirst.mockResolvedValue(null);
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    const [[, , product]] = updateCreationProductMock.mock.calls;
    expect(product.productCurrency).toBe("USD");
  });

  it("passes productExternalId from input", async () => {
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    const [[, , product]] = updateCreationProductMock.mock.calls;
    expect(product.productExternalId).toBe(PRODUCT_EXTERNAL_ID);
  });

  // ── Service delegation ─────────────────────────────────────────────────────

  it("calls getOrCreateDraftCreation with the authenticated userId", async () => {
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    expect(getOrCreateDraftCreationMock).toHaveBeenCalledWith("user-test-id");
  });

  it("calls updateCreationProduct with userId and the draft creation id", async () => {
    await POST(makePostRequest("/api/avatar-video/creations", makeBody()));
    expect(updateCreationProductMock).toHaveBeenCalledWith(
      "user-test-id",
      "creation-abc",
      expect.objectContaining({ productExternalId: PRODUCT_EXTERNAL_ID }),
    );
  });

  // ── Success response ───────────────────────────────────────────────────────

  it("returns 201 with the creation id", async () => {
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: "creation-abc" });
  });

  // ── Service error propagation ──────────────────────────────────────────────

  it("returns 500 when getOrCreateDraftCreation fails", async () => {
    getOrCreateDraftCreationMock.mockResolvedValue({
      ok: false,
      error: "DB error",
      code: "internal",
    });
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB error");
  });

  it("returns 409 when updateCreationProduct fails with invalid_state", async () => {
    updateCreationProductMock.mockResolvedValue({
      ok: false,
      error: "Status inválido",
      code: "invalid_state",
    });
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 when updateCreationProduct fails with not_found", async () => {
    updateCreationProductMock.mockResolvedValue({
      ok: false,
      error: "Criação não encontrada.",
      code: "not_found",
    });
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 when updateCreationProduct fails with internal", async () => {
    updateCreationProductMock.mockResolvedValue({
      ok: false,
      error: "DB error",
      code: "internal",
    });
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(500);
  });

  it("returns 500 when prisma throws unexpectedly", async () => {
    prismaMock.echotikProductDetail.findUnique.mockRejectedValue(
      new Error("Connection lost"),
    );
    const res = await POST(
      makePostRequest("/api/avatar-video/creations", makeBody()),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Erro interno");
  });
});
