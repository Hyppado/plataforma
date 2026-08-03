/**
 * lib/swr/useShopee.ts
 *
 * Hooks SWR para consumir os endpoints da Shopee.
 * Fornece hooks para o ranking de produtos e para o feed de achadinhos,
 * com cache, deduplicação e revalidação automática.
 *
 * O hook useShopeeAchadinhosFeed segue o mesmo padrão de useTrendingVideos
 * para manter consistência com a página "Vídeos em Alta".
 */

import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { fetcher, buildUrl } from "@/lib/swr/fetcher";

// ─── Tipos de retorno ─────────────────────────────────────────────

export interface ShopeeProductTrendDTO {
  id: string;
  productExternalId: string;
  productName: string;
  coverUrl: string | null;
  price: number;
  commissionRate: number;
  saleCount: number;
  gmv: number;
  rating: number;
  shopName: string | null;
  affiliateLink: string | null;
  rankPosition: number;
  /** Categoria pai (nome textual, vindo da Shopee ou atribuído pelo sync) */
  categoryName?: string | null;
  /** Subcategoria (nome textual, vindo da Shopee ou atribuído pelo sync) */
  subCategoryName?: string | null;
  /** ID numérico da categoria L1 (productCatIds[0] da API Shopee) */
  categoryId?: string | null;
  /** ID numérico da categoria L2 (productCatIds[1] da API Shopee) */
  subCategoryId?: string | null;
  syncedAt: string;
}

export interface ShopeeAchadinhoDTO {
  id: string;
  videoExternalId: string;
  /** tiktokVideoUrl — URL canônica do TikTok (embed/player) */
  videoUrl: string | null;
  videoTitle: string | null;
  coverUrl: string | null;
  transcriptText: string | null;
  productName: string | null;
  category: string | null;
  /** shopeeAffiliateUrl — link de venda/afiliado da Shopee */
  affiliateLink: string | null;
  originalAffLink: string | null;
  /** Preço do produto (vindo da Shopee) */
  price: number | null;
  /** Vendas do produto (vindo da Shopee) */
  saleCount: number;
  /** Visualizações do vídeo (play_count da EchoTik) */
  views: number;
  /** Comissão do produto (vinda da Shopee — commissionRate) */
  commission: number | null;
  authorName: string | null;
  status: string;
  errorMessage: string | null;
  productImageUrl: string | null;
  productPriceMin: number | null;
  productPriceMax: number | null;
  productLink: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RankingResponse {
  ok: boolean;
  products: ShopeeProductTrendDTO[];
}

interface AchadinhosFeedResponse {
  ok: boolean;
  achadinhos: ShopeeAchadinhoDTO[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  categorias: string[];
}

interface AchadinhosAllResponse {
  ok: boolean;
  achadinhos: ShopeeAchadinhoDTO[];
}

// ─── Hooks ────────────────────────────────────────────────────────

/**
 * Hook para buscar o ranking de produtos mais vendidos da Shopee.
 * Consome GET /api/shopee/ranking e retorna a lista ordenada por posição.
 */
export function useShopeeRanking() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<RankingResponse>(
    "/api/shopee/ranking",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );

  return {
    products: data?.products ?? [],
    isLoading,
    isValidating,
    error: error?.message ?? null,
    mutate,
  };
}

/**
 * Hook para o feed de achadinhos com paginação, ordenação e filtros.
 * Segue o mesmo padrão de useTrendingVideos.
 *
 * @param params - Parâmetros de consulta
 */
export function useShopeeAchadinhosFeed(params: {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
  category?: string;
  search?: string;
}) {
  const url = buildUrl("/api/shopee/achadinhos", {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 24,
    sort: params.sort || undefined,
    order: params.order || undefined,
    category: params.category || undefined,
    search: params.search || undefined,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<AchadinhosFeedResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );

  return {
    achadinhos: data?.achadinhos ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 24,
    hasMore: data?.hasMore ?? false,
    categorias: data?.categorias ?? [],
    isLoading,
    isValidating,
    error: error?.message ?? null,
    mutate,
  };
}

/**
 * Hook para buscar TODOS os achadinhos (sem paginação).
 * Usado exclusivamente no painel Admin.
 */
export function useShopeeAchadinhos() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<AchadinhosAllResponse>(
    "/api/shopee/achadinhos?pageSize=1000",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );

  return {
    achadinhos: data?.achadinhos ?? [],
    isLoading,
    isValidating,
    error: error?.message ?? null,
    mutate,
  };
}

/**
 * Mutation hook para atualizar o link de afiliado de um produto achadinho.
 * Usado exclusivamente por administradores para sobrescrever o link gerado.
 *
 * Faz PATCH /api/shopee/achadinhos/[id] com { affiliateLink: string }
 */
export function useUpdateAffiliateLink() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/shopee/achadinhos",
    async (url: string, { arg }: { arg: { id: string; affiliateLink: string } }) => {
      const res = await fetch(`/api/shopee/achadinhos/${arg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateLink: arg.affiliateLink }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao atualizar link de afiliado");
      }
      return res.json();
    },
  );

  return {
    updateLink: trigger,
    isUpdating: isMutating,
    error: error?.message ?? null,
  };
}