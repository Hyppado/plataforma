"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Chip, Stack } from "@mui/material";
import { CreatorTable } from "@/app/components/dashboard/DataTable";
import { DashboardHeader } from "@/app/components/dashboard/DashboardHeader";
import type { CreatorDTO } from "@/lib/types/dto";
import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";

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
  const regionFilter = (searchParams.get("region") || "US").toUpperCase();

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
    [timeRange, searchQuery, regionFilter],
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
