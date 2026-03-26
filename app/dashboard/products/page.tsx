"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Button, CircularProgress, Grid } from "@mui/material";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import { ProductCard } from "@/app/components/cards/ProductCard";
import type { ProductDTO } from "@/lib/types/dto";
import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";
import { ExpandMore } from "@mui/icons-material";
import {
  pickCategoryByHash,
  matchesCategory,
  ALL_CATEGORY_ID,
} from "@/lib/categories";
import { getStoredRegion } from "@/lib/region";
import { PRODUCT_RANK_FIELDS } from "@/lib/echotik/rankFields";
import { useTrendingProducts } from "@/lib/swr/useTrending";
import { useCategories } from "@/lib/swr/useCategories";

const PAGE_SIZE = 24;

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const timeRange = normalizeRange(searchParams.get("range"));
  const searchQuery = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("category") || "";
  const regionFilter = (
    searchParams.get("region") || getStoredRegion()
  ).toUpperCase();
  const sort = searchParams.get("sort") || "sales";

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [timeRange, searchQuery, categoryFilter, regionFilter, sort]);

  const requestedRankingCycle: 1 | 2 | 3 =
    timeRange === "1d" ? 1 : timeRange === "7d" ? 2 : 3;
  const rankingCycleLabel: Record<1 | 2 | 3, string> = {
    1: "diário",
    2: "semanal",
    3: "mensal",
  };

  const { categories } = useCategories();

  const {
    items,
    effectiveRankingCycle,
    isLoading,
    isValidating,
    error,
    mutate,
  } = useTrendingProducts({
    range: timeRange,
    region: regionFilter,
    sort,
    search: searchQuery || undefined,
    pageSize: 100,
  });

  // Client-side category filtering
  const getProductCategoryId = useCallback(
    (product: ProductDTO): string => {
      if (product.category) return product.category;
      return pickCategoryByHash(product.id, categories);
    },
    [categories],
  );

  const filteredItems = useMemo(() => {
    if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return items;
    return items.filter((p) =>
      matchesCategory(getProductCategoryId(p), categoryFilter, categories),
    );
  }, [items, categoryFilter, categories, getProductCategoryId]);

  const displayedProducts = filteredItems.slice(0, displayCount);
  const hasMore = displayedProducts.length < filteredItems.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  };

  const updateUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("range", overrides.range ?? timeRange);
    params.set("region", overrides.region ?? regionFilter);
    params.set("sort", overrides.sort ?? sort);
    const q = overrides.q ?? searchQuery;
    if (q) params.set("q", q);
    const cat = overrides.category ?? categoryFilter;
    if (cat) params.set("category", cat);
    router.push(`/app/products?${params.toString()}`);
  };

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
            {items.length > 0
              ? `${filteredItems.length} produtos${getCategoryName() ? ` em ${getCategoryName()}` : ""} • Mostrando ${displayedProducts.length}${effectiveRankingCycle && effectiveRankingCycle !== requestedRankingCycle ? ` • dados ${rankingCycleLabel[effectiveRankingCycle]}` : ""}`
              : "Explorando os produtos mais vendidos"}
          </Typography>
        </Box>
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={(r: TimeRange) => updateUrl({ range: r })}
          searchQuery={searchQuery}
          onSearchChange={(q: string) => updateUrl({ q })}
          onRefresh={() => mutate()}
          loading={isLoading || isValidating}
          category={categoryFilter}
          onCategoryChange={(c: string) => updateUrl({ category: c })}
          categories={categories}
        />
        {/* Sort chips */}
        <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          {PRODUCT_RANK_FIELDS.map((rf) => {
            const active = sort === rf.key;
            return (
              <Box
                key={rf.key}
                component="button"
                onClick={() => updateUrl({ sort: rf.key })}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 99,
                  border: active
                    ? "1px solid #2DD4FF"
                    : "1px solid rgba(255,255,255,0.15)",
                  background: active
                    ? "rgba(45,212,255,0.12)"
                    : "rgba(255,255,255,0.05)",
                  color: active ? "#2DD4FF" : "rgba(255,255,255,0.6)",
                  fontSize: "0.75rem",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                  "&:hover": {
                    borderColor: "#2DD4FF",
                    color: "#2DD4FF",
                  },
                }}
              >
                {rf.label}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", mt: 2 }}>
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

        <Grid container spacing={{ xs: 2, md: 2.5 }}>
          {displayedProducts.map((product) => (
            <Grid item xs={6} sm={6} md={4} lg={2.4} key={product.id}>
              <ProductCard product={product} />
            </Grid>
          ))}
          {isLoading &&
            Array.from({ length: 12 }).map((_, idx) => (
              <Grid item xs={6} sm={6} md={4} lg={2.4} key={`skeleton-${idx}`}>
                <ProductCard isLoading />
              </Grid>
            ))}
        </Grid>

        {!isLoading && hasMore && displayedProducts.length > 0 && (
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
              endIcon={<ExpandMore />}
              onClick={handleLoadMore}
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
              Carregar mais
            </Button>
          </Box>
        )}

        {!isLoading && displayedProducts.length === 0 && (
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
