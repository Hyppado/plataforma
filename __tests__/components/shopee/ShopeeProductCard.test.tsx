/**
 * Tests: app/components/shopee/ShopeeProductCard.tsx
 *
 * Card do Ranking Shopee. O que importa aqui é o destino do clique de compra
 * e a resiliência a campos ausentes — a API da Shopee frequentemente devolve
 * produtos sem imagem ou sem link.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ShopeeProductTrendDTO } from "@/lib/swr/useShopee";

vi.mock("@/lib/storage/saved", () => ({
  useSavedProducts: () => ({ isSaved: () => false, toggle: vi.fn() }),
  useSavedVideos: () => ({ isSaved: () => false, toggle: vi.fn() }),
}));

import { ShopeeProductCard } from "@/app/components/shopee/ShopeeProductCard";

function buildProduct(
  overrides: Partial<ShopeeProductTrendDTO> = {},
): ShopeeProductTrendDTO {
  return {
    id: "t1",
    productExternalId: "shopee-1",
    productName: "Fone de Ouvido Bluetooth",
    coverUrl: "https://cdn/cover.jpg",
    price: 49.9,
    commissionRate: 8.5,
    saleCount: 120,
    gmv: 5988,
    rating: 4.8,
    shopName: "Loja",
    affiliateLink: "https://shopee.com.br/product/1",
    categoryName: "Eletrônicos",
    subCategoryName: "Fones e Áudio",
    categoryId: "100632",
    subCategoryId: "1",
    rankPosition: 1,
    syncedAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  } as ShopeeProductTrendDTO;
}

describe("ShopeeProductCard", () => {
  it("mostra o nome do produto", () => {
    render(<ShopeeProductCard product={buildProduct()} />);
    expect(screen.getByText(/Fone de Ouvido Bluetooth/i)).toBeInTheDocument();
  });

  it("aponta a compra para a Shopee, nunca para o TikTok", () => {
    render(<ShopeeProductCard product={buildProduct()} />);

    const hrefs = Array.from(document.querySelectorAll("a[href]")).map((a) =>
      a.getAttribute("href"),
    );
    for (const h of hrefs) expect(h).not.toContain("tiktok.com");
  });

  it("renderiza sem quebrar quando faltam imagem e link", () => {
    expect(() =>
      render(
        <ShopeeProductCard
          product={buildProduct({
            coverUrl: null,
            affiliateLink: null,
          } as Partial<ShopeeProductTrendDTO>)}
         
        />,
      ),
    ).not.toThrow();
  });

  it("carrega a imagem de forma lazy", () => {
    render(<ShopeeProductCard product={buildProduct()} />);
    const img = document.querySelector("img");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });
});
