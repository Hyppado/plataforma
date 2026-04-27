/**
 * Tests: app/api/avatar-video/scenarios/route.ts
 *
 * GET /api/avatar-video/scenarios
 *
 * Coverage: auth, success (default scenarios first, then by sortOrder),
 * inactive scenarios filtered out, empty list, internal DB error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthenticatedUser, mockUnauthenticated } from "@tests/helpers/auth";
import { buildVideoScenario } from "@tests/helpers/factories";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  videoScenario: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { GET } from "@/app/api/avatar-video/scenarios/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest() {
  return new NextRequest("http://localhost/api/avatar-video/scenarios", {
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/avatar-video/scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with active scenarios", async () => {
    mockAuthenticatedUser("user-test-id");
    const scenario1 = buildVideoScenario({ isDefault: true, sortOrder: 0 });
    const scenario2 = buildVideoScenario({ isDefault: false, sortOrder: 0 });
    prismaMock.videoScenario.findMany.mockResolvedValue([scenario1, scenario2]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scenarios).toHaveLength(2);
  });

  it("queries only active scenarios with correct orderBy (default first)", async () => {
    mockAuthenticatedUser("user-test-id");
    prismaMock.videoScenario.findMany.mockResolvedValue([]);

    await GET(makeGetRequest());

    expect(prismaMock.videoScenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      }),
    );
  });

  it("does not expose creations or internal fields", async () => {
    mockAuthenticatedUser("user-test-id");
    const scenario = buildVideoScenario();
    prismaMock.videoScenario.findMany.mockResolvedValue([
      {
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        promptHint: scenario.promptHint,
        isDefault: scenario.isDefault,
        sortOrder: scenario.sortOrder,
      },
    ]);

    const res = await GET(makeGetRequest());
    const body = await res.json();
    const item = body.scenarios[0];

    // Public fields present
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.promptHint).toBeDefined();
    expect(item.isDefault).toBeDefined();
    // Internal / relation fields must not be present
    expect(item.isActive).toBeUndefined();
    expect(item.creations).toBeUndefined();
  });

  it("returns empty array when no scenarios exist", async () => {
    mockAuthenticatedUser("user-test-id");
    prismaMock.videoScenario.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scenarios).toEqual([]);
  });

  it("returns 500 when DB throws", async () => {
    mockAuthenticatedUser("user-test-id");
    prismaMock.videoScenario.findMany.mockRejectedValue(new Error("db error"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("db error");
  });
});
