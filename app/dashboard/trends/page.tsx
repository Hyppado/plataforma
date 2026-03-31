"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import { ProductTable } from "@/app/components/dashboard/DataTable";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import type { ProductDTO } from "@/lib/types/dto";
import {
  normalizeRange,
  rangeToDays,
  type TimeRange,
} from "@/lib/filters/timeRange";
import {
  fetchCategories,
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Read from URL
  const timeRange = normalizeRange(searchParams.get("range"));
  const categoryFilter = searchParams.get("category") || "";

  // Load categories on mount
  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  // Filter products by category (client-side, for categories not sent to API)
  const filterByCategory = useCallback(
    (items: ProductDTO[]): ProductDTO[] => {
      if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return items;
      return items.filter((p) =>
        matchesCategory(p.category || p.id, categoryFilter, categories),
      );
    },
    [categoryFilter, categories],
  );

  // ---- Fetch new products from Echotik Product List ----
  const fetchData = useCallback(
    async (pageNum = 1) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const daysBack = rangeToDays(timeRange);
        const params = new URLSearchParams({
          daysBack: String(daysBack),
          page: String(pageNum),
          pageSize: "10",
          sort: "1", // total_sale_cnt
          order: "1", // desc
        });
        if (categoryFilter && categoryFilter !== ALL_CATEGORY_ID) {
          params.set("category", categoryFilter);
        }

        const res = await fetch(`/api/echotik/products/new?${params}`);
        const json = await res.json();

        if (!res.ok || json?.success === false) {
          setError(json?.error || `Erro HTTP ${res.status}`);
          return;
        }

        const items: ProductDTO[] = json?.data?.items ?? [];

        if (pageNum === 1) {
          setAllProducts(items);
          setNewProducts(filterByCategory(items));
        } else {
          setAllProducts((prev) => {
            const merged = [...prev, ...items];
            setNewProducts(filterByCategory(merged));
            return merged;
          });
        }

        // API retorna max 10 por página; se veio menos, não há mais
        setHasMore(items.length >= 10);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to fetch new products:", err);
        setError("Erro ao carregar novos produtos. Tente novamente.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [timeRange, categoryFilter, filterByCategory],
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchData(1);
  }, [fetchData]);

  const handleTimeRangeChange = (range: TimeRange) => {
    const params = new URLSearchParams();
    params.set("range", range);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/dashboard/trends?${params.toString()}`);
  };

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    if (category) params.set("category", category);
    router.push(`/dashboard/trends?${params.toString()}`);
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
              : `Novos produtos detectados no TikTok Shop — dados dos últimos ${rangeToDays(timeRange)} dias`}
          </Typography>
        </Box>
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
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

        {/* Load More */}
        {!loading && hasMore && newProducts.length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <Button
              variant="outlined"
              onClick={() => fetchData(page + 1)}
              disabled={loadingMore}
              sx={{
                borderColor: "rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.7)",
                "&:hover": {
                  borderColor: "rgba(255,255,255,0.4)",
                  background: "rgba(255,255,255,0.05)",
                },
                textTransform: "none",
                px: 4,
              }}
            >
              {loadingMore ? (
                <CircularProgress size={20} sx={{ color: "inherit", mr: 1 }} />
              ) : null}
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </Button>
          </Box>
        )}
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
