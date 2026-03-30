"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { Box, Grid, LinearProgress, Typography } from "@mui/material";
import { HealthSection } from "./HealthSection";
import { ConfigSection } from "./ConfigSection";
import { EstimationSection } from "./EstimationSection";
import type {
  EchotikConfig,
  EchotikHealthResponse,
  EstimationResult,
} from "@/lib/types/echotik-admin";

interface ConfigResponse {
  config: EchotikConfig;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function EchotikTab() {
  const health = useSWR<EchotikHealthResponse>(
    "/api/admin/echotik/health",
    fetcher,
    {
      refreshInterval: 60_000,
    },
  );

  const configSWR = useSWR<ConfigResponse>(
    "/api/admin/echotik/config",
    fetcher,
  );

  // estimate endpoint returns EstimationResult directly (no wrapper)
  const estimateSWR = useSWR<EstimationResult>(
    "/api/admin/echotik/estimate",
    fetcher,
  );

  const isLoading =
    health.isLoading || configSWR.isLoading || estimateSWR.isLoading;

  const handleSaveConfig = useCallback(
    async (patch: Record<string, unknown>) => {
      const res = await fetch("/api/admin/echotik/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erro ao salvar configuração");
      }
      // Revalidate config and estimation after save
      await Promise.all([configSWR.mutate(), estimateSWR.mutate()]);
    },
    [configSWR, estimateSWR],
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: "#fff", mb: 0.5 }}
        >
          Echotik — Ingestão
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
          Visibilidade operacional, configuração dinâmica e estimativa de
          consumo da API.
        </Typography>
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        <HealthSection data={health.data} loading={health.isLoading} />
        <ConfigSection
          config={configSWR.data?.config}
          loading={configSWR.isLoading}
          onSave={handleSaveConfig}
        />
        <EstimationSection
          data={estimateSWR.data}
          loading={estimateSWR.isLoading}
        />
      </Grid>
    </Box>
  );
}
