"use client";

import { useState, useTransition } from "react";
import {
  Alert,
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
import {
  type EchotikConfig,
  ECHOTIK_CONFIG_LIMITS,
} from "@/lib/types/echotik-admin";

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

/** Fixed Echotik API constraints — NOT configurable by admins. */
const API_FIXED_LIMITS = [
  {
    label: "Itens por página",
    value: 10,
    description: "page_size fixo — imposto pela API",
  },
  {
    label: "Máx. IDs por lote",
    value: 10,
    description: "batch de detalhes — imposto pela API",
  },
] as const;

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  unit,
  helperText,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
  helperText?: string;
}) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      fullWidth
      value={value}
      helperText={helperText}
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
      sx={{
        "& .MuiOutlinedInput-root": { background: "rgba(0,0,0,0.2)" },
        "& .MuiFormHelperText-root": {
          color: "rgba(255,255,255,0.35)",
          fontSize: "0.7rem",
          mt: 0.5,
        },
      }}
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
  // Only editable on production — on preview the cron is disabled, so changes
  // would have no effect and could cause confusion.
  const isEditable = process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview";

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
              disabled={!draft || !isEditable}
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
          {!isEditable && (
            <Alert
              severity="info"
              sx={{
                mb: 2,
                background: "rgba(45, 212, 255, 0.08)",
                border: "1px solid rgba(45, 212, 255, 0.2)",
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.8rem",
                "& .MuiAlert-icon": { color: "primary.main" },
              }}
            >
              Configurações desabilitadas em ambiente de preview — o cron roda
              apenas em produção.
            </Alert>
          )}

          {/* API Limits — read-only, imposed by Echotik */}
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 2,
              background: "rgba(255, 193, 7, 0.05)",
              border: "1px solid rgba(255, 193, 7, 0.15)",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255, 193, 7, 0.7)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "block",
                mb: 1,
              }}
            >
              Limites impostos pela API Echotik (não configuráveis)
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {API_FIXED_LIMITS.map(({ label, value, description }) => (
                <Tooltip key={label} title={description}>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      px: 1.25,
                      py: 0.4,
                      borderRadius: 1.5,
                      background: "rgba(255, 193, 7, 0.08)",
                      border: "1px solid rgba(255, 193, 7, 0.2)",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: "0.72rem",
                      }}
                    >
                      {label}:
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(255, 193, 7, 0.9)",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                      }}
                    >
                      {value}
                    </Typography>
                  </Box>
                </Tooltip>
              ))}
            </Stack>
          </Box>
          <Stack
            spacing={3}
            sx={{
              opacity: isEditable ? 1 : 0.5,
              pointerEvents: isEditable ? "auto" : "none",
            }}
          >
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
                (mín. {ECHOTIK_CONFIG_LIMITS.interval.min}h, máx.{" "}
                {ECHOTIK_CONFIG_LIMITS.interval.max}h = 7 dias)
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {INTERVAL_TASK_KEYS.map((task) => (
                  <Grid item xs={6} sm={4} key={task}>
                    <NumberField
                      label={TASK_LABELS[task]}
                      value={current.intervals[task]}
                      min={ECHOTIK_CONFIG_LIMITS.interval.min}
                      max={ECHOTIK_CONFIG_LIMITS.interval.max}
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
                Quantas páginas buscar por entidade em cada ciclo (1 pág. = 10
                itens, fixo pela API).
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
                      min={ECHOTIK_CONFIG_LIMITS.pages.min}
                      max={ECHOTIK_CONFIG_LIMITS.pages.max}
                      unit="pgs"
                      helperText={`= ${current.pages[key] * 10} itens`}
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
                Lote: quantos IDs enviar por chamada. Idade: dias antes de
                re-buscar detalhes de um produto já processado.
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <NumberField
                    label="Itens por lote"
                    value={current.detail.batchSize}
                    min={ECHOTIK_CONFIG_LIMITS.detailBatchSize.min}
                    max={ECHOTIK_CONFIG_LIMITS.detailBatchSize.max}
                    onChange={(v) => updateDetail("batchSize", v)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <NumberField
                    label="Max idade"
                    value={current.detail.maxAgeDays}
                    min={ECHOTIK_CONFIG_LIMITS.detailMaxAgeDays.min}
                    max={ECHOTIK_CONFIG_LIMITS.detailMaxAgeDays.max}
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
