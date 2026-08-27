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

/**
 * Migração EchoTik → RapidAPI.
 *
 * O fornecedor mantém paths, params e formato de resposta idênticos; mudam só
 * host e autenticação. Estes testes travam esse contrato para que a virada seja
 * uma troca de env var, não uma reescrita.
 */
describe("echotikRequest() — provedor RapidAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.ECHOTIK_BASE_URL = "https://test.echotik.local";
    process.env.ECHOTIK_USERNAME = "test-user";
    process.env.ECHOTIK_PASSWORD = "test-pass";
    process.env.ECHOTIK_PROVIDER = "rapidapi";
    process.env.ECHOTIK_RAPIDAPI_KEY = "rapid-key-123";
    process.env.ECHOTIK_RAPIDAPI_HOST = "tiktok-ultra-api1.p.rapidapi.com";
  });

  afterEach(() => {
    delete process.env.ECHOTIK_PROVIDER;
    delete process.env.ECHOTIK_RAPIDAPI_KEY;
    delete process.env.ECHOTIK_RAPIDAPI_HOST;
  });

  function okResponse() {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 0, data: [] }),
    });
  }

  it("mantém o path e os params, trocando apenas o host", async () => {
    okResponse();
    const { echotikRequest } = await import("@/lib/echotik/client");
    await echotikRequest("/api/v3/echotik/product/ranklist", {
      params: { region: "BR", page_num: 1 },
    });

    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.host).toBe("tiktok-ultra-api1.p.rapidapi.com");
    expect(url.pathname).toBe("/api/v3/echotik/product/ranklist");
    expect(url.searchParams.get("region")).toBe("BR");
    expect(url.searchParams.get("page_num")).toBe("1");
  });

  it("envia os headers do RapidAPI", async () => {
    okResponse();
    const { echotikRequest } = await import("@/lib/echotik/client");
    await echotikRequest("/api/v3/test");

    const { headers } = mockFetch.mock.calls[0][1];
    expect(headers["x-rapidapi-key"]).toBe("rapid-key-123");
    expect(headers["x-rapidapi-host"]).toBe("tiktok-ultra-api1.p.rapidapi.com");
  });

  it("não vaza a credencial da EchoTik para o RapidAPI", async () => {
    okResponse();
    const { echotikRequest } = await import("@/lib/echotik/client");
    await echotikRequest("/api/v3/test");

    const { headers } = mockFetch.mock.calls[0][1];
    expect(headers.Authorization).toBeUndefined();
  });

  it("aceita host informado com protocolo", async () => {
    process.env.ECHOTIK_RAPIDAPI_HOST = "https://tiktok-ultra-api1.p.rapidapi.com/";
    okResponse();
    const { echotikRequest } = await import("@/lib/echotik/client");
    await echotikRequest("/api/v3/test");

    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.host).toBe("tiktok-ultra-api1.p.rapidapi.com");
    const { headers } = mockFetch.mock.calls[0][1];
    expect(headers["x-rapidapi-host"]).toBe("tiktok-ultra-api1.p.rapidapi.com");
  });

  it("falha na hora — sem retry — quando a chave está ausente", async () => {
    delete process.env.ECHOTIK_RAPIDAPI_KEY;
    const { echotikRequest } = await import("@/lib/echotik/client");

    await expect(echotikRequest("/api/v3/test")).rejects.toThrow(
      /ECHOTIK_RAPIDAPI_KEY/,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejeita um provider desconhecido em vez de cair no default silenciosamente", async () => {
    process.env.ECHOTIK_PROVIDER = "rapdapi"; // typo
    const { echotikRequest } = await import("@/lib/echotik/client");

    await expect(echotikRequest("/api/v3/test")).rejects.toThrow(
      /ECHOTIK_PROVIDER inválido/,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("volta para Basic Auth quando o provider é 'direct'", async () => {
    process.env.ECHOTIK_PROVIDER = "direct";
    okResponse();
    const { echotikRequest } = await import("@/lib/echotik/client");
    await echotikRequest("/api/v3/test");

    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.host).toBe("test.echotik.local");
    const { headers } = mockFetch.mock.calls[0][1];
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers["x-rapidapi-key"]).toBeUndefined();
  });

  it("usa 'direct' quando ECHOTIK_PROVIDER não está definida", async () => {
    delete process.env.ECHOTIK_PROVIDER;
    okResponse();
    const { echotikRequest } = await import("@/lib/echotik/client");
    await echotikRequest("/api/v3/test");

    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.host).toBe("test.echotik.local");
  });
});
