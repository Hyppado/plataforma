/**
 * Tests: EchotikTab SWR data contracts
 *
 * Validates that the component correctly handles the response shapes
 * returned by each admin/echotik API endpoint. This prevents regressions
 * where the SWR type doesn't match the actual API envelope.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedAdmin,
} from "@tests/helpers/auth";
import type { EchotikHealthResponse } from "@/lib/types/echotik-admin";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const getEchotikHealthMock = vi.hoisted(() => vi.fn());
const getEchotikConfigMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  region: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/echotik/admin/health", () => ({
  getEchotikHealth: getEchotikHealthMock,
}));
vi.mock("@/lib/echotik/cron/config", () => ({
  getEchotikConfig: getEchotikConfigMock,
  applyConfigPatch: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET as getRegions } from "@/app/api/admin/echotik/regions/route";
import { GET as getConfig } from "@/app/api/admin/echotik/config/route";
import { GET as getHealth } from "@/app/api/admin/echotik/health/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_REGIONS = [
  { code: "BR", name: "Brasil", isActive: true, sortOrder: 0 },
  { code: "US", name: "United States", isActive: true, sortOrder: 1 },
];

const MOCK_CONFIG = {
  intervals: { categories: 168, videos: 24, products: 24, creators: 24 },
  pages: { videos: 5, products: 5, creators: 5 },
  detail: { batchSize: 10, maxAgeDays: 7 },
  enabledTasksRaw: "categories,videos,products,creators",
  enabledTasks: ["categories", "videos", "products", "creators"],
};

const MOCK_HEALTH: EchotikHealthResponse = {
  summary: {
    totalCombinations: 2,
    healthy: 2,
    stale: 0,
    failing: 0,
    neverRun: 0,
    inactive: 0,
    mostStale: null,
    activeRegionsCount: 2,
  },
  tasks: [],
  generatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Echotik admin API response shapes (data contract tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
  });

  it("GET /regions returns { regions: [...] } — array must be unwrapped", async () => {
    prismaMock.region.findMany.mockResolvedValue(MOCK_REGIONS);

    const res = await getRegions();
    const body = await res.json();

    // The API wraps regions in an object
    expect(body).toHaveProperty("regions");
    expect(Array.isArray(body.regions)).toBe(true);
    expect(body.regions).toHaveLength(2);

    // The component must access .regions, NOT treat the response as an array
    expect(Array.isArray(body)).toBe(false);
    expect(typeof body.regions.filter).toBe("function");
  });

  it("GET /config returns { config: {...} } — config must be unwrapped", async () => {
    getEchotikConfigMock.mockResolvedValue(MOCK_CONFIG);
    prismaMock.region.findMany.mockResolvedValue(MOCK_REGIONS);

    const res = await getConfig();
    const body = await res.json();

    // The API wraps config in an object
    expect(body).toHaveProperty("config");
    expect(body.config).toHaveProperty("intervals");
    expect(body.config).toHaveProperty("pages");

    // The component must access .config, NOT treat the response as EchotikConfig
    expect(body.intervals).toBeUndefined();
  });

  it("GET /health returns EchotikHealthResponse directly — no unwrapping needed", async () => {
    getEchotikHealthMock.mockResolvedValue(MOCK_HEALTH);

    const res = await getHealth();
    const body = await res.json();

    // Health is returned directly (not wrapped)
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("tasks");
    expect(body).toHaveProperty("generatedAt");
    expect(Array.isArray(body.tasks)).toBe(true);
  });
});
