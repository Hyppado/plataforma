/**
 * Tests: app/api/influencer-ia/usage/route.ts
 *
 * Coverage: auth guard, successful response, error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { getGenerationsTodayMock } = vi.hoisted(() => ({
  getGenerationsTodayMock: vi.fn(),
}));

vi.mock("@/lib/influencer-ia/quota", () => ({
  getInfluencerGenerationsToday: getGenerationsTodayMock,
  INFLUENCER_IA_DAILY_LIMIT: 5,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from "@/app/api/influencer-ia/usage/route";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/influencer-ia/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGenerationsTodayMock.mockResolvedValue(2);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns usedToday and dailyLimit for authenticated user", async () => {
    mockAuthenticatedUser();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      usedToday: number;
      dailyLimit: number;
    };
    expect(body.usedToday).toBe(2);
    expect(body.dailyLimit).toBe(5);
  });

  it("returns 500 when DB throws", async () => {
    mockAuthenticatedUser();
    getGenerationsTodayMock.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Internal server error");
  });
});
