/**
 * Tests: app/api/usage/route.ts
 *
 * Coverage: auth, plan-based quota limits, usage period counters
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

// Mock dependencies
const {
  getUserActivePlanMock,
  getQuotaLimitsMock,
  getCurrentUsagePeriodMock,
  getPeriodBoundsMock,
} = vi.hoisted(() => ({
  getUserActivePlanMock: vi.fn(),
  getQuotaLimitsMock: vi.fn(),
  getCurrentUsagePeriodMock: vi.fn(),
  getPeriodBoundsMock: vi.fn(),
}));

vi.mock("@/lib/usage/quota", () => ({
  getUserActivePlan: getUserActivePlanMock,
  getQuotaLimits: getQuotaLimitsMock,
}));

vi.mock("@/lib/usage/period", () => ({
  getCurrentUsagePeriod: getCurrentUsagePeriodMock,
  getPeriodBounds: getPeriodBoundsMock,
}));

import { GET } from "@/app/api/usage/route";

const PERIOD_START = new Date("2025-01-01T00:00:00.000Z");
const PERIOD_END = new Date("2025-01-31T23:59:59.999Z");

describe("GET /api/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPeriodBoundsMock.mockReturnValue({
      start: PERIOD_START,
      end: PERIOD_END,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns plan-based quota limits and usage counters", async () => {
    mockAuthenticatedUser({ id: "u1" });

    const mockPlan = {
      id: "plan-1",
      name: "Pro",
      transcriptsPerMonth: 50,
      scriptsPerMonth: 100,
    };
    getUserActivePlanMock.mockResolvedValue(mockPlan);
    getQuotaLimitsMock.mockReturnValue({
      transcriptsPerMonth: 50,
      scriptsPerMonth: 100,
      insightTokensMonthlyMax: 60000,
      scriptTokensMonthlyMax: 25000,
      insightMaxOutputTokens: 900,
      scriptMaxOutputTokens: 1800,
    });
    getCurrentUsagePeriodMock.mockResolvedValue({
      transcriptsUsed: 7,
      scriptsUsed: 12,
      insightsUsed: 3,
      tokensUsed: 1500,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual({
      transcriptsUsed: 7,
      scriptsUsed: 12,
      insightsUsed: 3,
      transcriptsLimit: 50,
      scriptsLimit: 100,
      periodStart: PERIOD_START.toISOString(),
      periodEnd: PERIOD_END.toISOString(),
    });
  });

  it("returns zero usage when no period exists", async () => {
    mockAuthenticatedUser({ id: "u2" });

    getUserActivePlanMock.mockResolvedValue(null);
    getQuotaLimitsMock.mockReturnValue({
      transcriptsPerMonth: 0,
      scriptsPerMonth: 0,
      insightTokensMonthlyMax: 0,
      scriptTokensMonthlyMax: 0,
      insightMaxOutputTokens: 0,
      scriptMaxOutputTokens: 0,
    });
    getCurrentUsagePeriodMock.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.transcriptsUsed).toBe(0);
    expect(body.scriptsUsed).toBe(0);
    expect(body.insightsUsed).toBe(0);
    expect(body.transcriptsLimit).toBe(0);
    expect(body.scriptsLimit).toBe(0);
  });

  it("uses plan from AccessGrant when available", async () => {
    mockAuthenticatedUser({ id: "u3" });

    const grantPlan = {
      id: "plan-grant",
      name: "Admin Override",
      transcriptsPerMonth: 200,
      scriptsPerMonth: 300,
    };
    getUserActivePlanMock.mockResolvedValue(grantPlan);
    getQuotaLimitsMock.mockReturnValue({
      transcriptsPerMonth: 200,
      scriptsPerMonth: 300,
      insightTokensMonthlyMax: 0,
      scriptTokensMonthlyMax: 0,
      insightMaxOutputTokens: 0,
      scriptMaxOutputTokens: 0,
    });
    getCurrentUsagePeriodMock.mockResolvedValue({
      transcriptsUsed: 0,
      scriptsUsed: 0,
      insightsUsed: 0,
      tokensUsed: 0,
    });

    const res = await GET();
    const body = await res.json();

    expect(body.transcriptsLimit).toBe(200);
    expect(body.scriptsLimit).toBe(300);
  });

  it("calls getUserActivePlan with the authenticated userId", async () => {
    mockAuthenticatedUser({ id: "specific-user-id" });

    getUserActivePlanMock.mockResolvedValue(null);
    getQuotaLimitsMock.mockReturnValue({
      transcriptsPerMonth: 0,
      scriptsPerMonth: 0,
      insightTokensMonthlyMax: 0,
      scriptTokensMonthlyMax: 0,
      insightMaxOutputTokens: 0,
      scriptMaxOutputTokens: 0,
    });
    getCurrentUsagePeriodMock.mockResolvedValue(null);

    await GET();

    expect(getUserActivePlanMock).toHaveBeenCalledWith("specific-user-id");
    expect(getCurrentUsagePeriodMock).toHaveBeenCalledWith("specific-user-id");
  });
});
