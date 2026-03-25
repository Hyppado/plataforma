/**
 * Tests: lib/echotik/products.ts — product list service & normalization
 *
 * Priority: #3 (Integration with Echotik API)
 * Coverage: normalization, cover URL parsing, API call construction, error handling
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildEchotikProductListItem } from "@tests/helpers/factories";

// Mock the echotik client
vi.mock("@/lib/echotik/client", () => ({
  echotikRequest: vi.fn(),
}));

// Mock trending (proxyIfEchotikCdn)
vi.mock("@/lib/echotik/trending", () => ({
  proxyIfEchotikCdn: vi.fn((url: string) => url), // pass-through
}));

import {
  normalizeProductListItem,
  getNewProducts,
} from "@/lib/echotik/products";
import { echotikRequest } from "@/lib/echotik/client";

describe("normalizeProductListItem()", () => {
  it("maps raw Echotik fields to ProductDTO", () => {
    const raw = buildEchotikProductListItem();
    const dto = normalizeProductListItem(raw as any);

    expect(dto.id).toBe(raw.product_id);
    expect(dto.name).toBe(raw.product_name);
    expect(dto.category).toBe(raw.category_id);
    expect(dto.sales).toBe(raw.total_sale_cnt);
    expect(dto.rating).toBe(raw.product_rating);
    expect(dto.isNew).toBe(true);
    expect(dto.priceBRL).toBe(raw.spu_avg_price);
  });

  it("parses cover_url JSON and extracts first image", () => {
    const raw = buildEchotikProductListItem({
      cover_url: JSON.stringify([
        { url: "https://cdn.test.com/b.jpg", index: 1 },
        { url: "https://cdn.test.com/a.jpg", index: 0 },
      ]),
    });
    const dto = normalizeProductListItem(raw as any);
    expect(dto.imageUrl).toBe("https://cdn.test.com/a.jpg"); // lowest index
  });

  it("handles cover_url as direct URL string", () => {
    const raw = buildEchotikProductListItem({
      cover_url: "https://cdn.test.com/direct.jpg",
    });
    const dto = normalizeProductListItem(raw as any);
    expect(dto.imageUrl).toBe("https://cdn.test.com/direct.jpg");
  });

  it("handles missing/empty cover_url", () => {
    const raw = buildEchotikProductListItem({ cover_url: undefined });
    const dto = normalizeProductListItem(raw as any);
    expect(dto.imageUrl).toBe("");
  });

  it("handles malformed cover_url JSON", () => {
    const raw = buildEchotikProductListItem({ cover_url: "{not valid json" });
    const dto = normalizeProductListItem(raw as any);
    expect(dto.imageUrl).toBe(""); // not a URL prefix
  });

  it("converts first_crawl_dt integer to ISO date string", () => {
    const raw = buildEchotikProductListItem({ first_crawl_dt: 20260322 });
    const dto = normalizeProductListItem(raw as any);
    expect(dto.launchDate).toBe("2026-03-22");
  });

  it("handles missing first_crawl_dt", () => {
    const raw = buildEchotikProductListItem({ first_crawl_dt: undefined });
    const dto = normalizeProductListItem(raw as any);
    expect(dto.launchDate).toBe("");
  });

  it("defaults numeric fields to 0 when missing", () => {
    const raw = buildEchotikProductListItem({
      total_sale_cnt: undefined,
      product_rating: undefined,
      spu_avg_price: undefined,
      min_price: undefined,
    });
    const dto = normalizeProductListItem(raw as any);
    expect(dto.sales).toBe(0);
    expect(dto.rating).toBe(0);
    expect(dto.priceBRL).toBe(0);
  });

  it("constructs source and tiktok URLs from product_id", () => {
    const raw = buildEchotikProductListItem({ product_id: "P123" });
    const dto = normalizeProductListItem(raw as any);
    expect(dto.sourceUrl).toContain("P123");
    expect(dto.tiktokUrl).toContain("P123");
  });
});

describe("getNewProducts()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls echotikRequest with correct endpoint and params", async () => {
    vi.mocked(echotikRequest).mockResolvedValue({
      code: 0,
      message: "success",
      data: [buildEchotikProductListItem()],
      requestId: "req-1",
    });

    const result = await getNewProducts({ region: "BR", page: 1, daysBack: 3 });

    expect(echotikRequest).toHaveBeenCalledWith(
      "/api/v3/echotik/product/list",
      expect.objectContaining({
        params: expect.objectContaining({
          region: "BR",
          page_num: 1,
          page_size: 10,
          min_first_crawl_dt: expect.any(String),
          max_first_crawl_dt: expect.any(String),
        }),
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.count).toBe(1);
    expect(result.page).toBe(1);
    expect(result.dateWindow.min).toBeTruthy();
    expect(result.dateWindow.max).toBeTruthy();
  });

  it("clamps page_size to max 10", async () => {
    vi.mocked(echotikRequest).mockResolvedValue({
      code: 0,
      message: "ok",
      data: [],
      requestId: "r",
    });

    await getNewProducts({ pageSize: 50 });

    expect(echotikRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({ page_size: 10 }),
      }),
    );
  });

  it("includes categoryId and keyword when provided", async () => {
    vi.mocked(echotikRequest).mockResolvedValue({
      code: 0,
      message: "ok",
      data: [],
      requestId: "r",
    });

    await getNewProducts({ categoryId: "cat-123", search: "phone" });

    expect(echotikRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          category_id: "cat-123",
          keyword: "phone",
        }),
      }),
    );
  });

  it("throws when API returns non-zero code", async () => {
    vi.mocked(echotikRequest).mockResolvedValue({
      code: 1001,
      message: "Usage Limit Exceeded",
      data: [],
      requestId: "r",
    });

    await expect(getNewProducts()).rejects.toThrow("API error 1001");
  });

  it("handles empty data array", async () => {
    vi.mocked(echotikRequest).mockResolvedValue({
      code: 0,
      message: "ok",
      data: [],
      requestId: "r",
    });

    const result = await getNewProducts();
    expect(result.items).toEqual([]);
    expect(result.count).toBe(0);
  });
});
