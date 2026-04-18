/**
 * SWR hooks for trending data (videos, products, creators)
 *
 * Provides cached, deduplicated data fetching with automatic revalidation.
 * Server-side pagination via page + pageSize params.
 */
"use client";

import useSWR from "swr";
import { fetcher, buildUrl } from "@/lib/swr/fetcher";

// ── Response types ──────────────────────────────────────────────

interface TrendingResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    range: string;
    availableRegions: string[];
    effectiveRankingCycle?: 1 | 2 | 3;
    availableSorts?: string[];
    currentSort?: string;
  };
}

// ── Shared params ───────────────────────────────────────────────

export interface TrendingParams {
  range: string;
  region: string;
  sort: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ── Generic trending hook ───────────────────────────────────────

function useTrending<T>(endpoint: string, params: TrendingParams) {
  const url = buildUrl(endpoint, {
    range: params.range,
    region: params.region,
    sort: params.sort,
    search: params.search || undefined,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 24,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    TrendingResponse<T>
  >(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000, // 30s dedup
    keepPreviousData: true,
  });

  return {
    items: data?.data?.items ?? [],
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    pageSize: data?.data?.pageSize ?? 24,
    hasMore: data?.data?.hasMore ?? false,
    availableRegions: data?.data?.availableRegions ?? ["US"],
    effectiveRankingCycle: data?.data?.effectiveRankingCycle ?? null,
    availableSorts: data?.data?.availableSorts ?? [],
    currentSort: data?.data?.currentSort ?? params.sort,
    isLoading,
    isValidating,
    error: error?.message ?? null,
    mutate,
  };
}

// ── Typed exports ───────────────────────────────────────────────

import type { VideoDTO, ProductDTO, CreatorDTO } from "@/lib/types/dto";

export function useTrendingVideos(params: TrendingParams) {
  return useTrending<VideoDTO>("/api/trending/videos", params);
}

export function useTrendingProducts(params: TrendingParams) {
  return useTrending<ProductDTO>("/api/trending/products", params);
}

export function useNewProducts(params: Omit<TrendingParams, "sort">) {
  return useTrending<ProductDTO>("/api/trending/new-products", {
    ...params,
    sort: "",
  });
}

export function useTrendingCreators(params: TrendingParams) {
  return useTrending<CreatorDTO>("/api/trending/creators", params);
}
