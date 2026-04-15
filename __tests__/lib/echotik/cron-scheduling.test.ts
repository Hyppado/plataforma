/**
 * Tests: lib/echotik/cron/helpers.ts — Scheduling helpers
 *
 * Covers: shouldSkip, cleanupStaleRuns, hasExcessiveFailures
 * These functions depend on Prisma so they need their own mocked test file.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const prismaMock = vi.hoisted(() => ({
  ingestionRun: {
    findFirst: vi.fn().mockResolvedValue(null),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import {
  shouldSkip,
  cleanupStaleRuns,
  hasExcessiveFailures,
} from "@/lib/echotik/cron/helpers";

// ---------------------------------------------------------------------------
// shouldSkip
// ---------------------------------------------------------------------------
describe("shouldSkip()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false when no recent SUCCESS exists", async () => {
    prismaMock.ingestionRun.findFirst.mockResolvedValue(null);

    const result = await shouldSkip("echotik:videos:BR", 24);
    expect(result).toBe(false);
    expect(prismaMock.ingestionRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: "echotik:videos:BR",
          status: "SUCCESS",
        }),
      }),
    );
  });

  it("returns true when a recent SUCCESS exists and no subsequent failure", async () => {
    const successRecord = {
      id: "run-1",
      source: "echotik:videos:BR",
      status: "SUCCESS",
      startedAt: new Date(),
    };
    // First call: success found; second call: no failure after success
    prismaMock.ingestionRun.findFirst
      .mockResolvedValueOnce(successRecord)
      .mockResolvedValueOnce(null);

    const result = await shouldSkip("echotik:videos:BR", 24);
    expect(result).toBe(true);
  });

  it("returns false when a failure exists after the last success", async () => {
    const successRecord = {
      id: "run-1",
      source: "echotik:videos:BR",
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    };
    const failureRecord = {
      id: "run-2",
      source: "echotik:run:videos:BR",
      status: "FAILED",
      startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30min ago
    };
    // First call: success found; second call: failure found after success
    prismaMock.ingestionRun.findFirst
      .mockResolvedValueOnce(successRecord)
      .mockResolvedValueOnce(failureRecord);

    const result = await shouldSkip("echotik:videos:BR", 24);
    expect(result).toBe(false);
    // Verify the failure check used the correct run source and timestamp
    expect(prismaMock.ingestionRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: "echotik:run:videos:BR",
          status: "FAILED",
          startedAt: { gt: successRecord.startedAt },
        }),
      }),
    );
  });

  it("derives run source correctly for categories (no region)", async () => {
    const successRecord = {
      id: "run-1",
      source: "echotik:categories",
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    };
    const failureRecord = {
      id: "run-2",
      source: "echotik:run:categories",
      status: "FAILED",
      startedAt: new Date(),
    };
    prismaMock.ingestionRun.findFirst
      .mockResolvedValueOnce(successRecord)
      .mockResolvedValueOnce(failureRecord);

    const result = await shouldSkip("echotik:categories", 20);
    expect(result).toBe(false);
    expect(prismaMock.ingestionRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: "echotik:run:categories" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// cleanupStaleRuns
// ---------------------------------------------------------------------------
describe("cleanupStaleRuns()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks stale RUNNING records as FAILED", async () => {
    prismaMock.ingestionRun.updateMany.mockResolvedValue({ count: 3 });

    const count = await cleanupStaleRuns(5);
    expect(count).toBe(3);
    expect(prismaMock.ingestionRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "RUNNING",
          startedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: expect.objectContaining({
          status: "FAILED",
          endedAt: expect.any(Date),
          errorMessage: expect.stringContaining("stale"),
        }),
      }),
    );
  });

  it("returns 0 when no stale records exist", async () => {
    prismaMock.ingestionRun.updateMany.mockResolvedValue({ count: 0 });

    const count = await cleanupStaleRuns(5);
    expect(count).toBe(0);
  });

  it("logs a warning when stale records are cleaned", async () => {
    prismaMock.ingestionRun.updateMany.mockResolvedValue({ count: 5 });
    const log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };

    await cleanupStaleRuns(5, log as any);
    expect(log.warn).toHaveBeenCalledWith("Cleaned up stale RUNNING records", {
      count: 5,
    });
  });

  it("does not log when no stale records found", async () => {
    prismaMock.ingestionRun.updateMany.mockResolvedValue({ count: 0 });
    const log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };

    await cleanupStaleRuns(5, log as any);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("uses custom staleMinutes for the cutoff", async () => {
    prismaMock.ingestionRun.updateMany.mockResolvedValue({ count: 0 });
    const before = Date.now();

    await cleanupStaleRuns(10);

    const call = prismaMock.ingestionRun.updateMany.mock.calls[0][0];
    const cutoff = call.where.startedAt.lt as Date;
    // cutoff should be ~10 min ago
    const expectedCutoff = before - 10 * 60 * 1000;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedCutoff - 100);
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedCutoff + 100);
  });
});

// ---------------------------------------------------------------------------
// hasExcessiveFailures
// ---------------------------------------------------------------------------
describe("hasExcessiveFailures()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false when failure count is below threshold", async () => {
    prismaMock.ingestionRun.count.mockResolvedValue(3);

    const result = await hasExcessiveFailures("echotik:run:videos:GB");
    expect(result).toBe(false);
    expect(prismaMock.ingestionRun.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: "echotik:run:videos:GB",
          status: "FAILED",
        }),
      }),
    );
  });

  it("returns true when failure count meets the threshold", async () => {
    prismaMock.ingestionRun.count.mockResolvedValue(5);

    const result = await hasExcessiveFailures("echotik:run:videos:GB");
    expect(result).toBe(true);
  });

  it("returns true when failure count exceeds the threshold", async () => {
    prismaMock.ingestionRun.count.mockResolvedValue(10);

    const result = await hasExcessiveFailures("echotik:run:videos:GB");
    expect(result).toBe(true);
  });

  it("returns false when there are zero failures", async () => {
    prismaMock.ingestionRun.count.mockResolvedValue(0);

    const result = await hasExcessiveFailures("echotik:run:videos:GB");
    expect(result).toBe(false);
  });

  it("uses custom maxRecent and windowHours", async () => {
    prismaMock.ingestionRun.count.mockResolvedValue(2);
    const before = Date.now();

    const result = await hasExcessiveFailures("echotik:run:videos:BR", 3, 4);
    expect(result).toBe(false); // 2 < 3

    const call = prismaMock.ingestionRun.count.mock.calls[0][0];
    const since = call.where.startedAt.gte as Date;
    // since should be ~4 hours ago
    const expectedSince = before - 4 * 60 * 60 * 1000;
    expect(since.getTime()).toBeGreaterThanOrEqual(expectedSince - 100);
    expect(since.getTime()).toBeLessThanOrEqual(expectedSince + 100);
  });

  it("returns true with custom maxRecent when threshold met", async () => {
    prismaMock.ingestionRun.count.mockResolvedValue(3);

    const result = await hasExcessiveFailures("echotik:run:videos:BR", 3);
    expect(result).toBe(true);
  });
});
