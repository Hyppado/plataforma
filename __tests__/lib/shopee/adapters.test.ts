/**
 * Tests: lib/shopee/adapters.ts
 *
 * Camada que projeta DTOs da Shopee nos formatos ProductDTO/VideoDTO do
 * TikTok, permitindo reusar ProductCard, VideoCard e TikTokPlayerModal sem
 * modificá-los. Um campo mal mapeado aqui envia o usuário para o link errado.
 */
import { describe, it, expect } from "vitest";
import { toProductDTO, toVideoDTO, toCategoryFormat } from "@/lib/shopee/adapters";
import type {
  ShopeeProductTrendDTO,
  ShopeeAchadinhoDTO,
} from "@/lib/swr/useShopee";

function buildTrend(
  overrides: Partial<ShopeeProductTrendDTO> = {},
): ShopeeProductTrendDTO {
  return {
    id: "trend-1",
    date: "2026-08-01",
    rankPosition: 1,
    productExternalId: "shopee-123",
    productName: "Fone de Ouvido",
    coverUrl: "https://cdn/cover.jpg",
    price: 49.9,
    commissionRate: 8.5,
    saleCount: 120,
    gmv: 5988,
    rating: 4.8,
    shopName: "Loja",
    affiliateLink: "https://shope.ee/abc",
    categoryName: "Eletrônicos",
    subCategoryName: "Fones e Áudio",
    categoryId: "100632",
    subCategoryId: "1",
    syncedAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  } as ShopeeProductTrendDTO;
}

function buildAchadinho(
  overrides: Partial<ShopeeAchadinhoDTO> = {},
): ShopeeAchadinhoDTO {
  return {
    id: "ach-1",
    videoExternalId: "7300000000000000000",
    videoUrl: "https://www.tiktok.com/@creator/video/7300000000000000000",
    videoTitle: "achadinho top",
    coverUrl: "https://cdn/cover.jpg",
    transcriptText: "texto",
    productName: "Fone de Ouvido",
    category: "Eletrônicos",
    affiliateLink: "https://shope.ee/abc",
    originalAffLink: "https://shopee.com.br/product/1",
    price: 49.9,
    saleCount: 10,
    views: 1_500_000,
    commission: 8.5,
    authorName: "creator",
    status: "READY",
    errorMessage: null,
    productImageUrl: "https://cdn/product.jpg",
    productPriceMin: 45,
    productPriceMax: 55,
    productLink: "https://shopee.com.br/product/1",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  } as ShopeeAchadinhoDTO;
}

describe("toProductDTO", () => {
  it("mapeia os campos principais do ranking", () => {
    const dto = toProductDTO(buildTrend());

    expect(dto.id).toBe("shopee-123");
    expect(dto.name).toBe("Fone de Ouvido");
    expect(dto.priceBRL).toBe(49.9);
    expect(dto.sales).toBe(120);
    expect(dto.commissionRate).toBe(8.5);
    expect(dto.revenueBRL).toBe(5988);
    expect(dto.currency).toBe("BRL");
  });

  it("usa o affiliateLink como destino de compra", () => {
    const dto = toProductDTO(buildTrend({ affiliateLink: "https://shope.ee/xyz" }));

    expect(dto.sourceUrl).toBe("https://shope.ee/xyz");
  });

  it("não quebra com coverUrl/affiliateLink nulos", () => {
    const dto = toProductDTO(
      buildTrend({ coverUrl: null, affiliateLink: null } as Partial<ShopeeProductTrendDTO>),
    );

    expect(dto.imageUrl).toBe("");
    expect(dto.sourceUrl).toBe("");
  });
});

describe("toVideoDTO — separação de links", () => {
  it("aponta o vídeo para o TikTok e a compra para a Shopee", () => {
    // Regressão marcada como "correção crítica" no card: cruzar estes dois
    // manda o usuário para o lugar errado.
    const dto = toVideoDTO(buildAchadinho());

    expect(dto.tiktokUrl).toBe(
      "https://www.tiktok.com/@creator/video/7300000000000000000",
    );
    expect(dto.sourceUrl).toBe("https://shope.ee/abc");
  });

  it("cai no productLink quando não há affiliateLink", () => {
    const dto = toVideoDTO(
      buildAchadinho({ affiliateLink: null } as Partial<ShopeeAchadinhoDTO>),
    );

    expect(dto.sourceUrl).toBe("https://shopee.com.br/product/1");
  });

  it("sintetiza URL do TikTok quando videoUrl está ausente", () => {
    const dto = toVideoDTO(
      buildAchadinho({ videoUrl: null } as Partial<ShopeeAchadinhoDTO>),
    );

    expect(dto.tiktokUrl).toContain("/video/7300000000000000000");
  });
});

describe("toVideoDTO — métricas", () => {
  it("calcula receita como preço x vendas", () => {
    const dto = toVideoDTO(buildAchadinho({ price: 10, saleCount: 7 }));

    expect(dto.revenueBRL).toBe(70);
  });

  it("trata preço nulo como zero na receita", () => {
    const dto = toVideoDTO(
      buildAchadinho({ price: null } as Partial<ShopeeAchadinhoDTO>),
    );

    expect(dto.revenueBRL).toBe(0);
  });

  it("propaga views do TikTok", () => {
    const dto = toVideoDTO(buildAchadinho({ views: 2_000_000 }));

    expect(dto.views).toBe(2_000_000);
  });
});

describe("toVideoDTO — produto embutido", () => {
  it("monta o produto quando há nome", () => {
    const dto = toVideoDTO(buildAchadinho());

    expect(dto.product).toBeDefined();
    expect(dto.product?.name).toBe("Fone de Ouvido");
    expect(dto.product?.imageUrl).toBe("https://cdn/product.jpg");
    expect(dto.product?.priceBRL).toBe(45);
    expect(dto.product?.commissionRate).toBe(8.5);
  });

  it("omite o produto quando o pipeline não extraiu nome", () => {
    const dto = toVideoDTO(
      buildAchadinho({ productName: null } as Partial<ShopeeAchadinhoDTO>),
    );

    expect(dto.product).toBeUndefined();
  });

  it("usa a capa do vídeo quando não há imagem do produto", () => {
    const dto = toVideoDTO(
      buildAchadinho({ productImageUrl: null } as Partial<ShopeeAchadinhoDTO>),
    );

    expect(dto.product?.imageUrl).toBe("https://cdn/cover.jpg");
  });

  it("usa o título do produto como fallback de título do vídeo", () => {
    const dto = toVideoDTO(
      buildAchadinho({ videoTitle: null } as Partial<ShopeeAchadinhoDTO>),
    );

    expect(dto.title).toBe("Fone de Ouvido");
  });
});

describe("toCategoryFormat", () => {
  it("espelha a categoria em id e name", () => {
    expect(toCategoryFormat("Eletrônicos")).toEqual({
      id: "Eletrônicos",
      name: "Eletrônicos",
    });
  });
});
