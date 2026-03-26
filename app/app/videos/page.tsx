"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Button, CircularProgress, Grid } from "@mui/material";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import { VideoCard } from "@/app/components/cards/VideoCard";
import type { VideoDTO } from "@/lib/types/dto";
import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";
import { ExpandMore } from "@mui/icons-material";
import {
  fetchCategories,
  matchesCategory,
  ALL_CATEGORY_ID,
  type Category,
} from "@/lib/categories";
import { getStoredRegion } from "@/lib/region";
import { VIDEO_RANK_FIELDS } from "@/lib/echotik/rankFields";

function VideosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [allVideos, setAllVideos] = useState<VideoDTO[]>([]);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>(["US"]);
  const [effectiveRankingCycle, setEffectiveRankingCycle] = useState<
    1 | 2 | 3 | null
  >(null);

  // Read from URL
  const timeRange = normalizeRange(searchParams.get("range"));
  const searchQuery = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("category") || "";
  const regionFilter = (
    searchParams.get("region") || getStoredRegion()
  ).toUpperCase();
  const sort = searchParams.get("sort") || "sales";
  const pageSize = 24; // Carregar 24 por vez

  const requestedRankingCycle: 1 | 2 | 3 =
    timeRange === "1d" ? 1 : timeRange === "7d" ? 2 : 3;

  const rankingCycleLabel: Record<1 | 2 | 3, string> = {
    1: "diário",
    2: "semanal",
    3: "mensal",
  };

  // Load categories on mount
  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  // Helper to get category ID for a video
  const getVideoCategoryId = useCallback(
    (video: VideoDTO): string | undefined => {
      return video.categoryId ?? video.product?.category;
    },
    [],
  );

  // Filter videos by category (pure derivation, not a dependency of fetch)
  const filterByCategory = useCallback(
    (items: VideoDTO[]): VideoDTO[] => {
      if (!categoryFilter || categoryFilter === ALL_CATEGORY_ID) return items;
      return items.filter((v) =>
        matchesCategory(getVideoCategoryId(v), categoryFilter, categories),
      );
    },
    [categoryFilter, categories, getVideoCategoryId],
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
          sort,
        });
        if (searchQuery) params.set("search", searchQuery);

        const res = await fetch(`/api/trending/videos?${params}`, { signal });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        const items: VideoDTO[] = json?.data?.items ?? [];
        setAllVideos(items);
        setEffectiveRankingCycle(
          (json?.data?.effectiveRankingCycle as 1 | 2 | 3 | undefined) ?? null,
        );

        if (json?.data?.availableRegions?.length > 0) {
          setAvailableRegions(json.data.availableRegions);
        }

        if (json?.data?.error) {
          console.warn("Videos API returned error:", json.data.error);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch videos:", err);
        setError("Erro ao carregar vídeos. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [timeRange, searchQuery, regionFilter, sort],
  );

  // Fetch only when query params change (not when categories change)
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // Re-apply category filter whenever allVideos or filter criteria change
  useEffect(() => {
    const filtered = filterByCategory(allVideos);
    setVideos(filtered.slice(0, pageSize));
    setPage(1);
  }, [allVideos, filterByCategory, pageSize]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const start = nextPage * pageSize;
    const end = start + pageSize;

    // Apply category filter for load more
    const filtered = filterByCategory(allVideos);
    const moreVideos = filtered.slice(start, end);

    setTimeout(() => {
      setVideos((prev) => [...prev, ...moreVideos]);
      setPage(nextPage);
      setLoadingMore(false);
    }, 300);
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    const params = new URLSearchParams();
    params.set("range", range);
    params.set("region", regionFilter);
    params.set("sort", sort);
    if (searchQuery) params.set("q", searchQuery);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/app/videos?${params.toString()}`);
  };

  const handleSearchChange = (query: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    params.set("region", regionFilter);
    params.set("sort", sort);
    if (query) params.set("q", query);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/app/videos?${params.toString()}`);
  };

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    params.set("region", regionFilter);
    params.set("sort", sort);
    if (searchQuery) params.set("q", searchQuery);
    if (category) params.set("category", category);
    router.push(`/app/videos?${params.toString()}`);
  };

  const handleRegionChange = (region: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    params.set("region", region);
    params.set("sort", sort);
    if (searchQuery) params.set("q", searchQuery);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/app/videos?${params.toString()}`);
  };

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams();
    params.set("range", timeRange);
    params.set("region", regionFilter);
    params.set("sort", newSort);
    if (searchQuery) params.set("q", searchQuery);
    if (categoryFilter) params.set("category", categoryFilter);
    router.push(`/app/videos?${params.toString()}`);
  };

  const handleInsightClick = (video: VideoDTO) => {
    console.log("Insight clicked for", video.id);
    // TODO: Implementar modal de insight
  };

  // Calculate hasMore based on filtered data
  const filteredTotal = filterByCategory(allVideos).length;
  const hasMore = videos.length < filteredTotal;

  // Get category name for display (preferir PT)
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
            Vídeos em Alta
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.3,
            }}
          >
            {allVideos.length > 0
              ? `${filteredTotal} vídeos${getCategoryName() ? ` em ${getCategoryName()}` : ""} • Mostrando ${videos.length}${effectiveRankingCycle && effectiveRankingCycle !== requestedRankingCycle ? ` • dados ${rankingCycleLabel[effectiveRankingCycle]}` : ""}`
              : "Explorando os vídeos mais performáticos"}
          </Typography>
        </Box>
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onRefresh={() => fetchData()}
          loading={loading}
          category={categoryFilter}
          onCategoryChange={handleCategoryChange}
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
                onClick={() => handleSortChange(rf.key)}
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
          {videos.map((video, idx) => (
            <Grid item xs={6} sm={6} md={6} lg={3} key={video.id}>
              <VideoCard video={video} rank={idx + 1} />
            </Grid>
          ))}

          {/* Loading skeletons */}
          {loading &&
            Array.from({ length: 12 }).map((_, idx) => (
              <Grid item xs={6} sm={6} md={6} lg={3} key={`skeleton-${idx}`}>
                <VideoCard isLoading />
              </Grid>
            ))}
        </Grid>

        {/* Load More Button */}
        {!loading && hasMore && videos.length > 0 && (
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
        {!loading && videos.length === 0 && (
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
