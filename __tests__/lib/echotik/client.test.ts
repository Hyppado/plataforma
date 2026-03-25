/**
 * Tests: lib/echotik/client.ts — Echotik API client
 *
 * Priority: #3 (External integration — retry, auth, error handling)
 * Coverage: Basic Auth, retry logic, timeout, error codes, env validation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("echotikRequest()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.resetModules();
    process.env.ECHOTIK_BASE_URL = "https://test.echotik.local";
    process.env.ECHOTIK_USERNAME = "test-user";
    process.env.ECHOTIK_PASSWORD = "test-pass";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function loadClient() {
    return import("@/lib/echotik/client");
  }

  it("sends Basic Auth header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 0, data: [] }),
    });

    const { echotikRequest } = await loadClient();
    await echotikRequest("/api/v3/test");

    const [url, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toMatch(/^Basic /);
    const decoded = Buffer.from(
      options.headers.Authorization.replace("Basic ", ""),
      "base64",
    ).toString();
    expect(decoded).toBe("test-user:test-pass");
  });

  it("builds URL with query params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const { echotikRequest } = await loadClient();
    await echotikRequest("/api/v3/test", {
      params: { region: "BR", page_num: 1 },
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("region=BR");
    expect(url).toContain("page_num=1");
  });

  it("throws when ECHOTIK_BASE_URL is missing", async () => {
    delete process.env.ECHOTIK_BASE_URL;
    vi.resetModules();

    const { echotikRequest } = await loadClient();
    await expect(echotikRequest("/test")).rejects.toThrow("ECHOTIK_BASE_URL");
  });

  it("throws when credentials are missing", async () => {
    delete process.env.ECHOTIK_USERNAME;
    vi.resetModules();

    const { echotikRequest } = await loadClient();
    const promise = echotikRequest("/test");
    promise.catch(() => {}); // prevent Node unhandled‑rejection warning
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow("ECHOTIK_USERNAME");
  });

  it("retries on 5xx errors", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("err"),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

    const { echotikRequest } = await loadClient();
    const promise = echotikRequest("/test", { retries: 2 });
    await vi.runAllTimersAsync();
    await promise;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx errors (except 429)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    });

    const { echotikRequest } = await loadClient();
    // 4xx errors should reject immediately — no timers needed
    await expect(echotikRequest("/test", { retries: 3 })).rejects.toThrow();
    // Should fail immediately, not retry
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns parsed JSON on success", async () => {
    const responseData = { code: 0, data: [{ id: 1 }] };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    });

    const { echotikRequest } = await loadClient();
    const result = await echotikRequest("/test");
    expect(result).toEqual(responseData);
  });
});
