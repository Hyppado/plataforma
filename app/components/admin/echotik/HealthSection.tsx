"use client";

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlined,
  ErrorOutline,
  HourglassBottomOutlined,
  RemoveCircleOutline,
} from "@mui/icons-material";
import type {
  EchotikHealthResponse,
  HealthStatus,
  TaskRegionHealth,
} from "@/lib/types/echotik-admin";
import { REGION_FLAGS } from "@/lib/region";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

const cellSx = {
  color: "rgba(255,255,255,0.6)",
  borderColor: "rgba(255,255,255,0.06)",
  py: 1,
  fontSize: "0.8rem",
};

const headerCellSx = {
  ...cellSx,
  color: "rgba(255,255,255,0.4)",
  fontWeight: 600,
  fontSize: "0.7rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_META: Record<
  HealthStatus,
  {
    label: string;
    color: "success" | "warning" | "error" | "default";
    Icon: React.ElementType;
  }
> = {
  healthy: { label: "OK", color: "success", Icon: CheckCircleOutlined },
  stale: {
    label: "Desatualizado",
    color: "warning",
    Icon: HourglassBottomOutlined,
  },
  failing: { label: "Falha", color: "error", Icon: ErrorOutline },
  never_run: {
    label: "Nunca rodou",
    color: "default",
    Icon: RemoveCircleOutline,
  },
  inactive: { label: "Inativo", color: "default", Icon: RemoveCircleOutline },
};

function StatusBadge({ status }: { status: HealthStatus }) {
  const meta = STATUS_META[status];
  return (
    <Chip
      icon={<meta.Icon sx={{ fontSize: 14 }} />}
      label={meta.label}
      color={meta.color}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 600, height: 22, fontSize: "0.7rem" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

interface RegionRow {
  code: string;
  name: string;
  worstStatus: HealthStatus;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  totalItems: number;
  taskBreakdown: {
    task: string;
    status: HealthStatus;
    lastSuccessAt: string | null;
    items: number | null;
  }[];
}

const TASK_LABELS: Record<string, string> = {
  categories: "Categorias",
  videos: "Vídeos",
  products: "Produtos",
  creators: "Criadores",
  "new-products": "Novos Produtos",
};

const STATUS_PRIORITY: Record<HealthStatus, number> = {
  failing: 0,
  stale: 1,
  never_run: 2,
  healthy: 3,
  inactive: 4,
};

function aggregateByRegion(tasks: TaskRegionHealth[]): RegionRow[] {
  const activeTasks = tasks.filter(
    (t) => t.isRegionActive && t.isTaskEnabled && t.region,
  );

  const groups: Record<string, TaskRegionHealth[]> = {};
  for (const t of activeTasks) {
    const key = t.region!;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  // Also include categories (region-agnostic) data
  const catTask = tasks.find(
    (t: TaskRegionHealth) => t.task === "categories" && t.isTaskEnabled,
  );
  const newProductsTask = tasks.find(
    (t: TaskRegionHealth) => t.task === "new-products" && t.isTaskEnabled,
  );

  const rows: RegionRow[] = [];
  for (const code of Object.keys(groups)) {
    const regionTasks = groups[code];
    const firstTask = regionTasks[0];
    const allSuccesses = regionTasks
      .map((t: TaskRegionHealth) => t.lastSuccessAt)
      .filter(Boolean) as string[];
    const allFailures = regionTasks
      .map((t: TaskRegionHealth) => t.lastFailureAt)
      .filter(Boolean) as string[];

    const latestSuccess =
      allSuccesses.length > 0 ? allSuccesses.sort().reverse()[0] : null;
    const latestFailure =
      allFailures.length > 0 ? allFailures.sort().reverse()[0] : null;

    const totalItems = regionTasks.reduce(
      (s: number, t: TaskRegionHealth) => s + (t.lastItemsProcessed ?? 0),
      0,
    );

    // Worst status across all tasks for that region
    const worstStatus = regionTasks
      .map((t: TaskRegionHealth) => t.status)
      .sort(
        (a: HealthStatus, b: HealthStatus) =>
          STATUS_PRIORITY[a] - STATUS_PRIORITY[b],
      )[0];

    const breakdown = regionTasks.map((t: TaskRegionHealth) => ({
      task: t.task,
      status: t.status,
      lastSuccessAt: t.lastSuccessAt,
      items: t.lastItemsProcessed,
    }));

    rows.push({
      code,
      name: firstTask.regionName ?? code,
      worstStatus,
      lastSuccessAt: latestSuccess,
      lastFailureAt: latestFailure,
      totalItems,
      taskBreakdown: breakdown,
    });
  }

  // If categories exists, prepend it as a special row
  if (catTask) {
    rows.unshift({
      code: "—",
      name: "Categorias (global)",
      worstStatus: catTask.status,
      lastSuccessAt: catTask.lastSuccessAt,
      lastFailureAt: catTask.lastFailureAt,
      totalItems: catTask.lastItemsProcessed ?? 0,
      taskBreakdown: [
        {
          task: "categories",
          status: catTask.status,
          lastSuccessAt: catTask.lastSuccessAt,
          items: catTask.lastItemsProcessed,
        },
      ],
    });
  }

  // If new-products exists, prepend after categories
  if (newProductsTask) {
    const insertIdx = catTask ? 1 : 0;
    rows.splice(insertIdx, 0, {
      code: "—",
      name: "Novos Produtos (global)",
      worstStatus: newProductsTask.status,
      lastSuccessAt: newProductsTask.lastSuccessAt,
      lastFailureAt: newProductsTask.lastFailureAt,
      totalItems: newProductsTask.lastItemsProcessed ?? 0,
      taskBreakdown: [
        {
          task: "new-products",
          status: newProductsTask.status,
          lastSuccessAt: newProductsTask.lastSuccessAt,
          items: newProductsTask.lastItemsProcessed,
        },
      ],
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
              height={180}
              sx={{ borderRadius: 2 }}
            />
          </CardContent>
        </Card>
      </Grid>
    );
  }

  if (!data) return null;

  const { summary } = data;
  const regionRows = aggregateByRegion(data.tasks);

  return (
    <Grid item xs={12}>
      <Card sx={cardStyle}>
        <CardHeader
          avatar={<CheckCircleOutlined sx={{ color: "primary.main" }} />}
          title="Visão Operacional"
          subheader={
            <Box
              component="span"
              sx={{ display: "inline-flex", gap: 1.5, alignItems: "center" }}
            >
              <span>
                {summary.healthy} OK · {summary.stale} desatualizados ·{" "}
                {summary.failing} falhas · {summary.neverRun} nunca rodaram
              </span>
            </Box>
          }
          titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          subheaderTypographyProps={{ fontSize: "0.75rem" }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={headerCellSx}>Região</TableCell>
                <TableCell sx={headerCellSx}>Status</TableCell>
                <TableCell sx={headerCellSx}>Tarefas</TableCell>
                <TableCell sx={headerCellSx}>Última atualização</TableCell>
                <TableCell sx={headerCellSx}>Última falha</TableCell>
                <TableCell sx={headerCellSx} align="right">
                  Itens coletados
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {regionRows.map((row) => {
                const flag = REGION_FLAGS[row.code] ?? "";
                return (
                  <TableRow key={row.code} hover>
                    <TableCell
                      sx={{ ...cellSx, color: "#fff", fontWeight: 600 }}
                    >
                      {flag && (
                        <Box
                          component="span"
                          sx={{ mr: 0.5, fontSize: "0.9rem" }}
                        >
                          {flag}
                        </Box>
                      )}
                      {row.code === "—" ? row.name : row.code}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <StatusBadge status={row.worstStatus} />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          flexWrap: "wrap",
                        }}
                      >
                        {row.taskBreakdown.map((tb) => {
                          const meta = STATUS_META[tb.status];
                          return (
                            <Tooltip
                              key={tb.task}
                              title={`${TASK_LABELS[tb.task] ?? tb.task}: ${meta.label}${tb.lastSuccessAt ? ` · ${formatRelative(tb.lastSuccessAt)}` : ""}${tb.items != null ? ` · ${tb.items} itens` : ""}`}
                            >
                              <Chip
                                label={TASK_LABELS[tb.task] ?? tb.task}
                                size="small"
                                color={meta.color}
                                variant="outlined"
                                sx={{
                                  height: 18,
                                  fontSize: "0.65rem",
                                  fontWeight: 600,
                                  "& .MuiChip-label": { px: 0.75 },
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Tooltip title={row.lastSuccessAt ?? ""}>
                        <Box component="span">
                          {formatDatetime(row.lastSuccessAt)}
                          {row.lastSuccessAt && (
                            <Typography
                              component="span"
                              sx={{
                                fontSize: "0.65rem",
                                color: "rgba(255,255,255,0.35)",
                                ml: 0.5,
                              }}
                            >
                              {formatRelative(row.lastSuccessAt)}
                            </Typography>
                          )}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {row.lastFailureAt ? (
                        <Typography
                          component="span"
                          sx={{
                            color: "rgba(244,67,54,0.8)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {formatDatetime(row.lastFailureAt)}
                        </Typography>
                      ) : (
                        <Typography
                          component="span"
                          sx={{
                            color: "rgba(255,255,255,0.25)",
                            fontSize: "0.8rem",
                          }}
                        >
                          Nunca falhou
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: 600,
                          color:
                            row.totalItems > 0
                              ? "primary.main"
                              : "rgba(255,255,255,0.3)",
                        }}
                      >
                        {row.totalItems > 0
                          ? row.totalItems.toLocaleString("pt-BR")
                          : "—"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
              {regionRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ ...cellSx, textAlign: "center" }}
                  >
                    Nenhuma região ativa com dados de ingestão
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Grid>
  );
}
