"use client";

import { useState, useTransition } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Check as CheckIcon,
  Save as SaveIcon,
  SettingsOutlined,
} from "@mui/icons-material";
import type { EchotikConfig } from "@/lib/types/echotik-admin";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

const TASK_LABELS: Record<string, string> = {
  categories: "Categorias",
  videos: "Vídeos",
  products: "Produtos",
  creators: "Criadores",
  details: "Detalhes",
};

// Only these 4 tasks have configurable intervals (details runs on every tick)
const INTERVAL_TASK_KEYS: Array<keyof EchotikConfig["intervals"]> = [
  "categories",
  "videos",
  "products",
  "creators",
];

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      fullWidth
      value={value}
      inputProps={{ min, max, step: 1 }}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v) && v >= min && v <= max) onChange(v);
      }}
      InputProps={
        unit
          ? {
              endAdornment: (
                <InputAdornment position="end">{unit}</InputAdornment>
              ),
            }
          : undefined
      }
      sx={{ "& .MuiOutlinedInput-root": { background: "rgba(0,0,0,0.2)" } }}
    />
  );
}

interface ConfigSectionProps {
  config: EchotikConfig | undefined;
  loading: boolean;
  /** Called with flat patch format: { intervalCategories?, pagesVideos?, tasksEnabled?, ... } */
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}

/** Converts nested EchotikConfig to flat patch format expected by the API */
function toFlatPatch(draft: EchotikConfig): Record<string, unknown> {
  return {
    intervalCategories: draft.intervals.categories,
    intervalVideos: draft.intervals.videos,
    intervalProducts: draft.intervals.products,
    intervalCreators: draft.intervals.creators,
    pagesVideos: draft.pages.videos,
    pagesProducts: draft.pages.products,
    pagesCreators: draft.pages.creators,
    detailBatchSize: draft.detail.batchSize,
    detailMaxAgeDays: draft.detail.maxAgeDays,
    tasksEnabled: draft.enabledTasks.join(","),
  };
}

export function ConfigSection({ config, loading, onSave }: ConfigSectionProps) {
  const [draft, setDraft] = useState<EchotikConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  // Use draft if editing, otherwise show saved config
  const current = draft ?? config;

  function update(patch: Partial<EchotikConfig>) {
    setSaved(false);
    setDraft((prev) => {
      const base = prev ?? config!;
      return { ...base, ...patch };
    });
  }

  function updateIntervals(
    key: keyof EchotikConfig["intervals"],
    value: number,
  ) {
    update({
      intervals: { ...(current?.intervals ?? config!.intervals), [key]: value },
    });
  }

  function updatePages(key: keyof EchotikConfig["pages"], value: number) {
    update({ pages: { ...(current?.pages ?? config!.pages), [key]: value } });
  }

  function updateDetail(key: keyof EchotikConfig["detail"], value: number) {
    update({
      detail: { ...(current?.detail ?? config!.detail), [key]: value },
    });
  }

  function toggleTask(task: string) {
    if (!current) return;
    const enabled = current.enabledTasks.includes(task)
      ? current.enabledTasks.filter((t) => t !== task)
      : [...current.enabledTasks, task];
    update({ enabledTasks: enabled });
  }

  async function handleSave() {
    if (!draft) return;
    await onSave(toFlatPatch(draft));
    setSaved(true);
    startTransition(() => {
      setTimeout(() => setSaved(false), 2500);
    });
  }

  if (loading || !current) {
    return (
      <Grid item xs={12} md={6}>
        <Card sx={cardStyle}>
          <CardContent>
            <Skeleton
              variant="rectangular"
              height={300}
              sx={{ borderRadius: 2 }}
            />
          </CardContent>
        </Card>
      </Grid>
    );
  }

  return (
    <Grid item xs={12} md={6}>
      <Card sx={cardStyle}>
        <CardHeader
          avatar={<SettingsOutlined sx={{ color: "#2DD4FF" }} />}
          title="Configuração do Cron"
          subheader="Intervalos, páginas e tarefas habilitadas"
          titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          subheaderTypographyProps={{ fontSize: "0.8rem" }}
          action={
            <Button
              variant="contained"
              size="small"
              disabled={!draft}
              startIcon={saved ? <CheckIcon /> : <SaveIcon />}
              onClick={handleSave}
              sx={{
                background: saved
                  ? "rgba(76, 175, 80, 0.2)"
                  : "linear-gradient(135deg, #2DD4FF, #7B61FF)",
                color: saved ? "#81C784" : "#fff",
                fontWeight: 600,
                minWidth: 80,
              }}
            >
              {saved ? "Salvo" : "Salvar"}
            </Button>
          }
        />
        <CardContent>
          <Stack spacing={3}>
            {/* Intervalos */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Intervalos
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.35)",
                  display: "block",
                  mb: 0.5,
                }}
              >
                De quantas em quantas horas cada tipo de dado é re-coletado
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {INTERVAL_TASK_KEYS.map((task) => (
                  <Grid item xs={6} sm={4} key={task}>
                    <NumberField
                      label={TASK_LABELS[task]}
                      value={current.intervals[task]}
                      min={1}
                      max={168}
                      unit="h"
                      onChange={(v) => updateIntervals(task, v)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

            {/* Páginas */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Páginas por entidade
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.35)",
                  display: "block",
                  mb: 0.5,
                }}
              >
                Quantas páginas são buscadas na API por vez (cada página = 10
                itens)
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {(
                  ["videos", "products", "creators"] as Array<
                    keyof EchotikConfig["pages"]
                  >
                ).map((key) => (
                  <Grid item xs={4} key={key}>
                    <NumberField
                      label={TASK_LABELS[key]}
                      value={current.pages[key]}
                      min={1}
                      max={50}
                      unit="pgs"
                      onChange={(v) => updatePages(key, v)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

            {/* Detalhes */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Enriquecimento de detalhes
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.35)",
                  display: "block",
                  mb: 0.5,
                }}
              >
                Busca dados extras de cada produto. Lote = quantos por vez;
                Idade máx. = quando re-buscar
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <NumberField
                    label="Itens por lote"
                    value={current.detail.batchSize}
                    min={1}
                    max={100}
                    onChange={(v) => updateDetail("batchSize", v)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <NumberField
                    label="Max idade"
                    value={current.detail.maxAgeDays}
                    min={1}
                    max={90}
                    unit="dias"
                    onChange={(v) => updateDetail("maxAgeDays", v)}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

            {/* Tarefas habilitadas */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Tarefas habilitadas
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                {Object.entries(TASK_LABELS).map(([task, label]) => (
                  <Tooltip
                    key={task}
                    title={`${current.enabledTasks.includes(task) ? "Desabilitar" : "Habilitar"}: ${label}`}
                  >
                    <Chip
                      label={label}
                      clickable
                      color={
                        current.enabledTasks.includes(task)
                          ? "primary"
                          : "default"
                      }
                      variant={
                        current.enabledTasks.includes(task)
                          ? "filled"
                          : "outlined"
                      }
                      onClick={() => toggleTask(task)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}
