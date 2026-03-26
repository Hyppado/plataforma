/**
 * Tests: lib/hotmart/client.ts — authenticated Hotmart HTTP client
 *
 * Priority: #2 (Integration — external API client)
 * Coverage: Bearer auth, query string, 401 retry with cache clear, error propagation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/hotmart/config", () => ({
  getHotmartConfig: vi.fn(() => ({
    apiBaseUrl: "https://developers.hotmart.com/payments/api/v1",
  })),
}));

vi.mock("@/lib/hotmart/oauth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-bearer-token"),
  clearTokenCache: vi.fn(),
}));

import { hotmartRequest } from "@/lib/hotmart/client";

describe("hotmartRequest()", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Bearer token in Authorization header", async () => {
    await hotmartRequest("/subscriptions");
    const opts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.headers.Authorization).toBe("Bearer mock-bearer-token");
  });

  it("uses correct base URL from config", async () => {
    await hotmartRequest("/subscriptions");
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("developers.hotmart.com");
    expect(calledUrl).toContain("/subscriptions");
  });

  it("appends query string params", async () => {
    await hotmartRequest("/subscriptions", {
      params: { status: "ACTIVE", max_results: 10 },
    });
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("status=ACTIVE");
    expect(calledUrl).toContain("max_results=10");
  });

  it("omits undefined params", async () => {
    await hotmartRequest("/subscriptions", {
      params: { status: "ACTIVE", missing: undefined },
    });
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).not.toContain("missing");
  });

  it("retries on 401 with token cache clear", async () => {
    const { clearTokenCache, getAccessToken } =
      await import("@/lib/hotmart/oauth");

    // First call: 401, second call: 200
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await hotmartRequest("/subscriptions");
    expect(clearTokenCache).toHaveBeenCalled();
  });

  it("throws on non-401 errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      }),
    );

    await expect(hotmartRequest("/subscriptions")).rejects.toThrow(
      "Hotmart API",
    );
  });

  it("handles 204 No Content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    const result = await hotmartRequest("/subscriptions");
    expect(result).toBeUndefined();
  });

  it("sends JSON body for POST requests", async () => {
    await hotmartRequest("/subscriptions", {
      method: "POST",
      body: { key: "value" },
    });
    const opts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe(JSON.stringify({ key: "value" }));
  });
});
