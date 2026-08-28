/**
 * app/dashboard/shopee/ranking/page.tsx
 *
 * Página de "Ranking Shopee" — réplica exata de "Produtos Hype"
 * (app/dashboard/trends/page.tsx), mas exibindo produtos do ranking Shopee.
 *
 * Funcionalidades:
 * - DashboardHeader com filtro de tempo + categoria
 * - Sort chips (mais vendidos, maior receita, maior comissão, menor preço)
 * - Grid de cards com ProductCard + ProductDetailsModal
 * - Botão "Criar vídeo com avatar" (integrado ao ProductCard)
 * - Load more + animação de entrada
 * - Alterna entre cards/lista
 */

"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  Grid,
  IconButton,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ShopeeProductCard } from "@/app/components/shopee/ShopeeProductCard";
import { ShopeeProductTable } from "@/app/components/shopee/ShopeeProductTable";
import { ShopeeProductDetailsModal } from "@/app/components/shopee/ShopeeProductDetailsModal";
import { ShopeeCategoryDropdown } from "@/app/components/shopee/ShopeeCategoryDropdown";
import { ExpandMore, GridView, ViewList } from "@mui/icons-material";
import { useViewMode } from "@/lib/useViewMode";
import { useShopeeRanking } from "@/lib/swr/useShopee";
import {
  matchesShopeeCategory,
} from "@/lib/shopee/shopee-categories";
import type { ShopeeProductTrendDTO } from "@/lib/swr/useShopee";

const PAGE_SIZE = 24;

// Opções de ordenação (mesmo padrão do TikTok)
const SHOPEE_SORT_FIELDS = [
  { key: "sales", label: "Mais Vendidos" },
  { key: "gmv", label: "Maior Receita" },
  { key: "commission", label: "Maior Comissão" },
  { key: "price", label: "Menor Preço" },
];

function ShopeeRankingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [selectedProduct, setSelectedProduct] = useState<ShopeeProductTrendDTO | null>(null);
  const [viewMode, setViewMode] = useViewMode("hyppado-shopee-ranking-view");

  const sort = searchParams.get("sort") || "sales";
  const categoryFilter = searchParams.get("category") || "";

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [sort, categoryFilter]);

  const { products, categories, isLoading, error } = useShopeeRanking();

  // Ordenação local usando dados brutos da Shopee
  const sortedItems = useMemo(() => {
    const sorted = [...products];
    switch (sort) {
      case "gmv":
        sorted.sort((a, b) => b.gmv - a.gmv);
        break;
      case "commission":
        sorted.sort((a, b) => b.commissionRate - a.commissionRate);
        break;
      case "price":
        sorted.sort((a, b) => a.price - b.price);
        break;
      default: // sales
        sorted.sort((a, b) => b.saleCount - a.saleCount);
    }
    return sorted;
  }, [products, sort]);

  // A árvore vem da dimensão oficial (servida pela rota), não é mais derivada
  // dos produtos carregados — o dropdown mostrava só as categorias que por
  // acaso estivessem nos 100 primeiros.
  const categoryTree = categories;

  // Filtra por categoria selecionada (pai ou subcategoria)
  const filteredItems = useMemo(() => {
    if (!categoryFilter) return sortedItems;
    return sortedItems.filter((p) => matchesShopeeCategory(p, categoryFilter));
  }, [sortedItems, categoryFilter]);

  const displayedProducts = filteredItems.slice(0, displayCount);
  const hasMore = displayedProducts.length < filteredItems.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  };

  const updateUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("sort", overrides.sort ?? sort);
    const cat = overrides.category ?? categoryFilter;
    if (cat) params.set("category", cat);
    router.push(`/dashboard/shopee/ranking?${params.toString()}`);
  };

  const handleCategoryChange = (category: string) => {
    // Salva a categoria no estado local persistente (desmonta e remonta
    // quando necessário; continua funcional mesmo se os produtos mudarem).
    router.push(
      `/dashboard/shopee/ranking?${new URLSearchParams({
        sort,
        ...(category ? { category } : {}),
      }).toString()}`,
    );
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
      {/* Header fixo */}
      <Box sx={{ flexShrink: 0 }}>
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.25 }}>
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
              Ranking Shopee
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
              <Typography sx={{ fontSize: "0.58rem", fontWeight: 700, color: "primary.main", letterSpacing: "0.06em" }}>
                SHOPEE
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>
            {products.length > 0
              ? `${sortedItems.length} produtos • Mostrando ${displayedProducts.length}`
              : "Explorando os produtos mais vendidos da Shopee"}
          </Typography>
        </Box>

        {/* Categoria dropdown + Sort chips + View toggle */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.5, gap: 1, flexWrap: { xs: "wrap", md: "nowrap" } }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <ShopeeCategoryDropdown
              value={categoryFilter}
              onChange={handleCategoryChange}
              categories={categoryTree}
              disabled={isLoading}
            />
            {SHOPEE_SORT_FIELDS.map((rf) => {
              const active = sort === rf.key;
              return (
                <Box
                  key={rf.key}
                  component="button"
                  onClick={() => updateUrl({ sort: rf.key, category: categoryFilter })}
                  sx={(theme) => ({
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 99,
                    border: active ? `1px solid ${theme.palette.primary.main}` : "1px solid rgba(255,255,255,0.15)",
                    background: active ? alpha(theme.palette.primary.main, 0.15) : "rgba(255,255,255,0.05)",
                    color: active ? theme.palette.primary.main : "rgba(255,255,255,0.6)",
                    fontSize: "0.75rem",
                    fontWeight: active ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    boxShadow: active
                      ? `0 0 12px ${alpha(theme.palette.primary.main, 0.3)}, inset 0 0 8px ${alpha(theme.palette.primary.main, 0.05)}`
                      : "none",
                    "&:hover": {
                      borderColor: theme.palette.primary.main,
                      color: theme.palette.primary.main,
                      boxShadow: `0 0 10px ${alpha(theme.palette.primary.main, 0.2)}`,
                    },
                  })}
                >
                  {rf.label}
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: "flex", flexShrink: 0, ml: 1 }}>
            <Tooltip title="Cards">
              <IconButton size="small" onClick={() => setViewMode("card")} sx={{ color: viewMode === "card" ? "primary.main" : "rgba(255,255,255,0.3)" }}>
                <GridView fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Lista">
              <IconButton size="small" onClick={() => setViewMode("list")} sx={{ color: viewMode === "list" ? "primary.main" : "rgba(255,255,255,0.3)" }}>
                <ViewList fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Conteúdo scrollável */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", mt: 2 }}>
        {error && (
          <Box role="alert" aria-live="assertive" sx={{ mb: 2, p: 2, borderRadius: 2, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#ef4444", fontSize: "0.8125rem" }}>
            {error}
          </Box>
        )}

        {viewMode === "list" ? (
          <ShopeeProductTable
            products={displayedProducts}
            loading={isLoading}
            title="Ranking Shopee"
            onProductClick={(p) => setSelectedProduct(p)}
          />
        ) : (
          <Grid container spacing={{ xs: 2, md: 2.5 }}>
            {displayedProducts.map((product, idx) => (
              <Grid
                item xs={6} sm={6} md={4} lg={2.4}
                key={product.id}
                sx={{
                  animation: "cardEntry 0.35s ease both",
                  animationDelay: `${Math.min(idx * 25, 300)}ms`,
                  "@keyframes cardEntry": {
                    "0%": { opacity: 0, transform: "translateY(12px)" },
                    "100%": { opacity: 1, transform: "translateY(0)" },
                  },
                }}
              >
                <ShopeeProductCard
                  product={product}
                  onClick={(p) => setSelectedProduct(p)}
                />
              </Grid>
            ))}
            {isLoading &&
              Array.from({ length: 12 }).map((_, idx) => (
                <Grid item xs={6} sm={6} md={4} lg={2.4} key={`skeleton-${idx}`}>
                  <Box
                    sx={{
                      borderRadius: 2.5,
                      overflow: "hidden",
                      background: "#0D121C",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        paddingTop: "100%",
                        background: "#0A0F18",
                      }}
                    />
                    <Box sx={{ p: 1.5 }}>
                      <Box
                        sx={{
                          height: 14,
                          width: "80%",
                          borderRadius: 1,
                          background: "rgba(255,255,255,0.06)",
                          mb: 1,
                        }}
                      />
                      <Box
                        sx={{
                          height: 12,
                          width: "50%",
                          borderRadius: 1,
                          background: "rgba(255,255,255,0.04)",
                        }}
                      />
                    </Box>
                  </Box>
                </Grid>
              ))}
          </Grid>
        )}

        {!isLoading && hasMore && displayedProducts.length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4, mb: 2 }}>
            <Button
              variant="outlined"
              size="large"
              endIcon={<ExpandMore />}
              onClick={handleLoadMore}
              sx={{ px: 4, py: 1.25, fontSize: "0.875rem", fontWeight: 600, textTransform: "none", borderRadius: 3, borderColor: "rgba(45,212,255,0.3)", color: "#2DD4FF", transition: "all 180ms ease", "&:hover": { borderColor: "#2DD4FF", background: "rgba(45,212,255,0.08)" } }}
            >
              Carregar mais
            </Button>
          </Box>
        )}

        {/* Só no modo card: a tabela já tem a própria linha de "nenhum
            produto", e as duas juntas apareceriam duplicadas. */}
        {!isLoading && viewMode === "card" && displayedProducts.length === 0 && (
          <Box sx={{ textAlign: "center", py: 8, color: "rgba(255,255,255,0.5)" }}>
            <Typography sx={{ fontSize: "0.95rem" }}>Nenhum produto encontrado</Typography>
          </Box>
        )}
      </Box>

      {selectedProduct && (
        <ShopeeProductDetailsModal
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
        />
      )}
    </Box>
  );
}

export default function ShopeeRankingPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography>Carregando...</Typography>
        </Box>
      }
    >
      <ShopeeRankingContent />
    </Suspense>
  );
}