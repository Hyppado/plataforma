/**
 * Tests: lib/avatar-video/types.ts
 *
 * Coverage: isServiceErr type guard, ServiceResult discriminated union
 */
import { describe, it, expect } from "vitest";
import { isServiceErr } from "@/lib/avatar-video/types";
import type { ServiceResult } from "@/lib/avatar-video/types";

describe("isServiceErr()", () => {
  it("returns false for ok results", () => {
    const result: ServiceResult<string> = { ok: true, data: "hello" };
    expect(isServiceErr(result)).toBe(false);
  });

  it("returns true for error results", () => {
    const result: ServiceResult<string> = {
      ok: false,
      error: "Something went wrong",
      code: "internal",
    };
    expect(isServiceErr(result)).toBe(true);
  });

  it("narrows the type correctly for quota_exceeded code", () => {
    const result: ServiceResult<number> = {
      ok: false,
      error: "Quota exceeded",
      code: "quota_exceeded",
    };
    if (isServiceErr(result)) {
      expect(result.code).toBe("quota_exceeded");
      expect(result.error).toBe("Quota exceeded");
    } else {
      throw new Error("Should have been an error");
    }
  });

  it("narrows the type correctly for not_found code", () => {
    const result: ServiceResult<null> = {
      ok: false,
      error: "Not found",
      code: "not_found",
    };
    expect(isServiceErr(result)).toBe(true);
  });

  it("narrows the type correctly for invalid_state code", () => {
    const result: ServiceResult<null> = {
      ok: false,
      error: "Invalid state",
      code: "invalid_state",
    };
    expect(isServiceErr(result)).toBe(true);
  });
});
