"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { ProductTable } from "@/app/components/dashboard/DataTable";
import { ProductDetailsModal } from "@/app/components/cards/ProductDetailsModal";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import { matchesCategory, ALL_CATEGORY_ID } from "@/lib/categories";
import { getStoredRegion } from "@/lib/region";
import { useNewProducts } from "@/lib/swr/useTrending";
import { useCategories } from "@/lib/swr/useCategories";
import type { ProductDTO } from "@/lib/types/dto";

const PAGE_SIZE = 100;

function TrendsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(
    null,
  );

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
            Novos Produtos
          </Typography>
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
        <ProductTable
          products={filteredItems}
          loading={isLoading}
          title="Novos Produtos"
          onProductClick={setSelectedProduct}
        />
      </Box>

      {selectedProduct && (
        <ProductDetailsModal
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
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
