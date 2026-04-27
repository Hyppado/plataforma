/**
 * Tests: lib/avatar-video/quota.ts
 *
 * Coverage: assertAvatarVideoQuota, quotaExceededToServiceErr,
 *           consumeAvatarVideoQuota — wrapping lib/usage correctly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must come before any import of the module under test
// ---------------------------------------------------------------------------

const { assertQuotaMock, consumeUsageMock } = vi.hoisted(() => ({
  assertQuotaMock: vi.fn(),
  consumeUsageMock: vi.fn(),
}));

vi.mock("@/lib/usage", () => ({
  assertQuota: assertQuotaMock,
  consumeUsage: consumeUsageMock,
  QuotaExceededError: class QuotaExceededError extends Error {
    action: string;
    used: number;
    limit: number;
    constructor(action: string, used: number, limit: number) {
      super(`Quota exceeded for ${action}`);
      this.name = "QuotaExceededError";
      this.action = action;
      this.used = used;
      this.limit = limit;
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  assertAvatarVideoQuota,
  consumeAvatarVideoQuota,
  quotaExceededToServiceErr,
} from "@/lib/avatar-video/quota";
import { QuotaExceededError } from "@/lib/usage";

describe("lib/avatar-video/quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // assertAvatarVideoQuota
  // -------------------------------------------------------------------------

  describe("assertAvatarVideoQuota()", () => {
    it("calls assertQuota with AVATAR_VIDEO_GENERATION", async () => {
      assertQuotaMock.mockResolvedValue(undefined);

      await assertAvatarVideoQuota("user-123");

      expect(assertQuotaMock).toHaveBeenCalledOnce();
      expect(assertQuotaMock).toHaveBeenCalledWith(
        "user-123",
        "AVATAR_VIDEO_GENERATION",
      );
    });

    it("propagates QuotaExceededError from assertQuota", async () => {
      const err = new QuotaExceededError("AVATAR_VIDEO_GENERATION", 5, 5);
      assertQuotaMock.mockRejectedValue(err);

      await expect(assertAvatarVideoQuota("user-123")).rejects.toThrow(
        QuotaExceededError,
      );
    });
  });

  // -------------------------------------------------------------------------
  // quotaExceededToServiceErr
  // -------------------------------------------------------------------------

  describe("quotaExceededToServiceErr()", () => {
    it("returns ServiceErr with quota_exceeded code", () => {
      const err = new QuotaExceededError("AVATAR_VIDEO_GENERATION", 3, 5);
      const result = quotaExceededToServiceErr(err);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("quota_exceeded");
    });

    it("includes used and limit in the error message", () => {
      const err = new QuotaExceededError("AVATAR_VIDEO_GENERATION", 3, 5);
      const result = quotaExceededToServiceErr(err);

      expect(result.error).toContain("3");
      expect(result.error).toContain("5");
    });

    it("handles limit = 0 correctly", () => {
      const err = new QuotaExceededError("AVATAR_VIDEO_GENERATION", 0, 0);
      const result = quotaExceededToServiceErr(err);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("quota_exceeded");
    });
  });

  // -------------------------------------------------------------------------
  // consumeAvatarVideoQuota
  // -------------------------------------------------------------------------

  describe("consumeAvatarVideoQuota()", () => {
    it("calls consumeUsage with correct arguments", async () => {
      consumeUsageMock.mockResolvedValue({ event: {}, duplicate: false });

      await consumeAvatarVideoQuota("user-123", "creation-abc");

      expect(consumeUsageMock).toHaveBeenCalledOnce();
      expect(consumeUsageMock).toHaveBeenCalledWith(
        "user-123",
        "AVATAR_VIDEO_GENERATION",
        0,
        expect.objectContaining({
          idempotencyKey: "avatar-video:creation-abc",
          refTable: "AvatarVideoCreation",
          refId: "creation-abc",
        }),
      );
    });

    it("uses creation id as part of idempotency key", async () => {
      consumeUsageMock.mockResolvedValue({ event: {}, duplicate: false });

      await consumeAvatarVideoQuota("user-1", "creation-xyz");

      const opts = consumeUsageMock.mock.calls[0][3];
      expect(opts.idempotencyKey).toBe("avatar-video:creation-xyz");
    });

    it("is idempotent — calling twice with same id is allowed by consumeUsage", async () => {
      consumeUsageMock
        .mockResolvedValueOnce({ event: {}, duplicate: false })
        .mockResolvedValueOnce({ event: {}, duplicate: true });

      await consumeAvatarVideoQuota("user-1", "creation-id");
      await consumeAvatarVideoQuota("user-1", "creation-id");

      expect(consumeUsageMock).toHaveBeenCalledTimes(2);
    });
  });
});
