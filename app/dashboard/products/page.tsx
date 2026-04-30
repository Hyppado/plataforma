"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Grid, IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { GridView, ViewList } from "@mui/icons-material";
import { ProductTable } from "@/app/components/dashboard/DataTable";
import { ProductCard } from "@/app/components/cards/ProductCard";
import { ProductDetailsModal } from "@/app/components/cards/ProductDetailsModal";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import { matchesCategory, ALL_CATEGORY_ID } from "@/lib/categories";
import { getStoredRegion } from "@/lib/region";
import { useNewProducts } from "@/lib/swr/useTrending";
import { useCategories } from "@/lib/swr/useCategories";
import { useViewMode } from "@/lib/useViewMode";
import type { ProductDTO } from "@/lib/types/dto";

const PAGE_SIZE = 100;

function TrendsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(
    null,
  );
  const [viewMode, setViewMode] = useViewMode("hyppado-new-products-view");

  const categoryFilter = searchParams.get("category") || "";
  const regionFilter = (
    searchParams.get("region") || getStoredRegion()
  ).toUpperCase();

  const { categories } = useCategories();

  const { items, total, isLoading, isValidating, error, mutate } =
    useNewProducts({
      region: regionFilter,
      pageSize: PAGE_SIZE,
    });

  // Client-side category filtering
  const filteredItems = useMemo(() => {
    if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return items;
    return items.filter((p) =>
      matchesCategory(p.category || p.id, categoryFilter, categories),
    );
  }, [items, categoryFilter, categories]);

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (regionFilter) params.set("region", regionFilter);
    router.push(`/dashboard/products?${params.toString()}`);
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
      {/* Fixed Header */}
      <Box sx={{ flexShrink: 0 }}>
        <Box sx={{ mb: 1.5 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.25 }}
          >
            <Typography
              component="h1"
              sx={(theme) => ({
                fontSize: "1.25rem",
                fontWeight: 800,
                lineHeight: 1.3,
                background: `linear-gradient(90deg, #fff 0%, ${theme.palette.primary.main} 60%, #fff 100%)`,
                backgroundSize: "200% auto",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "titleShimmer 4s linear infinite",
                "@keyframes titleShimmer": {
                  "0%": { backgroundPosition: "0% center" },
                  "100%": { backgroundPosition: "200% center" },
                },
              })}
            >
              Novos Produtos
            </Typography>
            <Box
              sx={(theme) => ({
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 0.9,
                py: 0.25,
                borderRadius: 10,
                background: alpha(theme.palette.primary.main, 0.08),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              })}
            >
              <Box
                sx={(theme) => ({
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  bgcolor: theme.palette.primary.main,
                  boxShadow: `0 0 6px ${theme.palette.primary.main}`,
                  animation: "liveDot 1.8s ease-in-out infinite",
                  "@keyframes liveDot": {
                    "0%, 100%": { opacity: 1, transform: "scale(1)" },
                    "50%": { opacity: 0.4, transform: "scale(0.7)" },
                  },
                })}
              />
              <Typography
                sx={{
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  color: "primary.main",
                  letterSpacing: "0.06em",
                }}
              >
                AO VIVO
              </Typography>
            </Box>
          </Box>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.3,
            }}
          >
            {filteredItems.length > 0
              ? `${filteredItems.length} produtos novos${getCategoryName() ? ` em ${getCategoryName()}` : ""} nos últimos 3 dias`
              : `Produtos descobertos nos últimos 3 dias no TikTok Shop`}
          </Typography>
        </Box>
        <DashboardHeader
          onRefresh={() => mutate()}
          loading={isLoading || isValidating}
          category={categoryFilter}
          onCategoryChange={handleCategoryChange}
          categories={categories}
        />
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
          <Tooltip title="Cards">
            <IconButton
              size="small"
              onClick={() => setViewMode("card")}
              sx={{
                color:
                  viewMode === "card"
                    ? "primary.main"
                    : "rgba(255,255,255,0.3)",
              }}
            >
              <GridView fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Lista">
            <IconButton
              size="small"
              onClick={() => setViewMode("list")}
              sx={{
                color:
                  viewMode === "list"
                    ? "primary.main"
                    : "rgba(255,255,255,0.3)",
              }}
            >
              <ViewList fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
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

        {/* Trending Products Table */}
        {viewMode === "list" ? (
          <ProductTable
            products={filteredItems}
            loading={isLoading}
            title="Novos Produtos"
            onProductClick={setSelectedProduct}
            avatarVideoSource="new-products"
          />
        ) : (
          <Grid container spacing={{ xs: 2, md: 2.5 }}>
            {filteredItems.map((product) => (
              <Grid item xs={6} sm={6} md={4} lg={2.4} key={product.id}>
                <ProductCard
                  product={product}
                  onViewDetails={(p) => setSelectedProduct(p)}
                  avatarVideoSource="new-products"
                />
              </Grid>
            ))}
            {isLoading &&
              Array.from({ length: 12 }).map((_, idx) => (
                <Grid
                  item
                  xs={6}
                  sm={6}
                  md={4}
                  lg={2.4}
                  key={`skeleton-${idx}`}
                >
                  <ProductCard isLoading />
                </Grid>
              ))}
          </Grid>
        )}
      </Box>

      {selectedProduct && (
        <ProductDetailsModal
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          avatarVideoSource="new-products"
        />
      )}
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
