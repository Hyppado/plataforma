"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { PublicOutlined } from "@mui/icons-material";
import { REGION_FLAGS } from "@/lib/region";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

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
      <Grid item xs={12}>
        <Card sx={cardStyle}>
          <CardContent>
            <Skeleton
              variant="rectangular"
              height={160}
              sx={{ borderRadius: 2 }}
            />
          </CardContent>
        </Card>
      </Grid>
    );
  }

  const activeCount = regions.filter((r) => r.isActive).length;
  const inactiveCount = regions.length - activeCount;

  async function handleToggle(code: string, current: boolean) {
    setToggling(code);
    try {
      await onToggle(code, !current);
    } finally {
      setToggling(null);
    }
  }

  return (
    <Grid item xs={12}>
      <Card sx={cardStyle}>
        <CardHeader
          avatar={<PublicOutlined sx={{ color: "#2DD4FF" }} />}
          title="Regiões"
          subheader={`${activeCount} ativas de ${regions.length} disponíveis — a ingestão coleta dados apenas das regiões ativas`}
          titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          subheaderTypographyProps={{ fontSize: "0.8rem" }}
        />
        <CardContent>
          <Stack spacing={2}>
            {/* Summary chips */}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label={`${activeCount} ativas`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                label={`${inactiveCount} inativas`}
                size="small"
                color="default"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Stack>

            {/* Region grid */}
            <Grid container spacing={1}>
              {regions.map((region) => {
                const flag = REGION_FLAGS[region.code] ?? "🌐";
                const isToggling = toggling === region.code;

                return (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={region.code}>
                    <Tooltip
                      title={
                        region.isActive
                          ? `Clique para desativar ${region.name}`
                          : `Clique para ativar ${region.name}`
                      }
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: region.isActive
                            ? "rgba(45, 212, 255, 0.06)"
                            : "rgba(255,255,255,0.02)",
                          border: `1px solid ${region.isActive ? "rgba(45, 212, 255, 0.15)" : "rgba(255,255,255,0.06)"}`,
                          borderRadius: 2,
                          px: 1.5,
                          py: 0.5,
                          opacity: isToggling ? 0.5 : 1,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <Typography sx={{ fontSize: "1rem" }}>
                            {flag}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: region.isActive
                                ? "#fff"
                                : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {region.code}
                          </Typography>
                        </Stack>
                        <Switch
                          size="small"
                          checked={region.isActive}
                          disabled={isToggling}
                          onChange={() =>
                            handleToggle(region.code, region.isActive)
                          }
                          sx={{
                            "& .MuiSwitch-switchBase.Mui-checked": {
                              color: "#2DD4FF",
                            },
                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                              {
                                backgroundColor: "#2DD4FF",
                              },
                          }}
                        />
                      </Box>
                    </Tooltip>
                  </Grid>
                );
              })}
            </Grid>

            {/* Help text */}
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.4)" }}
            >
              Ativar ou desativar uma região afeta diretamente a ingestão de
              dados e a estimativa de requisições. Regiões inativas não são
              coletadas pelo cron.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}
