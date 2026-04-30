/**
 * Tests: app/api/influencer-ia/product-images/route.ts
 *
 * Coverage: auth guard, productId validation, parseCoverUrls,
 * blobUrl substitution, proxy wrapping, empty fallback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    echotikProductDetail: {
      findUnique: vi.fn(),
    },
  },
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

import { GET } from "@/app/api/influencer-ia/product-images/route";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/influencer-ia/product-images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/influencer-ia/product-images", {
      productId: "prod-1",
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when productId is missing", async () => {
    mockAuthenticatedUser();
    const req = makeGetRequest("/api/influencer-ia/product-images");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("productId");
  });

  it("returns { images: [], rawImages: [] } when product detail not found", async () => {
    mockAuthenticatedUser();
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue(null);

    const req = makeGetRequest("/api/influencer-ia/product-images", {
      productId: "missing-prod",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      images: unknown[];
      rawImages: unknown[];
    };
    expect(body.images).toEqual([]);
    expect(body.rawImages).toEqual([]);
  });

  it("parses cover_url JSON array from extra field", async () => {
    mockAuthenticatedUser();
    const coverUrlJson = JSON.stringify([
      { url: "https://cdn.example.com/img1.jpg", index: 0 },
      { url: "https://cdn.example.com/img2.jpg", index: 1 },
    ]);

    prismaMock.echotikProductDetail.findUnique.mockResolvedValue({
      coverUrl: null,
      blobUrl: null,
      extra: { cover_url: coverUrlJson },
    });

    const req = makeGetRequest("/api/influencer-ia/product-images", {
      productId: "prod-1",
    });
    const res = await GET(req);
    const body = (await res.json()) as {
      images: string[];
      rawImages: string[];
    };
    expect(body.rawImages).toHaveLength(2);
    expect(body.rawImages[0]).toBe("https://cdn.example.com/img1.jpg");
  });

  it("substitutes first rawImage with blobUrl when blobUrl is available", async () => {
    mockAuthenticatedUser();
    const coverUrlJson = JSON.stringify([
      { url: "https://cdn.example.com/img1.jpg", index: 0 },
      { url: "https://cdn.example.com/img2.jpg", index: 1 },
    ]);

    prismaMock.echotikProductDetail.findUnique.mockResolvedValue({
      coverUrl: null,
      blobUrl: "https://public.blob.vercel-storage.com/img1-blob.jpg",
      extra: { cover_url: coverUrlJson },
    });

    const req = makeGetRequest("/api/influencer-ia/product-images", {
      productId: "prod-1",
    });
    const res = await GET(req);
    const body = (await res.json()) as {
      images: string[];
      rawImages: string[];
    };

    // blobUrl replaces first image
    expect(body.rawImages[0]).toBe(
      "https://public.blob.vercel-storage.com/img1-blob.jpg",
    );
    // second image unchanged
    expect(body.rawImages[1]).toBe("https://cdn.example.com/img2.jpg");
  });

  it("wraps non-blob URLs in proxy for browser display", async () => {
    mockAuthenticatedUser();
    const coverUrlJson = JSON.stringify([
      { url: "https://cdn.example.com/img1.jpg", index: 0 },
    ]);

    prismaMock.echotikProductDetail.findUnique.mockResolvedValue({
      coverUrl: null,
      blobUrl: null,
      extra: { cover_url: coverUrlJson },
    });

    const req = makeGetRequest("/api/influencer-ia/product-images", {
      productId: "prod-1",
    });
    const res = await GET(req);
    const body = (await res.json()) as {
      images: string[];
      rawImages: string[];
    };

    expect(body.images[0]).toContain("/api/proxy/image?url=");
    expect(body.rawImages[0]).toBe("https://cdn.example.com/img1.jpg");
  });

  it("does not proxy blob URLs (serves them directly)", async () => {
    mockAuthenticatedUser();
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue({
      coverUrl: null,
      blobUrl: "https://public.blob.vercel-storage.com/abc.jpg",
      extra: { cover_url: null },
    });

    const req = makeGetRequest("/api/influencer-ia/product-images", {
      productId: "prod-1",
    });
    const res = await GET(req);
    const body = (await res.json()) as {
      images: string[];
      rawImages: string[];
    };

    expect(body.images[0]).toBe(
      "https://public.blob.vercel-storage.com/abc.jpg",
    );
    expect(body.images[0]).not.toContain("/api/proxy/image");
  });

  it("falls back to coverUrl when extra has no cover_url and blobUrl is null", async () => {
    mockAuthenticatedUser();
    prismaMock.echotikProductDetail.findUnique.mockResolvedValue({
      coverUrl: "https://cdn.example.com/cover.jpg",
      blobUrl: null,
      extra: {},
    });

    const req = makeGetRequest("/api/influencer-ia/product-images", {
      productId: "prod-1",
    });
    const res = await GET(req);
    const body = (await res.json()) as {
      images: string[];
      rawImages: string[];
    };
    expect(body.rawImages).toHaveLength(1);
    expect(body.rawImages[0]).toBe("https://cdn.example.com/cover.jpg");
  });

  it("returns 500 on unexpected DB error", async () => {
    mockAuthenticatedUser();
    prismaMock.echotikProductDetail.findUnique.mockRejectedValue(
      new Error("DB connection lost"),
    );

    const req = makeGetRequest("/api/influencer-ia/product-images", {
      productId: "prod-1",
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });
});
