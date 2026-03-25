/**
 * Tests: lib/usage/ — quota enforcement, consumption, periods
 *
 * Priority: #2 (Business rules — usage limits)
 * Coverage: period bounds, quota limits, assertion logic, idempotent consumption
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  buildPlan,
  buildUsagePeriod,
  buildUsageEvent,
} from "@tests/helpers/factories";

// Must import after prisma mock is set up
import { getPeriodBounds } from "@/lib/usage/period";
import { getQuotaLimits } from "@/lib/usage/quota";
import { QuotaExceededError } from "@/lib/usage/enforce";

// ---------------------------------------------------------------------------
// getPeriodBounds — pure function
// ---------------------------------------------------------------------------
describe("getPeriodBounds()", () => {
  it("returns first and last moment of the month (UTC)", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const { start, end } = getPeriodBounds(date);

    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(2); // March = 2
    expect(start.getUTCDate()).toBe(1);
    expect(start.getUTCHours()).toBe(0);

    expect(end.getUTCMonth()).toBe(2);
    expect(end.getUTCDate()).toBe(31); // March has 31 days
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
  });

  it("handles February correctly", () => {
    const date = new Date("2026-02-10T00:00:00Z");
    const { start, end } = getPeriodBounds(date);
    expect(start.getUTCDate()).toBe(1);
    expect(end.getUTCDate()).toBe(28); // 2026 is not a leap year
  });

  it("handles December → no overflow to January", () => {
    const date = new Date("2025-12-25T00:00:00Z");
    const { start, end } = getPeriodBounds(date);
    expect(start.getUTCMonth()).toBe(11); // December
    expect(end.getUTCMonth()).toBe(11);
    expect(end.getUTCDate()).toBe(31);
  });

  it("defaults to current date when no argument", () => {
    const { start, end } = getPeriodBounds();
    const now = new Date();
    expect(start.getUTCMonth()).toBe(now.getUTCMonth());
    expect(start.getUTCFullYear()).toBe(now.getUTCFullYear());
  });
});

// ---------------------------------------------------------------------------
// getQuotaLimits — pure function
// ---------------------------------------------------------------------------
describe("getQuotaLimits()", () => {
  it("returns plan limits when plan exists", () => {
    const plan = buildPlan({
      transcriptsPerMonth: 100,
      scriptsPerMonth: 50,
      insightTokensMonthlyMax: 500000,
    });
    const limits = getQuotaLimits(plan as any);

    expect(limits.transcriptsPerMonth).toBe(100);
    expect(limits.scriptsPerMonth).toBe(50);
    expect(limits.insightTokensMonthlyMax).toBe(500000);
  });

  it("returns all zeros when plan is null (no plan = no quota)", () => {
    const limits = getQuotaLimits(null);

    expect(limits.transcriptsPerMonth).toBe(0);
    expect(limits.scriptsPerMonth).toBe(0);
    expect(limits.insightTokensMonthlyMax).toBe(0);
    expect(limits.scriptTokensMonthlyMax).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// QuotaExceededError — value object
// ---------------------------------------------------------------------------
describe("QuotaExceededError", () => {
  it("carries action, used, and limit info", () => {
    const err = new QuotaExceededError("TRANSCRIPT", 100, 100);
    expect(err.name).toBe("QuotaExceededError");
    expect(err.action).toBe("TRANSCRIPT");
    expect(err.used).toBe(100);
    expect(err.limit).toBe(100);
    expect(err.message).toContain("100 of 100");
  });
});

// ---------------------------------------------------------------------------
// consumeUsage — idempotency
// ---------------------------------------------------------------------------
describe("consumeUsage()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing event when idempotencyKey already exists (no double count)", async () => {
    const existingEvent = buildUsageEvent({ idempotencyKey: "key-1" });
    prismaMock.usageEvent.findUnique.mockResolvedValue(existingEvent);

    const { consumeUsage } = await import("@/lib/usage/consume");
    const result = await consumeUsage("user-1", "TRANSCRIPT", 0, {
      idempotencyKey: "key-1",
    });

    expect(result.duplicate).toBe(true);
    expect(result.event).toEqual(existingEvent);
    // Transaction should NOT have been called
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("creates event and increments counters for new consumption", async () => {
    prismaMock.usageEvent.findUnique.mockResolvedValue(null);
    const period = buildUsagePeriod();
    prismaMock.usagePeriod.upsert.mockResolvedValue(period);

    const newEvent = buildUsageEvent();
    prismaMock.$transaction.mockResolvedValue([period, newEvent]);

    const { consumeUsage } = await import("@/lib/usage/consume");
    const result = await consumeUsage("user-1", "TRANSCRIPT", 100, {
      idempotencyKey: "new-key",
    });

    expect(result.duplicate).toBe(false);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});
