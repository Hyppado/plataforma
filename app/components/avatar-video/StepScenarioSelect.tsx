"use client";

/**
 * app/components/avatar-video/StepScenarioSelect.tsx
 *
 * Step 3 of the avatar video wizard — scenario selection.
 *
 * The user can choose between:
 *   1. A predefined scenario from the DB gallery (Sala de estar, Cozinha, …)
 *   2. A custom free-text scenario description
 *
 * Continue is enabled only after a predefined scenario is chosen
 * OR a non-empty custom description is typed.
 *
 * On "Continuar":
 *   - Predefined mode: PATCHes { scenarioId, customScenarioDescription: null }
 *   - Custom mode: PATCHes { scenarioId: null, customScenarioDescription }
 *
 * Calls onContinue() after saving, or onBack() for navigation back.
 */

import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import {
  CheckCircle,
  InfoOutlined,
  ArrowForward,
  ArrowBack,
  Weekend,
  OutdoorGrill,
  Hotel,
  Store,
  Videocam,
  DirectionsCar,
  EditNote,
} from "@mui/icons-material";
import { useVideoScenarios } from "@/lib/swr/useVideoScenarios";
import type { CreationDTO, VideoScenarioDTO } from "@/lib/avatar-video/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "preset" | "custom";

interface Props {
  creation: CreationDTO;
  onContinue: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCENARIO_ICONS: Record<string, React.ElementType> = {
  "Sala de estar": Weekend,
  Cozinha: OutdoorGrill,
  Quarto: Hotel,
  Loja: Store,
  Estúdio: Videocam,
  Carro: DirectionsCar,
};

function scenarioIcon(name: string): React.ElementType {
  return SCENARIO_ICONS[name] ?? Videocam;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScenarioCard({
  scenario,
  selected,
  onSelect,
}: {
  scenario: VideoScenarioDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = scenarioIcon(scenario.name);

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        border: "2px solid",
        borderColor: selected ? "primary.main" : "rgba(255,255,255,0.08)",
        background: selected
          ? "rgba(45,212,255,0.06)"
          : "rgba(255,255,255,0.02)",
        transition: "border-color 0.15s, background 0.15s",
        position: "relative",
        "&:hover": {
          borderColor: selected ? "primary.main" : "rgba(45,212,255,0.3)",
          background: selected
            ? "rgba(45,212,255,0.08)"
            : "rgba(45,212,255,0.03)",
        },
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: selected
            ? "rgba(45,212,255,0.15)"
            : "rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon
          sx={{
            fontSize: 18,
            color: selected ? "primary.main" : "rgba(255,255,255,0.5)",
          }}
        />
      </Box>

      {/* Name */}
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: selected ? 600 : 400,
          color: selected ? "primary.main" : "rgba(255,255,255,0.75)",
          flex: 1,
        }}
      >
        {scenario.name}
      </Typography>

      {/* Checkmark */}
      {selected && (
        <CheckCircle
          sx={{ fontSize: 18, color: "primary.main", flexShrink: 0 }}
        />
      )}
    </Box>
  );
}

function ScenarioListSkeleton() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          height={56}
          sx={{ borderRadius: 2 }}
        />
      ))}
    </Box>
  );
}

function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.25,
        p: 1.5,
        borderRadius: 2,
        background: "rgba(45,212,255,0.06)",
        border: "1px solid rgba(45,212,255,0.15)",
      }}
    >
      <InfoOutlined
        sx={{ fontSize: 16, color: "primary.main", flexShrink: 0, mt: "1px" }}
      />
      <Typography
        sx={{
          fontSize: "0.75rem",
          color: "rgba(255,255,255,0.6)",
          lineHeight: 1.5,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StepScenarioSelect({ creation, onContinue, onBack }: Props) {
  const { scenarios, isLoading: loadingScenarios } = useVideoScenarios();

  // Initialise mode and state from creation
  const initialMode: Mode = creation.customScenarioDescription
    ? "custom"
    : "preset";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    creation.videoScenarioId ?? null,
  );
  const [customDescription, setCustomDescription] = useState<string>(
    creation.customScenarioDescription ?? "",
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleModeChange = (_: React.MouseEvent, next: Mode | null) => {
    if (next) setMode(next);
  };

  const handleSelectScenario = (id: string) => {
    setSelectedScenarioId(id);
    // Clear custom description to maintain mutual exclusivity
    setCustomDescription("");
    setSaveError(null);
  };

  const handleCustomDescriptionChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setCustomDescription(e.target.value);
    // Clear predefined selection
    setSelectedScenarioId(null);
    setSaveError(null);
  };

  const canContinue =
    !saving &&
    (mode === "preset"
      ? !!selectedScenarioId
      : customDescription.trim().length > 0);

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    setSaveError(null);

    try {
      const body =
        mode === "preset"
          ? { scenarioId: selectedScenarioId, customScenarioDescription: null }
          : {
              scenarioId: null,
              customScenarioDescription: customDescription.trim(),
            };

      const res = await fetch(`/api/avatar-video/creations/${creation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Erro ao salvar cenário");
      }

      onContinue();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Header */}
      <Box>
        <Typography
          component="h2"
          sx={{ fontSize: "1rem", fontWeight: 700, color: "#fff", mb: 0.25 }}
        >
          Escolha um cenário
        </Typography>
        <Typography
          sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}
        >
          Define o ambiente onde o avatar vai aparecer
        </Typography>
      </Box>

      {/* Mode toggle */}
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleModeChange}
        size="small"
        fullWidth
        sx={{
          "& .MuiToggleButton-root": {
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "none",
            color: "rgba(255,255,255,0.5)",
            borderColor: "rgba(255,255,255,0.12)",
            py: 0.75,
            "&.Mui-selected": {
              color: "primary.main",
              background: "rgba(45,212,255,0.08)",
              borderColor: "rgba(45,212,255,0.3)",
            },
          },
        }}
      >
        <ToggleButton value="preset">Cenários prontos</ToggleButton>
        <ToggleButton value="custom">Cenário personalizado</ToggleButton>
      </ToggleButtonGroup>

      {/* ── Preset mode ── */}
      {mode === "preset" && (
        <>
          {loadingScenarios ? (
            <ScenarioListSkeleton />
          ) : scenarios.length === 0 ? (
            <Box
              sx={{
                py: 4,
                textAlign: "center",
                color: "rgba(255,255,255,0.35)",
                fontSize: "0.8125rem",
              }}
            >
              Nenhum cenário disponível.
              <br />
              Use a opção{" "}
              <Box component="span" sx={{ color: "primary.main" }}>
                Cenário personalizado
              </Box>{" "}
              para descrever seu ambiente.
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {scenarios.map((s) => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  selected={selectedScenarioId === s.id}
                  onSelect={() => handleSelectScenario(s.id)}
                />
              ))}
            </Box>
          )}

          <InfoCallout>
            O cenário define o fundo e o ambiente do vídeo. O avatar e o produto
            aparecem em destaque sobre o ambiente escolhido.
          </InfoCallout>
        </>
      )}

      {/* ── Custom mode ── */}
      {mode === "custom" && (
        <>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 1.25,
              }}
            >
              <EditNote sx={{ fontSize: 18, color: "primary.main" }} />
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                Descreva o cenário
              </Typography>
            </Box>

            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              placeholder="Ex.: escritório moderno com paredes de vidro e vista para a cidade…"
              value={customDescription}
              onChange={handleCustomDescriptionChange}
              inputProps={{ maxLength: 300 }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "0.8125rem",
                  color: "rgba(255,255,255,0.85)",
                  background: "rgba(255,255,255,0.03)",
                  "& fieldset": {
                    borderColor: "rgba(255,255,255,0.12)",
                  },
                  "&:hover fieldset": {
                    borderColor: "rgba(45,212,255,0.3)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "primary.main",
                  },
                },
                "& .MuiInputBase-inputMultiline": {
                  resize: "none",
                },
              }}
            />

            <Typography
              sx={{
                mt: 0.75,
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.3)",
                textAlign: "right",
              }}
            >
              {customDescription.length}/300
            </Typography>
          </Box>

          <InfoCallout>
            Descreva o ambiente em detalhes: iluminação, cores, estilo e objetos
            presentes. Quanto mais específico, melhor o resultado.
          </InfoCallout>
        </>
      )}

      {/* Error */}
      {saveError && (
        <Box
          role="alert"
          sx={{
            p: 1.5,
            borderRadius: 2,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444",
            fontSize: "0.8125rem",
          }}
        >
          {saveError}
        </Box>
      )}

      {/* Actions */}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          pt: 0.5,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<ArrowBack />}
          onClick={onBack}
          disabled={saving}
          sx={{
            fontSize: "0.8125rem",
            borderColor: "rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.6)",
            "&:hover": {
              borderColor: "rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.04)",
            },
          }}
        >
          Voltar
        </Button>

        <Button
          variant="contained"
          size="small"
          endIcon={
            saving ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <ArrowForward />
            )
          }
          onClick={handleContinue}
          disabled={!canContinue}
          sx={{
            flex: 1,
            fontSize: "0.8125rem",
            fontWeight: 600,
            background: "linear-gradient(135deg, primary.main, #00B8E6)",
            bgcolor: "primary.main",
            "&:hover": { bgcolor: "primary.dark" },
            "&.Mui-disabled": {
              bgcolor: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.3)",
            },
          }}
        >
          {saving ? "Salvando…" : "Continuar"}
        </Button>
      </Box>
    </Box>
  );
}
