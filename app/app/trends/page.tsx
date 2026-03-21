"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { ProductTable } from "@/app/components/dashboard/DataTable";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import type { ProductDTO } from "@/lib/types/dto";
import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";
import {
  fetchCategories,
  pickCategoryByHash,
  matchesCategory,
  ALL_CATEGORY_ID,
  type Category,
} from "@/lib/categories";

function TrendsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProducts, setNewProducts] = useState<ProductDTO[]>([]);
  const [allProducts, setAllProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Read from URL
  const timeRange = normalizeRange(searchParams.get("range"));
  const searchQuery = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("category") || "";

  // Load categories on mount
  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  // Helper to get/assign category ID for a product
  const getProductCategoryId = useCallback(
    (product: ProductDTO): string => {
      if (product.category) return product.category;
      return pickCategoryByHash(product.id, categories);
    },
    [categories],
  );

  // Filter products by category
  const filterByCategory = useCallback(
    (items: ProductDTO[]): ProductDTO[] => {
      if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return items;
      return items.filter((p) =>
        matchesCategory(getProductCategoryId(p), categoryFilter, categories),
      );
    },
    [categoryFilter, categories, getProductCategoryId],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        range: timeRange,
        limit: "50",
        filter: "new",
      });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/trending/products?${params}`);
      const json = await res.json();

      const items: ProductDTO[] = json?.data?.items ?? [];
      setAllProducts(items);

      // Apply category filter
      const filtered = filterByCategory(items);
      setNewProducts(filtered);

      if (json?.data?.error) {
        console.warn("New Products API returned error:", json.data.error);
      }
    } catch (err) {
      console.error("Failed to fetch new products:", err);
      setError("Erro ao carregar novos produtos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [timeRange, searchQuery, filterByCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTimeRangeChange = (range: TimeRange) => {
    const params = new URLSearchParams();
    params.set("range", range);
    if (searchQuery) params.set("q", searchQuery);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/app/trends?${params.toString()}`);
  };

  const handleSearchChange = (query: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    if (query) params.set("q", query);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/app/trends?${params.toString()}`);
  };

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    if (searchQuery) params.set("q", searchQuery);
    if (category) params.set("category", category);
    router.push(`/app/trends?${params.toString()}`);
  };

  // Get category name for display
  const getCategoryName = () => {
    if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return "";
    const cat = categories.find(
      (c) => c.id === categoryFilter || c.slug === categoryFilter,
    );
    return cat?.name || categoryFilter;
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Fixed Header */}
      <Box sx={{ flexShrink: 0 }}>
        <Box sx={{ mb: 1.5 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#fff",
              mb: 0.25,
              lineHeight: 1.3,
            }}
          >
            Tendências
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.3,
            }}
          >
            {allProducts.length > 0
              ? `${newProducts.length} novos produtos${getCategoryName() ? ` em ${getCategoryName()}` : ""} detectados`
              : "Novos produtos detectados no TikTok Shop — dados dos últimos 7 dias"}
          </Typography>
        </Box>
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onRefresh={fetchData}
          loading={loading}
          category={categoryFilter}
          onCategoryChange={handleCategoryChange}
          categories={categories}
        />
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", mt: 2 }}>
        {/* Error State */}
        {error && (
          <Box
            role="alert"
            aria-live="assertive"
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 2,
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#ef4444",
              fontSize: "0.8125rem",
            }}
          >
            {error}
          </Box>
        )}

        {/* New Products Table */}
        <ProductTable
          products={newProducts}
          loading={loading}
          title="Novos Produtos Detectados"
          showNewBadge
        />
      </Box>
    </Box>
  );
}

export default function TrendsPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography>Carregando...</Typography>
        </Box>
      }
    >
      <TrendsContent />
    </Suspense>
  );
}
