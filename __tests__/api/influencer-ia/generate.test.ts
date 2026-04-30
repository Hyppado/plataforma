/**
 * Tests: app/api/influencer-ia/generate/route.ts
 *
 * Coverage: auth guard, body validation, avatar DB lookup, image generation,
 * error propagation.
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

const {
  generateInfluencerImageMock,
  prismaMock,
  assertQuotaMock,
  consumeMock,
} = vi.hoisted(() => ({
  generateInfluencerImageMock: vi.fn(),
  prismaMock: {
    avatarProfile: {
      findUnique: vi.fn(),
    },
  },
  assertQuotaMock: vi.fn(),
  consumeMock: vi.fn(),
}));

vi.mock("@/lib/influencer-ia/generate", () => ({
  generateInfluencerImage: generateInfluencerImageMock,
}));

vi.mock("@/lib/influencer-ia/quota", () => ({
  assertInfluencerDailyQuota: assertQuotaMock,
  consumeInfluencerGeneration: consumeMock,
  DailyQuotaExceededError: class DailyQuotaExceededError extends Error {
    used: number;
    limit: number;
    constructor(used: number, limit: number) {
      super(`Daily limit reached: ${used}/${limit}`);
      this.used = used;
      this.limit = limit;
    }
  },
  INFLUENCER_IA_DAILY_LIMIT: 5,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { POST } from "@/app/api/influencer-ia/generate/route";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/influencer-ia/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateInfluencerImageMock.mockResolvedValue({
      imageUrl: "https://blob.vercel-storage.com/test.png",
    });
    prismaMock.avatarProfile.findUnique.mockResolvedValue(null);
    assertQuotaMock.mockResolvedValue(undefined);
    consumeMock.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makePostRequest("/api/influencer-ia/generate", {});
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON body", async () => {
    mockAuthenticatedUser();
    const req = new Request("http://localhost/api/influencer-ia/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("inválido");
  });

  it("returns 200 with imageUrl on successful generation", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate", {
      productName: "Creme X",
      productImageUrl: "https://example.com/product.jpg",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { imageUrl: string };
    expect(body.imageUrl).toBe("https://blob.vercel-storage.com/test.png");
  });

  it("fetches avatar from DB when avatarId is provided", async () => {
    mockAuthenticatedUser();
    prismaMock.avatarProfile.findUnique.mockResolvedValue({
      name: "Ana",
      description: "Creator",
      imageUrl: "https://example.com/ana.jpg",
    });

    const req = makePostRequest("/api/influencer-ia/generate", {
      avatarId: "avatar-123",
      productName: "Produto Y",
    });

    await POST(req);

    expect(prismaMock.avatarProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "avatar-123" },
      select: { name: true, description: true, imageUrl: true },
    });

    const callArgs = generateInfluencerImageMock.mock.calls[0]?.[0] as {
      avatarName: string;
      avatarDescription: string;
      avatarImageUrl: string;
    };
    expect(callArgs.avatarName).toBe("Ana");
    expect(callArgs.avatarDescription).toBe("Creator");
    expect(callArgs.avatarImageUrl).toBe("https://example.com/ana.jpg");
  });

  it("uses avatarImageUrl from body even when avatarId is set (body takes priority)", async () => {
    mockAuthenticatedUser();
    prismaMock.avatarProfile.findUnique.mockResolvedValue({
      name: "DB Avatar",
      description: "From DB",
      imageUrl: "https://example.com/db-avatar.jpg",
    });

    const req = makePostRequest("/api/influencer-ia/generate", {
      avatarId: "avatar-123",
      avatarImageUrl: "https://uploaded.com/my-photo.jpg",
      productName: "Prod Z",
    });

    await POST(req);

    const callArgs = generateInfluencerImageMock.mock.calls[0]?.[0] as {
      avatarImageUrl: string;
    };
    // Body avatarImageUrl overrides DB imageUrl
    expect(callArgs.avatarImageUrl).toBe("https://uploaded.com/my-photo.jpg");
  });

  it("passes all generation params to generateInfluencerImage", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate", {
      productName: "Vestido Floral",
      productImageUrl: "https://example.com/vestido.jpg",
      productCategory: "roupa",
      pose: "De Frente",
      customPose: "Segurando o produto",
      environment: "Casa",
      customEnvironment: "Sala moderna",
      style: "Elegante",
      enhancements: ["Pele Ultra Realista"],
    });

    await POST(req);

    const callArgs = generateInfluencerImageMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(callArgs.productName).toBe("Vestido Floral");
    expect(callArgs.productCategory).toBe("roupa");
    expect(callArgs.pose).toBe("De Frente");
    expect(callArgs.customPose).toBe("Segurando o produto");
    expect(callArgs.environment).toBe("Casa");
    expect(callArgs.customEnvironment).toBe("Sala moderna");
    expect(callArgs.style).toBe("Elegante");
    expect(callArgs.enhancements).toEqual(["Pele Ultra Realista"]);
  });

  it("returns 500 when image generation throws", async () => {
    mockAuthenticatedUser();
    generateInfluencerImageMock.mockRejectedValue(
      new Error("Google AI falhou (429)"),
    );

    const req = makePostRequest("/api/influencer-ia/generate", {
      productName: "Produto X",
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Google AI falhou");
  });

  it("sanitises enhancements — uses empty array when not an array", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate", {
      productName: "Prod",
      enhancements: "not-an-array",
    });

    await POST(req);

    const callArgs = generateInfluencerImageMock.mock.calls[0]?.[0] as {
      enhancements: unknown[];
    };
    expect(callArgs.enhancements).toEqual([]);
  });

  it("returns 429 when daily quota is exceeded", async () => {
    mockAuthenticatedUser();
    const { DailyQuotaExceededError } =
      await import("@/lib/influencer-ia/quota");
    assertQuotaMock.mockRejectedValue(new DailyQuotaExceededError(5, 5));

    const req = makePostRequest("/api/influencer-ia/generate", {
      productName: "Produto X",
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      error: string;
      used: number;
      limit: number;
    };
    expect(body.used).toBe(5);
    expect(body.limit).toBe(5);
  });

  it("consumes quota after successful generation", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/influencer-ia/generate", {
      productName: "Produto X",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(consumeMock).toHaveBeenCalledOnce();
  });
});
