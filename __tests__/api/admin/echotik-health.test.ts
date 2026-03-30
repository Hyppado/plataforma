/**
 * Tests: app/api/admin/echotik/health/route.ts
 *
 * Coverage: GET returns health data, auth guards (401/403), 500 on service error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedAdmin,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";
import type { EchotikHealthResponse } from "@/lib/types/echotik-admin";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const getEchotikHealthMock = vi.hoisted(() => vi.fn());

const MOCK_HEALTH: EchotikHealthResponse = {
  summary: {
    totalCombinations: 6,
    healthy: 4,
    stale: 1,
    failing: 0,
    neverRun: 1,
    inactive: 0,
    mostStale: null,
    activeRegionsCount: 3,
  },
  tasks: [
    {
      source: "echotik:videos:BR",
      task: "videos",
      region: "BR",
      regionName: "Brasil",
      isRegionActive: true,
      isTaskEnabled: true,
      status: "healthy",
      lastSuccessAt: new Date().toISOString(),
      lastFailureAt: null,
      lastRunAt: new Date().toISOString(),
      lastRunStatus: "SUCCESS",
      hoursSinceSuccess: 2,
      stalenessRatio: 0.08,
      failures24h: 0,
      lastErrorMessage: null,
      lastItemsProcessed: null,
      lastPagesProcessed: null,
      lastDurationMs: null,
    },
    {
      source: "echotik:categories",
      task: "categories",
      region: null,
      regionName: null,
      isRegionActive: true,
      isTaskEnabled: true,
      status: "stale",
      lastSuccessAt: new Date(Date.now() - 30 * 3600_000).toISOString(),
      lastFailureAt: null,
      lastRunAt: new Date(Date.now() - 30 * 3600_000).toISOString(),
      lastRunStatus: "SUCCESS",
      hoursSinceSuccess: 30,
      stalenessRatio: 1.25,
      failures24h: 0,
      lastErrorMessage: null,
      lastItemsProcessed: null,
      lastPagesProcessed: null,
      lastDurationMs: null,
    },
  ],
  generatedAt: new Date().toISOString(),
};

vi.mock("@/lib/echotik/admin/health", () => ({
  getEchotikHealth: getEchotikHealthMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from "@/app/api/admin/echotik/health/route";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/admin/echotik/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    getEchotikHealthMock.mockResolvedValue(MOCK_HEALTH);
  });

  it("returns 200 with health summary and tasks", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.totalCombinations).toBe(6);
    expect(body.summary.healthy).toBe(4);
    expect(body.tasks).toHaveLength(2);
  });

  it("returns the correct staleness data", async () => {
    const res = await GET();
    const body = await res.json();
    const categoriesTask = body.tasks.find(
      (t: { source: string }) => t.source === "echotik:categories",
    );
    expect(categoriesTask).toBeDefined();
    expect(categoriesTask.status).toBe("stale");
    expect(categoriesTask.stalenessRatio).toBeGreaterThan(1);
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

  it("returns 500 when health service throws", async () => {
    getEchotikHealthMock.mockRejectedValue(new Error("DB unavailable"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
