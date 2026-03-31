/**
 * Tests: app/api/admin/echotik/regions/route.ts
 *
 * Coverage: GET returns all regions, PUT toggles isActive,
 *          auth guards (401/403), validation (400/404/500).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedAdmin,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  region: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET, PUT } from "@/app/api/admin/echotik/regions/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_REGIONS = [
  { code: "BR", name: "Brasil", isActive: true, sortOrder: 0 },
  { code: "US", name: "United States", isActive: true, sortOrder: 1 },
  { code: "JP", name: "Japan", isActive: false, sortOrder: 2 },
];

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/echotik/regions", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/admin/echotik/regions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    prismaMock.region.findMany.mockResolvedValue(MOCK_REGIONS);
  });

  it("returns 200 with all regions", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.regions).toHaveLength(3);
    expect(body.regions[0].code).toBe("BR");
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as non-admin", async () => {
    mockAuthenticatedUser();
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 500 when DB fails", async () => {
    prismaMock.region.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

describe("PUT /api/admin/echotik/regions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    prismaMock.region.findUnique.mockResolvedValue(MOCK_REGIONS[0]);
    prismaMock.region.update.mockResolvedValue({
      ...MOCK_REGIONS[0],
      isActive: false,
    });
  });

  it("toggles isActive and returns updated region", async () => {
    const req = makeRequest({ code: "BR", isActive: false });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.region).toBeDefined();
    expect(prismaMock.region.update).toHaveBeenCalledWith({
      where: { code: "BR" },
      data: { isActive: false },
    });
  });

  it("updates sortOrder", async () => {
    const req = makeRequest({ code: "BR", sortOrder: 5 });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(prismaMock.region.update).toHaveBeenCalledWith({
      where: { code: "BR" },
      data: { sortOrder: 5 },
    });
  });

  it("returns 400 when code is missing", async () => {
    const req = makeRequest({ isActive: true });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when no valid fields provided", async () => {
    const req = makeRequest({ code: "BR" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when region does not exist", async () => {
    prismaMock.region.findUnique.mockResolvedValue(null);
    const req = makeRequest({ code: "XX", isActive: true });
    const res = await PUT(req);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeRequest({ code: "BR", isActive: false });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as non-admin", async () => {
    mockAuthenticatedUser();
    const req = makeRequest({ code: "BR", isActive: false });
    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("returns 500 when DB update fails", async () => {
    prismaMock.region.update.mockRejectedValue(new Error("DB error"));
    const req = makeRequest({ code: "BR", isActive: false });
    const res = await PUT(req);
    expect(res.status).toBe(500);
  });
});
