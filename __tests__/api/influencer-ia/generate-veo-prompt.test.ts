/**
 * Tests: app/api/influencer-ia/generate-veo-prompt/route.ts
 *
 * Coverage: auth guard, validation (productName required), style/duration
 * defaults, successful generation, error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makePostRequest,
} from "@tests/helpers/auth";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { generateVeoPromptsMock } = vi.hoisted(() => ({
  generateVeoPromptsMock: vi.fn(),
}));

vi.mock("@/lib/influencer-ia/veo-prompt", () => ({
  generateVeoPrompts: generateVeoPromptsMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { POST } from "@/app/api/influencer-ia/generate-veo-prompt/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_PARTS = [
  {
    prompt: "Realistic UGC TikTok video PART 1/2.",
    aspect_ratio: "9:16",
    duration: 8,
    audio: true,
    part: 1,
    label: "Gancho",
    _metadata: { part: 1, total_parts: 2, product: "Produto", label: "Gancho" },
  },
  {
    prompt: "Realistic UGC TikTok video PART 2/2.",
    aspect_ratio: "9:16",
    duration: 8,
    audio: true,
    part: 2,
    label: "CTA",
    _metadata: { part: 2, total_parts: 2, product: "Produto", label: "CTA" },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/influencer-ia/generate-veo-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateVeoPromptsMock.mockResolvedValue(FAKE_PARTS);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
      productName: "Produto",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when productName is missing", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest(
      "/api/influencer-ia/generate-veo-prompt",
      {},
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("productName");
  });

  it("returns 400 when productName is empty string", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
      productName: "  ",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with parts on success", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
      productName: "Creme Premium",
      style: "ugc",
      duration: "short",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { parts: unknown[] };
    expect(body.parts).toHaveLength(2);
  });

  it("uses default style 'ugc' when style is invalid", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
      productName: "Prod",
      style: "invalid-style",
    });

    await POST(req);

    const [, , style] = generateVeoPromptsMock.mock.calls[0] as [string, string|null, string, string];
    expect(style).toBe("ugc");
  });

  it("uses default duration 'short' when duration is invalid", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
      productName: "Prod",
      duration: "invalid-duration",
    });

    await POST(req);

    const [, , , duration] = generateVeoPromptsMock.mock.calls[0] as [string, string|null, string, string];
    expect(duration).toBe("short");
  });

  it("passes productCategory as null when not provided", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
      productName: "Prod",
    });

    await POST(req);

    const [, category] = generateVeoPromptsMock.mock.calls[0] as [string, string | null];
    expect(category).toBeNull();
  });

  it("passes productCategory when provided", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
      productName: "Creme",
      productCategory: "beleza",
    });

    await POST(req);

    const [, category] = generateVeoPromptsMock.mock.calls[0] as [string, string | null];
    expect(category).toBe("beleza");
  });

  it("returns 500 when generateVeoPrompts throws", async () => {
    mockAuthenticatedUser();
    generateVeoPromptsMock.mockRejectedValue(
      new Error("Chave OpenAI não configurada"),
    );

    const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
      productName: "Prod",
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Chave OpenAI");
  });

  it("accepts all valid styles", async () => {
    mockAuthenticatedUser();
    const validStyles = ["ugc", "unboxing", "review", "tutorial", "testemunho"];

    for (const style of validStyles) {
      vi.clearAllMocks();
      generateVeoPromptsMock.mockResolvedValue(FAKE_PARTS);

      const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
        productName: "Prod",
        style,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const [, , passedStyle] = generateVeoPromptsMock.mock.calls[0] as [string, string|null, string];
      expect(passedStyle).toBe(style);
    }
  });

  it("accepts all valid durations", async () => {
    mockAuthenticatedUser();
    const validDurations = ["short", "medium", "full"];

    for (const duration of validDurations) {
      vi.clearAllMocks();
      generateVeoPromptsMock.mockResolvedValue(FAKE_PARTS);

      const req = makePostRequest("/api/influencer-ia/generate-veo-prompt", {
        productName: "Prod",
        duration,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const [, , , passedDuration] = generateVeoPromptsMock.mock.calls[0] as [string, string|null, string, string];
      expect(passedDuration).toBe(duration);
    }
  });
});
