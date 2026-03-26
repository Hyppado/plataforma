/**
 * Tests: lib/echotik/cron/helpers.ts — Date helpers and utility functions
 */
import { describe, it, expect } from "vitest";
import {
  sha256,
  formatDate,
  yesterdayDate,
  todayDate,
  getMondayOf,
  getFirstOfMonth,
  extractCategoryId,
  extractFirstCoverUrl,
  getCandidateDates,
  REGION_CURRENCY,
} from "@/lib/echotik/cron/helpers";

describe("sha256()", () => {
  it("returns consistent hash for same input", () => {
    const a = sha256("hello");
    const b = sha256("hello");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("returns different hash for different input", () => {
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});

describe("date helpers", () => {
  it("todayDate() returns midnight UTC", () => {
    const d = todayDate();
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });

  it("yesterdayDate() returns yesterday at midnight UTC", () => {
    const y = yesterdayDate();
    const t = todayDate();
    const diff = t.getTime() - y.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it("formatDate() returns yyyy-MM-dd", () => {
    const d = new Date("2025-03-15T00:00:00Z");
    expect(formatDate(d)).toBe("2025-03-15");
  });

  it("getMondayOf() returns the Monday of that week", () => {
    // Wednesday March 26, 2025
    const wed = new Date("2025-03-26T00:00:00Z");
    const mon = getMondayOf(wed);
    expect(mon.getUTCDay()).toBe(1); // Monday
    expect(formatDate(mon)).toBe("2025-03-24");
  });

  it("getMondayOf() handles Sunday correctly", () => {
    // Sunday March 30, 2025
    const sun = new Date("2025-03-30T00:00:00Z");
    const mon = getMondayOf(sun);
    expect(mon.getUTCDay()).toBe(1);
    expect(formatDate(mon)).toBe("2025-03-24");
  });

  it("getFirstOfMonth() returns the 1st", () => {
    const d = new Date("2025-03-26T00:00:00Z");
    const first = getFirstOfMonth(d);
    expect(first.getUTCDate()).toBe(1);
    expect(formatDate(first)).toBe("2025-03-01");
  });
});

describe("extractCategoryId()", () => {
  it("extracts first category_id from JSON array", () => {
    const json =
      '[{"category_name":"Home","category_id":"600001"},{"category_name":"Tech","category_id":"700001"}]';
    expect(extractCategoryId(json)).toBe("600001");
  });

  it("returns null for empty array", () => {
    expect(extractCategoryId("[]")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(extractCategoryId("not-json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractCategoryId("")).toBeNull();
  });
});

describe("extractFirstCoverUrl()", () => {
  it("extracts first URL from JSON array", () => {
    const json = '[{"url":"https://img.com/1.jpg","index":0}]';
    expect(extractFirstCoverUrl(json)).toBe("https://img.com/1.jpg");
  });

  it("sorts by index and returns first", () => {
    const json =
      '[{"url":"https://img.com/b.jpg","index":2},{"url":"https://img.com/a.jpg","index":0}]';
    expect(extractFirstCoverUrl(json)).toBe("https://img.com/a.jpg");
  });

  it("returns direct URL if not JSON", () => {
    expect(extractFirstCoverUrl("https://img.com/direct.jpg")).toBe(
      "https://img.com/direct.jpg",
    );
  });

  it("returns null for null/undefined", () => {
    expect(extractFirstCoverUrl(null)).toBeNull();
    expect(extractFirstCoverUrl(undefined)).toBeNull();
  });

  it("returns null for invalid non-URL string", () => {
    expect(extractFirstCoverUrl("not-a-url")).toBeNull();
  });
});

describe("getCandidateDates()", () => {
  it("returns 2 dates for daily cycle", () => {
    const dates = getCandidateDates(1);
    expect(dates).toHaveLength(2);
    // All dates should be at midnight UTC
    for (const d of dates) {
      expect(d.getUTCHours()).toBe(0);
    }
  });

  it("returns 3 dates for weekly cycle", () => {
    const dates = getCandidateDates(2);
    expect(dates).toHaveLength(3);
  });

  it("returns 3 dates for monthly cycle", () => {
    const dates = getCandidateDates(3);
    expect(dates).toHaveLength(3);
  });
});

describe("REGION_CURRENCY", () => {
  it("maps BR to BRL", () => {
    expect(REGION_CURRENCY.BR).toBe("BRL");
  });

  it("maps US to USD", () => {
    expect(REGION_CURRENCY.US).toBe("USD");
  });

  it("maps UK and GB to GBP", () => {
    expect(REGION_CURRENCY.UK).toBe("GBP");
    expect(REGION_CURRENCY.GB).toBe("GBP");
  });
});
