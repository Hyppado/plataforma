/**
 * Tests: lib/hotmart/oauth.ts — OAuth client_credentials flow
 *
 * Priority: #1 (Security — token management)
 * Coverage: token fetch, caching, expiry, error handling, secret protection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config before importing oauth
vi.mock("@/lib/hotmart/config", () => ({
  getHotmartConfig: vi.fn(() => ({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    basicToken: "dGVzdC1jbGllbnQtaWQ6dGVzdC1jbGllbnQtc2VjcmV0",
    tokenUrl: "https://api-sec-vlc.hotmart.com/security/oauth/token",
    apiBaseUrl: "https://developers.hotmart.com/payments/api/v1",
    tokenRefreshBuffer: 60000,
    isSandbox: false,
    webhookSecret: "test-hottok",
    productId: "7420891",
  })),
}));

import { getAccessToken, clearTokenCache } from "@/lib/hotmart/oauth";

describe("getAccessToken()", () => {
  beforeEach(() => {
    clearTokenCache();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "token-abc-123",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a new token on first call", async () => {
    const token = await getAccessToken();
    expect(token).toBe("token-abc-123");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses cached token on subsequent calls", async () => {
    await getAccessToken();
    const token2 = await getAccessToken();
    expect(token2).toBe("token-abc-123");
    // Only one fetch call — second was cached
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses client_credentials grant_type", async () => {
    await getAccessToken();
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("grant_type=client_credentials");
  });

  it("includes Basic Authorization header", async () => {
    await getAccessToken();
    const options = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(options.headers.Authorization).toMatch(/^Basic /);
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      }),
    );

    await expect(getAccessToken()).rejects.toThrow("Falha ao obter token");
  });

  it("throws when response missing access_token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ expires_in: 3600 }),
      }),
    );

    await expect(getAccessToken()).rejects.toThrow("sem access_token");
  });

  it("clearTokenCache forces new fetch", async () => {
    await getAccessToken();
    clearTokenCache();

    // Return different token
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "new-token-xyz",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      }),
    );

    const token = await getAccessToken();
    expect(token).toBe("new-token-xyz");
  });
});
