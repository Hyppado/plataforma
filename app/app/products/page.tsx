"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Grid,
  Chip,
  Stack,
} from "@mui/material";
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

const REGION_FLAGS: Record<string, string> = {
  US: "\uD83C\uDDFA\uD83C\uDDF8",
  BR: "\uD83C\uDDE7\uD83C\uDDF7",
  UK: "\uD83C\uDDEC\uD83C\uDDE7",
  GB: "\uD83C\uDDEC\uD83C\uDDE7",
  MX: "\uD83C\uDDF2\uD83C\uDDFD",
  CA: "\uD83C\uDDE8\uD83C\uDDE6",
  AU: "\uD83C\uDDE6\uD83C\uDDFA",
  DE: "\uD83C\uDDE9\uD83C\uDDEA",
  FR: "\uD83C\uDDEB\uD83C\uDDF7",
  ES: "\uD83C\uDDEA\uD83C\uDDF8",
  IT: "\uD83C\uDDEE\uD83C\uDDF9",
  ID: "\uD83C\uDDEE\uD83C\uDDE9",
  PH: "\uD83C\uDDF5\uD83C\uDDED",
  TH: "\uD83C\uDDF9\uD83C\uDDED",
  VN: "\uD83C\uDDFB\uD83C\uDDF3",
  SG: "\uD83C\uDDF8\uD83C\uDDEC",
  MY: "\uD83C\uDDF2\uD83C\uDDFE",
};

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
  const [availableRegions, setAvailableRegions] = useState<string[]>(["US"]);
  const [effectiveRankingCycle, setEffectiveRankingCycle] = useState<
    1 | 2 | 3 | null
  >(null);

  const timeRange = normalizeRange(searchParams.get("range"));
  const searchQuery = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("category") || "";
  const regionFilter = (searchParams.get("region") || "US").toUpperCase();
  const pageSize = 24;

  const requestedRankingCycle: 1 | 2 | 3 =
    timeRange === "1d" ? 1 : timeRange === "7d" ? 2 : 3;
  const rankingCycleLabel: Record<1 | 2 | 3, string> = {
    1: "di\u00e1rio",
    2: "semanal",
    3: "mensal",
  };

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  const getProductCategoryId = useCallback(
    (product: ProductDTO): string => {
      if (product.category) return product.category;
      return pickCategoryByHash(product.id, categories);
    },
    [categories],
  );

  const filterByCategory = useCallback(
    (items: ProductDTO[]): ProductDTO[] => {
      if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return items;
      return items.filter((p) =>
        matchesCategory(getProductCategoryId(p), categoryFilter, categories),
      );
    },
    [categoryFilter, categories, getProductCategoryId],
  );

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setPage(1);
      try {
        const params = new URLSearchParams({
          range: timeRange,
          region: regionFilter,
        });
        if (searchQuery) params.set("search", searchQuery);
        const res = await fetch(`/api/trending/products?${params}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const items: ProductDTO[] = json?.data?.items ?? [];
        setAllProducts(items);
        setEffectiveRankingCycle(
          (json?.data?.effectiveRankingCycle as 1 | 2 | 3 | undefined) ?? null,
        );
        if (json?.data?.availableRegions?.length > 0) {
          setAvailableRegions(json.data.availableRegions);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch products:", err);
        setError("Erro ao carregar produtos. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [timeRange, searchQuery, regionFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    const filtered = filterByCategory(allProducts);
    setProducts(filtered.slice(0, pageSize));
    setPage(1);
  }, [allProducts, filterByCategory, pageSize]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const start = nextPage * pageSize;
    const end = start + pageSize;
    const filtered = filterByCategory(allProducts);
    const moreProducts = filtered.slice(start, end);
    setTimeout(() => {
      setProducts((prev) => [...prev, ...moreProducts]);
      setPage(nextPage);
      setLoadingMore(false);
    }, 300);
  };

  const updateUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("range", overrides.range ?? timeRange);
    params.set("region", overrides.region ?? regionFilter);
    const q = overrides.q ?? searchQuery;
    if (q) params.set("q", q);
    const cat = overrides.category ?? categoryFilter;
    if (cat) params.set("category", cat);
    router.push(`/app/products?${params.toString()}`);
  };

  const handleViewDetails = (product: ProductDTO) => {
    console.log("View details for", product.id);
  };

  const filteredTotal = filterByCategory(allProducts).length;
  const hasMore = products.length < filteredTotal;

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
            {allProducts.length > 0
              ? `${filteredTotal} produtos${getCategoryName() ? ` em ${getCategoryName()}` : ""} \u2022 Mostrando ${products.length}${effectiveRankingCycle && effectiveRankingCycle !== requestedRankingCycle ? ` \u2022 dados ${rankingCycleLabel[effectiveRankingCycle]}` : ""}`
              : "Explorando os produtos mais vendidos"}
          </Typography>
        </Box>
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={(r: TimeRange) => updateUrl({ range: r })}
          searchQuery={searchQuery}
          onSearchChange={(q: string) => updateUrl({ q })}
          onRefresh={() => fetchData()}
          loading={loading}
          category={categoryFilter}
          onCategoryChange={(c: string) => updateUrl({ category: c })}
          categories={categories}
        />
        {availableRegions.length > 1 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            {availableRegions.map((r) => (
              <Chip
                key={r}
                label={`${REGION_FLAGS[r] ?? ""} ${r}`}
                size="small"
                onClick={() => updateUrl({ region: r })}
                variant={regionFilter === r ? "filled" : "outlined"}
                sx={{
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  borderColor:
                    regionFilter === r ? "#2DD4FF" : "rgba(255,255,255,0.2)",
                  color:
                    regionFilter === r ? "#0a0a0f" : "rgba(255,255,255,0.7)",
                  background: regionFilter === r ? "#2DD4FF" : "transparent",
                  "&:hover": {
                    borderColor: "#2DD4FF",
                    background:
                      regionFilter === r ? "#2DD4FF" : "rgba(45,212,255,0.08)",
                  },
                }}
              />
            ))}
          </Stack>
        )}
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
          {products.map((product) => (
            <Grid item xs={6} sm={6} md={4} lg={2.4} key={product.id}>
              <ProductCard
                product={product}
                onViewDetails={handleViewDetails}
              />
            </Grid>
          ))}
          {loading &&
            Array.from({ length: 12 }).map((_, idx) => (
              <Grid item xs={6} sm={6} md={4} lg={2.4} key={`skeleton-${idx}`}>
                <ProductCard isLoading />
              </Grid>
            ))}
        </Grid>

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
