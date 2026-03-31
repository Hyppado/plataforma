"use client";

import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlined,
  ErrorOutline,
  HourglassBottomOutlined,
  RemoveCircleOutline,
  WarningAmberOutlined,
} from "@mui/icons-material";
import type {
  EchotikHealthResponse,
  HealthStatus,
} from "@/lib/types/echotik-admin";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

const STATUS_META: Record<
  HealthStatus,
  {
    label: string;
    color: "success" | "warning" | "error" | "default";
    Icon: React.ElementType;
  }
> = {
  healthy: { label: "Saudável", color: "success", Icon: CheckCircleOutlined },
  stale: {
    label: "Desatualizado",
    color: "warning",
    Icon: HourglassBottomOutlined,
  },
  failing: { label: "Falha", color: "error", Icon: ErrorOutline },
  never_run: {
    label: "Nunca executou",
    color: "default",
    Icon: RemoveCircleOutline,
  },
  inactive: { label: "Inativo", color: "default", Icon: RemoveCircleOutline },
};

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box
      sx={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 2,
        p: 2,
        textAlign: "center",
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 700, color }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
        {label}
      </Typography>
    </Box>
  );
}

interface HealthSectionProps {
  data: EchotikHealthResponse | undefined;
  loading: boolean;
}

export function HealthSection({ data, loading }: HealthSectionProps) {
  if (loading) {
    return (
      <Grid item xs={12}>
        <Card sx={cardStyle}>
          <CardContent>
            <Skeleton
              variant="rectangular"
              height={200}
              sx={{ borderRadius: 2 }}
            />
          </CardContent>
        </Card>
      </Grid>
    );
  }

  if (!data) return null;

  const { summary, tasks } = data;

  // Group tasks by their task name for display
  const TASK_DISPLAY: Record<string, string> = {
    categories: "Categorias",
    videos: "Vídeos",
    products: "Produtos",
    creators: "Criadores",
    details: "Detalhes",
  };

  const taskGroups = tasks.reduce<Record<string, typeof tasks>>((acc, t) => {
    (acc[t.task] ??= []).push(t);
    return acc;
  }, {});

  return (
    <Grid item xs={12}>
      <Card sx={cardStyle}>
        <CardHeader
          avatar={<CheckCircleOutlined sx={{ color: "#2DD4FF" }} />}
          title="Saúde da Ingestão"
          subheader="Status das tarefas e regiões"
          titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          subheaderTypographyProps={{ fontSize: "0.8rem" }}
        />
        <CardContent>
          {/* Summary row */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4} md={2}>
              <SummaryCard
                label="Total"
                value={summary.totalCombinations}
                color="#fff"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <SummaryCard
                label="Saudável"
                value={summary.healthy}
                color="#4CAF50"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <SummaryCard
                label="Desatualizado"
                value={summary.stale}
                color="#FF9800"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <SummaryCard
                label="Falha"
                value={summary.failing}
                color="#F44336"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <SummaryCard
                label="Nunca rodou"
                value={summary.neverRun}
                color="rgba(255,255,255,0.4)"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <SummaryCard
                label="Inativo"
                value={summary.inactive}
                color="rgba(255,255,255,0.2)"
              />
            </Grid>
          </Grid>

          {/* Per-task breakdown */}
          <Stack spacing={2}>
            {Object.entries(taskGroups).map(([task, entries]) => (
              <Box key={task}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    mb: 1,
                    display: "block",
                  }}
                >
                  {TASK_DISPLAY[task] ?? task}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {entries.map((t) => {
                    const meta = STATUS_META[t.status];
                    const tooltipLines = [
                      t.region ? `Região: ${t.region}` : "Global",
                      t.lastSuccessAt
                        ? `Último sucesso: ${new Date(t.lastSuccessAt).toLocaleString("pt-BR")}`
                        : "Sem sucesso registrado",
                      t.hoursSinceSuccess != null
                        ? `${Math.round(t.hoursSinceSuccess)}h atrás`
                        : "",
                      t.stalenessRatio != null
                        ? `Atraso: ${(t.stalenessRatio * 100).toFixed(0)}%`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <Tooltip
                        key={`${t.task}:${t.region ?? "global"}`}
                        title={tooltipLines}
                      >
                        <Chip
                          icon={<meta.Icon fontSize="small" />}
                          label={t.region ?? "global"}
                          color={meta.color}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}
