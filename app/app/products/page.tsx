"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Button, CircularProgress, Grid } from "@mui/material";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import { ProductCard } from "@/app/components/cards/ProductCard";
import type { ProductDTO } from "@/lib/types/dto";
import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";
import { ExpandMore } from "@mui/icons-material";
import {
  fetchCategories,
  pickCategoryByHash,
  matchesCategory,
  ALL_CATEGORY_ID,
  type Category,
} from "@/lib/categories";

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [allProducts, setAllProducts] = useState<ProductDTO[]>([]);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);

  // Read from URL
  const timeRange = normalizeRange(searchParams.get("range"));
  const searchQuery = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("category") || "";
  const pageSize = 24; // Carregar 24 por vez

  // Load categories on mount
  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  // Helper to get/assign category ID for a product
  const getProductCategoryId = useCallback(
    (product: ProductDTO): string => {
      // Use existing category if available
      if (product.category) return product.category;
      // Otherwise, assign deterministically
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
    setPage(1);

    try {
      // Fetch sem limit hardcoded - backend retorna o que tiver
      const params = new URLSearchParams({ range: timeRange });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/trending/products?${params}`);
      const json = await res.json();

      const items: ProductDTO[] = json?.data?.items ?? [];
      setAllProducts(items);

      // Apply category filter
      const filtered = filterByCategory(items);
      setProducts(filtered.slice(0, pageSize));

      if (json?.data?.error) {
        console.warn("Products API returned error:", json.data.error);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError("Erro ao carregar produtos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [timeRange, searchQuery, filterByCategory, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const start = nextPage * pageSize;
    const end = start + pageSize;

    // Apply category filter for load more
    const filtered = filterByCategory(allProducts);
    const moreProducts = filtered.slice(start, end);

    setTimeout(() => {
      setProducts((prev) => [...prev, ...moreProducts]);
      setPage(nextPage);
      setLoadingMore(false);
    }, 300);
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    const params = new URLSearchParams();
    params.set("range", range);
    if (searchQuery) params.set("q", searchQuery);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/app/products?${params.toString()}`);
  };

  const handleSearchChange = (query: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    if (query) params.set("q", query);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/app/products?${params.toString()}`);
  };

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    if (searchQuery) params.set("q", searchQuery);
    if (category) params.set("category", category);
    router.push(`/app/products?${params.toString()}`);
  };

  const handleViewDetails = (product: ProductDTO) => {
    console.log("View details for", product.id);
    // TODO: Implementar modal de detalhes
  };

  // Calculate hasMore based on filtered data
  const filteredTotal = filterByCategory(allProducts).length;
  const hasMore = products.length < filteredTotal;

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
            Produtos em Alta
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.3,
            }}
          >
            {allProducts.length > 0
              ? `${filteredTotal} produtos${getCategoryName() ? ` em ${getCategoryName()}` : ""} • Mostrando ${products.length}`
              : "Explorando os produtos mais vendidos"}
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

        {/* Product Grid */}
        <Grid container spacing={{ xs: 2, md: 2.5 }}>
          {products.map((product) => (
            <Grid item xs={6} sm={6} md={4} lg={2.4} key={product.id}>
              <ProductCard
                product={product}
                onViewDetails={handleViewDetails}
              />
            </Grid>
          ))}

          {/* Loading skeletons */}
          {loading &&
            Array.from({ length: 12 }).map((_, idx) => (
              <Grid item xs={6} sm={6} md={4} lg={2.4} key={`skeleton-${idx}`}>
                <ProductCard isLoading />
              </Grid>
            ))}
        </Grid>

        {/* Load More Button */}
        {!loading && hasMore && products.length > 0 && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mt: 4,
              mb: 2,
            }}
          >
            <Button
              variant="outlined"
              size="large"
              endIcon={
                loadingMore ? <CircularProgress size={16} /> : <ExpandMore />
              }
              onClick={handleLoadMore}
              disabled={loadingMore}
              sx={{
                px: 4,
                py: 1.25,
                fontSize: "0.875rem",
                fontWeight: 600,
                textTransform: "none",
                borderRadius: 3,
                borderColor: "rgba(45,212,255,0.3)",
                color: "#2DD4FF",
                transition: "all 180ms ease",
                "&:hover": {
                  borderColor: "#2DD4FF",
                  background: "rgba(45,212,255,0.08)",
                },
              }}
            >
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </Button>
          </Box>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <Box
            sx={{
              textAlign: "center",
              py: 8,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <Typography sx={{ fontSize: "0.95rem" }}>
              Nenhum produto encontrado
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function ProductsPage() {
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
      <ProductsContent />
    </Suspense>
  );
}
