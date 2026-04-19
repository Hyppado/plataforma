/**
 * Tests: app/api/admin/echotik/config/route.ts
 *
 * Coverage: GET returns config, PUT saves valid patch,
 *          PUT rejects invalid patch, non-admin gets 401/403.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedAdmin,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";
import type { EchotikConfig } from "@/lib/types/echotik-admin";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  getEchotikConfigMock,
  saveEchotikConfigMock,
  validateEchotikConfigPatchMock,
} = vi.hoisted(() => ({
  getEchotikConfigMock: vi.fn(),
  saveEchotikConfigMock: vi.fn(),
  validateEchotikConfigPatchMock: vi.fn(),
}));

const DEFAULT_CONFIG: EchotikConfig = {
  intervals: { categories: 24, videos: 24, products: 24, creators: 24 },
  pages: { videos: 10, products: 10, creators: 10 },
  detail: { batchSize: 5, maxAgeDays: 7 },
  newProducts: { daysBack: 3, intervalHours: 24 },
  enabledTasksRaw: "categories,videos,products,creators,details,new-products",
  enabledTasks: ["categories", "videos", "products", "creators", "details", "new-products"],
};

vi.mock("@/lib/echotik/cron/config", () => ({
  getEchotikConfig: getEchotikConfigMock,
  saveEchotikConfig: saveEchotikConfigMock,
  validateEchotikConfigPatch: validateEchotikConfigPatchMock,
}));

const prismaMock = vi.hoisted(() => ({
  region: {
    findMany: vi.fn().mockResolvedValue([
      { code: "BR", name: "Brazil", isActive: true, sortOrder: 0 },
      { code: "US", name: "United States", isActive: true, sortOrder: 1 },
    ]),
    update: vi.fn().mockResolvedValue({}),
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

import { GET, PUT } from "@/app/api/admin/echotik/config/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/echotik/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/admin/echotik/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    getEchotikConfigMock.mockResolvedValue(DEFAULT_CONFIG);
    saveEchotikConfigMock.mockResolvedValue(undefined);
    validateEchotikConfigPatchMock.mockReturnValue([]);
    prismaMock.region.findMany.mockResolvedValue([
      { code: "BR", isActive: true, sortOrder: 0 },
    ]);
  });

  it("returns 200 with config and regions", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("config");
    expect(body).toHaveProperty("regions");
    expect(body.config.intervals).toBeDefined();
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

  it("returns 500 when config service throws", async () => {
    getEchotikConfigMock.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

describe("PUT /api/admin/echotik/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    validateEchotikConfigPatchMock.mockReturnValue([]); // no errors
    saveEchotikConfigMock.mockResolvedValue(undefined);
    getEchotikConfigMock.mockResolvedValue(DEFAULT_CONFIG);
  });

  it("saves valid patch and returns updated config", async () => {
    const req = makeRequest({
      intervals: { categories: 12, videos: 6, products: 6, creators: 12 },
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(saveEchotikConfigMock).toHaveBeenCalledOnce();
  });

  it("returns 400 when patch validation fails", async () => {
    validateEchotikConfigPatchMock.mockReturnValue([
      {
        field: "intervalVideos",
        message: "Interval: Videos must be a number between 1 and 720",
      },
    ]);
    const req = makeRequest({ intervalVideos: 0 });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details).toBeDefined();
    expect(saveEchotikConfigMock).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeRequest({});
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as non-admin", async () => {
    mockAuthenticatedUser();
    const req = makeRequest({});
    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("returns 500 when save throws", async () => {
    saveEchotikConfigMock.mockRejectedValue(new Error("DB error"));
    const req = makeRequest({ pages: { videos: 5, products: 5, creators: 5 } });
    const res = await PUT(req);
    expect(res.status).toBe(500);
  });
});
