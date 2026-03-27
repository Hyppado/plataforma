import { describe, it, expect, vi, afterEach } from "vitest";
import * as adminClient from "@/lib/admin/admin-client";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("admin-client API helpers", () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it("getQuotaPolicy returns policy from API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcriptsPerMonth: 99,
        scriptsPerMonth: 88,
        insightTokensPerMonth: 1,
        scriptTokensPerMonth: 2,
        insightMaxOutputTokens: 3,
        scriptMaxOutputTokens: 4,
      }),
    });
    const policy = await adminClient.getQuotaPolicy();
    expect(policy.transcriptsPerMonth).toBe(99);
    expect(policy.scriptsPerMonth).toBe(88);
  });

  it("getPromptConfig returns config from API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        insight: {
          template: "insight",
          settings: { model: "gpt", temperature: 0.7, max_output_tokens: 800 },
        },
        script: {
          template: "script",
          settings: { model: "gpt", temperature: 0.8, max_output_tokens: 1500 },
        },
      }),
    });
    const config = await adminClient.getPromptConfig();
    expect(config.insight.template).toBe("insight");
    expect(config.script.template).toBe("script");
  });

  it("updateQuotaPolicy sends PUT to API", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await adminClient.updateQuotaPolicy({
      transcriptsPerMonth: 1,
      scriptsPerMonth: 2,
      insightTokensPerMonth: 3,
      scriptTokensPerMonth: 4,
      insightMaxOutputTokens: 5,
      scriptMaxOutputTokens: 6,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/quota-policy",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("updatePromptConfig sends PUT to API", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await adminClient.updatePromptConfig({
      insight: {
        template: "a",
        settings: { model: "gpt", temperature: 0.7, max_output_tokens: 800 },
      },
      script: {
        template: "b",
        settings: { model: "gpt", temperature: 0.8, max_output_tokens: 1500 },
      },
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/prompt-config",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
