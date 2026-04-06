"use client";

import { useState } from "react";
import {
  Box,
  Chip,
  Skeleton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { REGION_FLAGS } from "@/lib/region";

export interface RegionData {
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface RegionSectionProps {
  regions: RegionData[] | undefined;
  loading: boolean;
  onToggle: (code: string, isActive: boolean) => Promise<void>;
}

export function RegionSection({
  regions,
  loading,
  onToggle,
}: RegionSectionProps) {
  const [toggling, setToggling] = useState<string | null>(null);

  if (loading || !regions) {
    return (
      <Box sx={{ mb: 2 }}>
        <Skeleton variant="rounded" height={36} width={300} />
      </Box>
    );
  }

  const activeCount = regions.filter((r) => r.isActive).length;

  async function handleToggle(code: string, current: boolean) {
    setToggling(code);
    try {
      await onToggle(code, !current);
    } finally {
      setToggling(null);
    }
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.5)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Regiões ativas
        </Typography>
        <Chip
          label={`${activeCount} / ${regions.length}`}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.7rem",
            fontWeight: 700,
            background: "rgba(45, 212, 255, 0.12)",
            color: "#2DD4FF",
          }}
        />
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={0.75}>
        {regions.map((region) => {
          const flag = REGION_FLAGS[region.code] ?? "🌐";
          const isToggling = toggling === region.code;

          return (
            <Tooltip
              key={region.code}
              title={`${region.name} — ${region.isActive ? "Desativar" : "Ativar"}`}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: 1.5,
                  background: region.isActive
                    ? "rgba(45, 212, 255, 0.06)"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${region.isActive ? "rgba(45, 212, 255, 0.15)" : "rgba(255,255,255,0.06)"}`,
                  opacity: isToggling ? 0.5 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                <Typography sx={{ fontSize: "0.85rem", lineHeight: 1 }}>
                  {flag}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: region.isActive ? "#fff" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {region.code}
                </Typography>
                <Switch
                  size="small"
                  checked={region.isActive}
                  disabled={isToggling}
                  onChange={() => handleToggle(region.code, region.isActive)}
                  sx={{
                    width: 32,
                    height: 18,
                    p: 0,
                    "& .MuiSwitch-switchBase": { p: "2px" },
                    "& .MuiSwitch-thumb": { width: 14, height: 14 },
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#2DD4FF",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#2DD4FF",
                    },
                  }}
                />
              </Box>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
