/**
 * lib/shopee/adapters.ts
 *
 * Adaptadores para converter DTOs da Shopee nos formatos esperados
 * pelos componentes reutilizáveis do TikTok (ProductCard, VideoCard, etc.).
 *
 * Isso permite que as páginas da Shopee usem os mesmos componentes
 * de "Produtos Hype" e "Vídeos em Alta" sem modificá-los.
 */

import type { ProductDTO, VideoDTO } from "@/lib/types/dto";
import type { ShopeeProductTrendDTO, ShopeeAchadinhoDTO } from "@/lib/swr/useShopee";

/**
 * Converte um produto do ranking Shopee para ProductDTO (formato do TikTok).
 * Permite usar o ProductCard, ProductTable e ProductDetailsModal existentes.
 */
export function toProductDTO(product: ShopeeProductTrendDTO): ProductDTO {
  return {
    id: product.productExternalId,
    name: product.productName,
    imageUrl: product.coverUrl || "",
    category: "",
    priceBRL: product.price,
    launchDate: product.syncedAt,
    isNew: false,
    rating: product.rating,
    sales: product.saleCount,
    avgPriceBRL: product.price,
    commissionRate: product.commissionRate,
    revenueBRL: product.gmv,
    liveRevenueBRL: 0,
    videoRevenueBRL: 0,
    mallRevenueBRL: 0,
    currency: "BRL",
    creatorCount: 0,
    creatorConversionRate: 0,
    sourceUrl: product.affiliateLink || "",
    tiktokUrl: product.affiliateLink || "",
    dateRange: "",
  };
}

/**
 * Converte um achadinho Shopee para VideoDTO (formato do TikTok).
 * Permite usar o VideoCard, TranscriptDialog, InsightDialog, TikTokPlayerModal.
 */
export function toVideoDTO(achadinho: ShopeeAchadinhoDTO): VideoDTO {
  return {
    id: achadinho.videoExternalId,
    title: achadinho.videoTitle || achadinho.productName || "Achadinho Shopee",
    duration: "",
    creatorHandle: "",
    publishedAt: achadinho.createdAt,
    revenueBRL: (achadinho.price ?? 0) * achadinho.saleCount,
    currency: "BRL",
    sales: achadinho.saleCount,
    views: achadinho.views ?? 0,
    gpmBRL: 0,
    cpaBRL: 0,
    adRatio: 0,
    adCostBRL: 0,
    roas: 0,
    sourceUrl: achadinho.affiliateLink || achadinho.productLink || "",
    tiktokUrl: achadinho.videoUrl || `https://www.tiktok.com/@user/video/${achadinho.videoExternalId}`,
    thumbnailUrl: achadinho.coverUrl || null,
    dateRange: "",
    categoryId: achadinho.category || undefined,
    product: achadinho.productName
      ? {
          id: achadinho.videoExternalId,
          name: achadinho.productName,
          imageUrl: achadinho.productImageUrl || achadinho.coverUrl || "",
          category: achadinho.category || "",
          priceBRL: achadinho.productPriceMin ?? achadinho.price ?? 0,
          launchDate: achadinho.createdAt,
          isNew: false,
          rating: 0,
          sales: achadinho.saleCount,
          avgPriceBRL: achadinho.productPriceMin ?? achadinho.price ?? 0,
          commissionRate: achadinho.commission ?? 0,
          revenueBRL: 0,
          liveRevenueBRL: 0,
          videoRevenueBRL: 0,
          mallRevenueBRL: 0,
          currency: "BRL",
          creatorCount: 0,
          creatorConversionRate: 0,
          sourceUrl: achadinho.affiliateLink || achadinho.productLink || "",
          tiktokUrl: achadinho.videoUrl || "",
          dateRange: "",
        }
      : undefined,
  };
}

/**
 * Converte a categoria textual da Shopee para o formato esperado pelo DashboardHeader.
 */
export function toCategoryFormat(categoria: string): { id: string; name: string } {
  return {
    id: categoria,
    name: categoria,
  };
}