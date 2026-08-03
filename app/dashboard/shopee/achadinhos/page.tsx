/**
 * app/dashboard/shopee/achadinhos/page.tsx
 *
 * Página de "Achadinhos Shopee" — réplica exata da página "Vídeos em Alta"
 * (app/dashboard/videos/page.tsx), mas exibindo produtos extraídos via
 * pipeline de IA (Whisper → GPT → Shopee API).
 *
 * Funcionalidades:
 * - DashboardHeader com filtro de categoria
 * - Sort chips (mais recentes, maior preço, mais vendidos)
 * - Grid de cards com animação de entrada
 * - Botão "Carregar mais" com paginação incremental
 * - Skeleton loading e estado vazio
 * - Admin pode editar link de afiliado diretamente nos cards
 */

"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Button, Grid } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import { ExpandMore } from "@mui/icons-material";
import { useShopeeAchadinhosFeed } from "@/lib/swr/useShopee";
import { ShopeeAchadinhoCard } from "@/app/components/shopee/ShopeeAchadinhoCard";

const PAGE_SIZE = 24;

// Opções de ordenação
const SORT_OPTIONS = [
  { key: "createdAt", label: "Recentes" },
  { key: "price", label: "Preço" },
  { key: "saleCount", label: "Mais Vendidos" },
];

function ShopeeAchadinhosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Ordenação final: por padrão, "Mais Vendidos" (saleCount desc) — o usuário
  // vê os produtos de maior sucesso no topo. Pode trocar para Recentes/Preço.
  const categoryFilter = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "saleCount";
  const order = searchParams.get("order") || "desc";

  // Reseta contagem quando filtros mudam
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [categoryFilter, sort, order]);

  const {
    achadinhos,
    total,
    hasMore,
    categorias,
    isLoading,
    isValidating,
    error,
    mutate,
  } = useShopeeAchadinhosFeed({
    page: 1,
    pageSize: 100,
    sort,
    order,
    category: categoryFilter || undefined,
  });

  const displayedItems = achadinhos.slice(0, displayCount);
  const hasMoreItems = displayedItems.length < achadinhos.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  };

  const updateUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (overrides.sort) params.set("sort", overrides.sort);
    if (overrides.order) params.set("order", overrides.order);
    const cat = overrides.category ?? categoryFilter;
    if (cat) params.set("category", cat);
    router.push(`/dashboard/shopee/achadinhos?${params.toString()}`);
  };

  const handleSortChange = (sortKey: string) => {
    const isSame = sort === sortKey;
    const newOrder = isSame && order === "desc" ? "asc" : "desc";
    // Para "Recentes", sempre desc (mais novo primeiro)
    const finalOrder = sortKey === "createdAt" ? "desc" : newOrder;
    updateUrl({ sort: sortKey, order: finalOrder });
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
              Achadinhos Shopee
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
            {achadinhos.length > 0
              ? `${total} produtos • Mostrando ${displayedItems.length}`
              : "Produtos da shopee extraídos diretamente de videos do TikTok"}
          </Typography>
        </Box>

        {/* DashboardHeader com filtro de categoria */}
        <DashboardHeader
          onRefresh={() => mutate()}
          loading={isLoading || isValidating}
          category={categoryFilter}
          onCategoryChange={(c: string) => updateUrl({ category: c })}
          categories={categorias.map((c) => ({ id: c, name: c })) as any}
        />

        {/* Sort chips */}
        <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.key;
            return (
              <Box
                key={opt.key}
                component="button"
                onClick={() => handleSortChange(opt.key)}
                sx={(theme) => ({
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 99,
                  border: active
                    ? `1px solid ${theme.palette.primary.main}`
                    : "1px solid rgba(255,255,255,0.15)",
                  background: active
                    ? alpha(theme.palette.primary.main, 0.15)
                    : "rgba(255,255,255,0.05)",
                  color: active
                    ? theme.palette.primary.main
                    : "rgba(255,255,255,0.6)",
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
                {opt.label} {active && (order === "asc" ? "↑" : "↓")}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Conteúdo scrollável */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", mt: 2 }}>
        {/* Estado de erro */}
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

        {/* Grid de cards */}
        <Grid container spacing={{ xs: 2, md: 2.5 }}>
          {displayedItems.map((achadinho, idx) => (
            <Grid
              item
              xs={6}
              sm={6}
              md={6}
              lg={3}
              key={achadinho.id}
              sx={{
                animation: "cardEntry 0.35s ease both",
                animationDelay: `${Math.min(idx * 30, 300)}ms`,
                "@keyframes cardEntry": {
                  "0%": { opacity: 0, transform: "translateY(12px)" },
                  "100%": { opacity: 1, transform: "translateY(0)" },
                },
              }}
            >
              <ShopeeAchadinhoCard
                achadinho={achadinho}
                rank={idx + 1}
                onUpdate={() => mutate()}
              />
            </Grid>
          ))}

          {/* Skeleton loading */}
          {isLoading &&
            Array.from({ length: 12 }).map((_, idx) => (
              <Grid item xs={6} sm={6} md={6} lg={3} key={`skeleton-${idx}`}>
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
                      paddingTop: "56.25%",
                      background: "linear-gradient(135deg, #0D121C 0%, #1A1F2E 100%)",
                      animation: "shimmer 1.5s ease-in-out infinite",
                      "@keyframes shimmer": {
                        "0%": { opacity: 1 },
                        "50%": { opacity: 0.5 },
                        "100%": { opacity: 1 },
                      },
                    }}
                  />
                  <Box sx={{ p: 1.5 }}>
                    <Box
                      sx={{
                        height: 12,
                        width: "80%",
                        borderRadius: 1,
                        background: "rgba(255,255,255,0.06)",
                        mb: 0.75,
                      }}
                    />
                    <Box
                      sx={{
                        height: 10,
                        width: "40%",
                        borderRadius: 1,
                        background: "rgba(255,255,255,0.04)",
                      }}
                    />
                  </Box>
                </Box>
              </Grid>
            ))}
        </Grid>

        {/* Botão Carregar Mais */}
        {!isLoading && hasMoreItems && displayedItems.length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4, mb: 2 }}>
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

        {/* Estado vazio */}
        {!isLoading && displayedItems.length === 0 && (
          <Box
            sx={{
              textAlign: "center",
              py: 8,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <Typography sx={{ fontSize: "0.95rem" }}>
              Nenhum achadinho encontrado
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function ShopeeAchadinhosPage() {
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
      <ShopeeAchadinhosContent />
    </Suspense>
  );
}