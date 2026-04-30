"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Button, CircularProgress, Grid } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import { VideoCard } from "@/app/components/cards/VideoCard";
import type { VideoDTO } from "@/lib/types/dto";
import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";
import { ExpandMore } from "@mui/icons-material";
import { matchesCategory, ALL_CATEGORY_ID } from "@/lib/categories";
import { getStoredRegion } from "@/lib/region";
import { VIDEO_RANK_FIELDS } from "@/lib/echotik/rankFields";
import { useTrendingVideos } from "@/lib/swr/useTrending";
import { useCategories } from "@/lib/swr/useCategories";

const PAGE_SIZE = 24;

function VideosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const timeRange = normalizeRange(searchParams.get("range"));
  const categoryFilter = searchParams.get("category") || "";
  const regionFilter = (
    searchParams.get("region") || getStoredRegion()
  ).toUpperCase();
  const sort = searchParams.get("sort") || "sales";

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [timeRange, categoryFilter, regionFilter, sort]);

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
  } = useTrendingVideos({
    range: timeRange,
    region: regionFilter,
    sort,
    pageSize: 100,
  });

  // Client-side category filtering
  const getVideoCategoryId = useCallback(
    (video: VideoDTO): string | undefined => {
      return video.categoryId ?? video.product?.category;
    },
    [],
  );

  const filteredItems = useMemo(() => {
    if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return items;
    return items.filter((v) =>
      matchesCategory(getVideoCategoryId(v), categoryFilter, categories),
    );
  }, [items, categoryFilter, categories, getVideoCategoryId]);

  const displayedVideos = filteredItems.slice(0, displayCount);
  const hasMore = displayedVideos.length < filteredItems.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  };

  const updateUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("range", overrides.range ?? timeRange);
    params.set("region", overrides.region ?? regionFilter);
    params.set("sort", overrides.sort ?? sort);
    const cat = overrides.category ?? categoryFilter;
    if (cat) params.set("category", cat);
    router.push(`/dashboard/videos?${params.toString()}`);
  };

  const getCategoryName = () => {
    if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return "";
    const cat = categories.find(
      (c) => c.id === categoryFilter || c.slug === categoryFilter,
    );
    return (
      (cat as typeof cat & { namePt?: string })?.namePt ||
      cat?.name ||
      categoryFilter
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
              Vídeos em Alta
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
            {items.length > 0
              ? `${filteredItems.length} vídeos${getCategoryName() ? ` em ${getCategoryName()}` : ""} • Mostrando ${displayedVideos.length}${effectiveRankingCycle && effectiveRankingCycle !== requestedRankingCycle ? ` • dados ${rankingCycleLabel[effectiveRankingCycle]}` : ""}`
              : "Explorando os vídeos mais performáticos"}
          </Typography>
        </Box>
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={(r: TimeRange) => updateUrl({ range: r })}
          onRefresh={() => mutate()}
          loading={isLoading || isValidating}
          category={categoryFilter}
          onCategoryChange={(c: string) => updateUrl({ category: c })}
          categories={categories}
        />
        {/* Sort chips */}
        <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          {VIDEO_RANK_FIELDS.map((rf) => {
            const active = sort === rf.key;
            return (
              <Box
                key={rf.key}
                component="button"
                onClick={() => updateUrl({ sort: rf.key })}
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
                {rf.label}
              </Box>
            );
          })}
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

        {/* Video Grid */}
        <Grid container spacing={{ xs: 2, md: 2.5 }}>
          {displayedVideos.map((video, idx) => (
            <Grid
              item
              xs={6}
              sm={6}
              md={6}
              lg={3}
              key={video.id}
              sx={{
                animation: "cardEntry 0.35s ease both",
                animationDelay: `${Math.min(idx * 30, 300)}ms`,
                "@keyframes cardEntry": {
                  "0%": { opacity: 0, transform: "translateY(12px)" },
                  "100%": { opacity: 1, transform: "translateY(0)" },
                },
              }}
            >
              <VideoCard video={video} rank={idx + 1} />
            </Grid>
          ))}

          {/* Loading skeletons */}
          {isLoading &&
            Array.from({ length: 12 }).map((_, idx) => (
              <Grid item xs={6} sm={6} md={6} lg={3} key={`skeleton-${idx}`}>
                <VideoCard isLoading />
              </Grid>
            ))}
        </Grid>

        {/* Load More Button */}
        {!isLoading && hasMore && displayedVideos.length > 0 && (
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

        {/* Empty State */}
        {!isLoading && displayedVideos.length === 0 && (
          <Box
            sx={{
              textAlign: "center",
              py: 8,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <Typography sx={{ fontSize: "0.95rem" }}>
              Nenhum vídeo encontrado
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function VideosPage() {
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
      <VideosContent />
    </Suspense>
  );
}
