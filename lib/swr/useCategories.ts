/**
 * SWR hook for categories
 *
 * Replaces the manual fetchCategories() + useEffect pattern.
 * Categories are shared across tabs and rarely change (10 min stale time).
 */
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr/fetcher";
import type { Category } from "@/lib/categories";

interface CategoriesResponse {
  categories: Category[];
}

export function useCategories() {
  const { data, error, isLoading } = useSWR<CategoriesResponse>(
    "/api/echotik/categories",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 600_000, // 10 min — matches old TTL
      revalidateIfStale: false,
    },
  );

  return {
    categories: data?.categories ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
