"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { CreatorTable } from "@/app/components/dashboard/DataTable";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";
import { getStoredRegion } from "@/lib/region";
import { CREATOR_RANK_FIELDS } from "@/lib/echotik/rankFields";
import { useTrendingCreators } from "@/lib/swr/useTrending";

function CreatorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const timeRange = normalizeRange(searchParams.get("range"));
  const searchQuery = searchParams.get("q") || "";
  const regionFilter = (
    searchParams.get("region") || getStoredRegion()
  ).toUpperCase();
  const sort = searchParams.get("sort") || "sales";

  const requestedRankingCycle: 1 | 2 | 3 =
    timeRange === "1d" ? 1 : timeRange === "7d" ? 2 : 3;
  const rankingCycleLabel: Record<1 | 2 | 3, string> = {
    1: "diário",
    2: "semanal",
    3: "mensal",
  };

  const {
    items: creators,
    effectiveRankingCycle,
    isLoading,
    isValidating,
    error,
    mutate,
  } = useTrendingCreators({
    range: timeRange,
    region: regionFilter,
    sort,
    search: searchQuery || undefined,
    pageSize: 100,
  });

  const updateUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("range", overrides.range ?? timeRange);
    params.set("region", overrides.region ?? regionFilter);
    params.set("sort", overrides.sort ?? sort);
    const q = overrides.q ?? searchQuery;
    if (q) params.set("q", q);
    router.push(`/dashboard/creators?${params.toString()}`);
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
            Creators em Alta
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.3,
            }}
          >
            {creators.length > 0
              ? `${creators.length} creators • Top vendedores${effectiveRankingCycle && effectiveRankingCycle !== requestedRankingCycle ? ` • dados ${rankingCycleLabel[effectiveRankingCycle]}` : ""}`
              : "Top criadores no TikTok Shop"}
          </Typography>
        </Box>
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={(r: TimeRange) => updateUrl({ range: r })}
          searchQuery={searchQuery}
          onSearchChange={(q: string) => updateUrl({ q })}
          onRefresh={() => mutate()}
          loading={isLoading || isValidating}
        />
        {/* Sort chips */}
        <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          {CREATOR_RANK_FIELDS.map((rf) => {
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
        <CreatorTable
          creators={creators}
          loading={isLoading}
          title="Top Creators"
        />
      </Box>
    </Box>
  );
}

export default function CreatorsPage() {
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
      <CreatorsContent />
    </Suspense>
  );
}
