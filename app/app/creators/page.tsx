"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { CreatorTable } from "@/app/components/dashboard/DataTable";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import type { CreatorDTO } from "@/lib/types/dto";
import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";

import { getStoredRegion } from "@/lib/region";
import { CREATOR_RANK_FIELDS } from "@/lib/echotik/rankFields";

function CreatorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creators, setCreators] = useState<CreatorDTO[]>([]);
  const [allCreators, setAllCreators] = useState<CreatorDTO[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>(["US"]);
  const [effectiveRankingCycle, setEffectiveRankingCycle] = useState<
    1 | 2 | 3 | null
  >(null);

  const timeRange = normalizeRange(searchParams.get("range"));
  const searchQuery = searchParams.get("q") || "";
  const regionFilter = (
    searchParams.get("region") || getStoredRegion()
  ).toUpperCase();
  const sort = searchParams.get("sort") || "sales";

  const requestedRankingCycle: 1 | 2 | 3 =
    timeRange === "1d" ? 1 : timeRange === "7d" ? 2 : 3;
  const rankingCycleLabel: Record<1 | 2 | 3, string> = {
    1: "di\u00e1rio",
    2: "semanal",
    3: "mensal",
  };

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          range: timeRange,
          limit: "50",
          region: regionFilter,
          sort,
        });
        if (searchQuery) params.set("search", searchQuery);
        const res = await fetch(`/api/trending/creators?${params}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const items: CreatorDTO[] = json?.data?.items ?? [];
        setAllCreators(items);
        setCreators(items);
        setEffectiveRankingCycle(
          (json?.data?.effectiveRankingCycle as 1 | 2 | 3 | undefined) ?? null,
        );
        if (json?.data?.availableRegions?.length > 0) {
          setAvailableRegions(json.data.availableRegions);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch creators:", err);
        setError("Erro ao carregar creators. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [timeRange, searchQuery, regionFilter, sort],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const updateUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("range", overrides.range ?? timeRange);
    params.set("region", overrides.region ?? regionFilter);
    params.set("sort", overrides.sort ?? sort);
    const q = overrides.q ?? searchQuery;
    if (q) params.set("q", q);
    router.push(`/app/creators?${params.toString()}`);
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
            {allCreators.length > 0
              ? `${creators.length} creators \u2022 Top vendedores${effectiveRankingCycle && effectiveRankingCycle !== requestedRankingCycle ? ` \u2022 dados ${rankingCycleLabel[effectiveRankingCycle]}` : ""}`
              : "Top criadores no TikTok Shop"}
          </Typography>
        </Box>
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={(r: TimeRange) => updateUrl({ range: r })}
          searchQuery={searchQuery}
          onSearchChange={(q: string) => updateUrl({ q })}
          onRefresh={() => fetchData()}
          loading={loading}
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
          loading={loading}
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
