/**
 * Tests: lib/echotik/dates.ts — date helpers (pure functions)
 *
 * Priority: #3 (Used by cron and new products)
 * Coverage: formatting, date window calculation, edge cases
 */
import { describe, it, expect } from "vitest";
import { toCompactDate, newProductDateWindow } from "@/lib/echotik/dates";

describe("toCompactDate()", () => {
  it("formats a UTC date as yyyyMMdd", () => {
    expect(toCompactDate(new Date("2026-03-24T12:00:00Z"))).toBe("20260324");
  });

  it("pads single-digit months and days", () => {
    expect(toCompactDate(new Date("2026-01-05T00:00:00Z"))).toBe("20260105");
  });

  it("handles year boundaries", () => {
    expect(toCompactDate(new Date("2025-12-31T23:59:59Z"))).toBe("20251231");
    expect(toCompactDate(new Date("2026-01-01T00:00:00Z"))).toBe("20260101");
  });

  it("uses UTC (not local timezone)", () => {
    // Midnight UTC on Jan 1st — should be "20260101" regardless of local TZ
    const d = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(toCompactDate(d)).toBe("20260101");
  });
});

describe("newProductDateWindow()", () => {
  const fixedNow = new Date("2026-03-24T15:30:00Z");

  it("defaults to 3-day window", () => {
    const { min, max } = newProductDateWindow(3, fixedNow);
    expect(min).toBe("20260321");
    expect(max).toBe("20260324");
  });

  it("supports custom daysBack", () => {
    const { min, max } = newProductDateWindow(7, fixedNow);
    expect(min).toBe("20260317");
    expect(max).toBe("20260324");
  });

  it("handles month boundary (going back across months)", () => {
    const march1 = new Date("2026-03-01T10:00:00Z");
    const { min } = newProductDateWindow(3, march1);
    expect(min).toBe("20260226"); // crosses into February
  });

  it("handles 1-day window", () => {
    const { min, max } = newProductDateWindow(1, fixedNow);
    expect(min).toBe("20260323");
    expect(max).toBe("20260324");
  });

  it("handles 0-day window (same day)", () => {
    const { min, max } = newProductDateWindow(0, fixedNow);
    expect(min).toBe("20260324");
    expect(max).toBe("20260324");
  });

  it("uses UTC date (ignores time component)", () => {
    // Even at 23:59 UTC, the "today" should be the same date
    const lateNight = new Date("2026-03-24T23:59:59Z");
    const { max } = newProductDateWindow(3, lateNight);
    expect(max).toBe("20260324");
  });
});
