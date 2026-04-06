"use client";

import { Box, Grid, Typography } from "@mui/material";
import useSWR from "swr";
import { fetcher } from "@/lib/swr/fetcher";
import type {
  EchotikConfig,
  EchotikHealthResponse,
  EstimationResult,
} from "@/lib/types/echotik-admin";
import { RegionSection, type RegionData } from "./RegionSection";
import { HealthSection } from "./HealthSection";
import { ConfigSection } from "./ConfigSection";
import { EstimationSection } from "./EstimationSection";

export function EchotikTab() {
  // -----------------------------------------------------------------------
  // Data
  // -----------------------------------------------------------------------
  const healthSWR = useSWR<EchotikHealthResponse>(
    "/api/admin/echotik/health",
    fetcher,
    { refreshInterval: 60_000 },
  );
  const configSWR = useSWR<{ config: EchotikConfig }>(
    "/api/admin/echotik/config",
    fetcher,
  );
  const estimateSWR = useSWR<EstimationResult>(
    "/api/admin/echotik/estimate",
    fetcher,
  );
  const regionsSWR = useSWR<{ regions: RegionData[] }>(
    "/api/admin/echotik/regions",
    fetcher,
  );

  // -----------------------------------------------------------------------
  // Callbacks
  // -----------------------------------------------------------------------

  async function handleSaveConfig(patch: Record<string, unknown>) {
    await fetch("/api/admin/echotik/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await Promise.all([configSWR.mutate(), estimateSWR.mutate()]);
  }

  async function handleToggleRegion(code: string, isActive: boolean) {
    await fetch("/api/admin/echotik/regions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, isActive }),
    });
    await Promise.all([
      regionsSWR.mutate(),
      healthSWR.mutate(),
      estimateSWR.mutate(),
    ]);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Box>
      {/* Header */}
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ mb: 2, color: "text.primary" }}
      >
        Echotik — Regiões disponíveis
      </Typography>

      {/* Compact region selector — not wrapped in Grid */}
      <RegionSection
        regions={regionsSWR.data?.regions}
        loading={regionsSWR.isLoading}
        onToggle={handleToggleRegion}
      />

      {/* Operational summary + Config + Estimation in a single Grid */}
      <Grid container spacing={3}>
        <HealthSection data={healthSWR.data} loading={healthSWR.isLoading} />

        {/* Config + Estimation — each renders its own Grid item md={6} */}
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
