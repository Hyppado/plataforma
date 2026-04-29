"use client";

/**
 * app/components/avatar-video/StepConceptEdit.tsx
 *
 * Step 5 of the avatar video wizard — AI-generated video concept review and editing.
 *
 * Section A of Task 3.6: AI-generated concept.
 *
 * Flow:
 *   1. If status is IMAGES_READY (no concept yet): user clicks "Generate concept"
 *   2. POST /generate-concept — synchronous, returns updated creation with concept
 *   3. Editable fields appear: video idea, hook, copy, CTA, scenes
 *   4. User can edit any field
 *   5. "Regenerate concept" replaces the current concept via POST /generate-concept
 *   6. "Continue" saves user edits via PATCH /edit-concept, then calls onContinue()
 *
 * States driven by creation.status:
 *   IMAGES_READY   → no concept yet → show Generate button
 *   CONCEPT_READY  → show editable fields + Regenerate + Continue
 *   FAILED         → show error + retry button
 */

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
  Divider,
} from "@mui/material";
import {
  AutoAwesome,
  Refresh,
  ArrowBack,
  ArrowForward,
  ErrorOutline,
  InfoOutlined,
  LightbulbOutlined,
} from "@mui/icons-material";
import type { CreationDTO, ConceptScene } from "@/lib/avatar-video/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  creation: CreationDTO;
  onCreationUpdate: (creation: CreationDTO) => void;
  onContinue: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "0.7rem",
        fontWeight: 600,
        color: "rgba(255,255,255,0.4)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

function SceneCard({
  scene,
  onChange,
}: {
  scene: ConceptScene;
  onChange: (updated: ConceptScene) => void;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "primary.main",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Cena {scene.sceneNumber}
      </Typography>

      <Box>
        <FieldLabel>Objetivo</FieldLabel>
        <TextField
          value={scene.goal}
          onChange={(e) => onChange({ ...scene, goal: e.target.value })}
          size="small"
          fullWidth
          placeholder="Objetivo desta cena"
          inputProps={{ "aria-label": `Objetivo da cena ${scene.sceneNumber}` }}
          sx={inputSx}
        />
      </Box>

      <Box>
        <FieldLabel>Descrição</FieldLabel>
        <TextField
          value={scene.description}
          onChange={(e) => onChange({ ...scene, description: e.target.value })}
          size="small"
          fullWidth
          multiline
          minRows={2}
          placeholder="Descreva o que acontece nesta cena"
          inputProps={{
            "aria-label": `Descrição da cena ${scene.sceneNumber}`,
          }}
          sx={inputSx}
        />
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Shared sx for text fields
// ---------------------------------------------------------------------------

const inputSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "0.8125rem",
    color: "rgba(255,255,255,0.85)",
    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
    "&.Mui-focused fieldset": { borderColor: "primary.main" },
  },
  "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,0.25)" },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StepConceptEdit({
  creation,
  onCreationUpdate,
  onContinue,
  onBack,
}: Props) {
  const status = creation.status;
  const concept = creation.concept;
  const hasConceptReady = status === "CONCEPT_READY" && concept != null;

  // Editable fields — initialized from server concept
  const [videoIdea, setVideoIdea] = useState(concept?.videoIdea ?? "");
  const [hook, setHook] = useState(concept?.hook ?? "");
  const [copy, setCopy] = useState(concept?.copy ?? "");
  const [cta, setCta] = useState(concept?.cta ?? "");
  const [scenes, setScenes] = useState<ConceptScene[]>(concept?.scenes ?? []);

  // Re-init fields when a new concept arrives (generate / regenerate)
  useEffect(() => {
    if (concept) {
      setVideoIdea(concept.videoIdea ?? "");
      setHook(concept.hook ?? "");
      setCopy(concept.copy ?? "");
      setCta(concept.cta ?? "");
      setScenes(concept.scenes ?? []);
    }
  }, [concept?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Generate / Regenerate ─────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerationError(null);
    setSaveError(null);

    try {
      const res = await fetch(
        `/api/avatar-video/creations/${creation.id}/generate-concept`,
        { method: "POST" },
      );

      const data = (await res.json().catch(() => ({}))) as {
        creation?: CreationDTO;
        error?: string;
      };

      if (!res.ok) {
        setGenerationError(
          data.error ?? "Erro ao gerar conceito. Tente novamente.",
        );
        return;
      }

      if (data.creation) {
        onCreationUpdate(data.creation);
      }
    } catch {
      setGenerationError("Erro de conexão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Continue: save edits then advance ────────────────────────────────────

  const handleContinue = async () => {
    if (!hasConceptReady) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(
        `/api/avatar-video/creations/${creation.id}/edit-concept`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoIdea, hook, copy, cta, scenes }),
        },
      );

      const data = (await res.json().catch(() => ({}))) as {
        creation?: CreationDTO;
        error?: string;
      };

      if (!res.ok) {
        setSaveError(data.error ?? "Erro ao salvar conceito. Tente novamente.");
        return;
      }

      if (data.creation) {
        onCreationUpdate(data.creation);
      }

      onContinue();
    } catch {
      setSaveError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const updateScene = (index: number, updated: ConceptScene) => {
    setScenes((prev) => prev.map((s, i) => (i === index ? updated : s)));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Header */}
      <Box>
        <Typography
          component="h2"
          sx={{ fontSize: "1rem", fontWeight: 700, color: "#fff", mb: 0.25 }}
        >
          Conceito do vídeo
        </Typography>
        <Typography
          sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}
        >
          A IA gera um conceito baseado no produto e nas imagens de referência
        </Typography>
      </Box>

      {/* ── No concept yet: show Generate button ──────────────────────────── */}
      {!hasConceptReady && !generating && (
        <>
          <InfoCallout>
            Clique em <strong>Gerar conceito</strong> para que a IA crie um
            hook, copy, CTA e sugestões de cenas para o seu vídeo UGC.
          </InfoCallout>

          {generationError && (
            <Box
              role="alert"
              sx={{
                display: "flex",
                gap: 1,
                p: 1.5,
                borderRadius: 2,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <ErrorOutline
                sx={{
                  fontSize: 16,
                  color: "#ef4444",
                  flexShrink: 0,
                  mt: "1px",
                }}
              />
              <Typography sx={{ fontSize: "0.8rem", color: "#ef4444" }}>
                {generationError}
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            startIcon={<AutoAwesome />}
            onClick={handleGenerate}
            fullWidth
            sx={{ borderRadius: 2, py: 1.25, fontWeight: 600 }}
          >
            Gerar conceito
          </Button>
        </>
      )}

      {/* ── Generating: loading indicator ─────────────────────────────────── */}
      {generating && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            py: 4,
          }}
        >
          <CircularProgress size={28} sx={{ color: "primary.main" }} />
          <Typography
            sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}
          >
            Gerando conceito…
          </Typography>
        </Box>
      )}

      {/* ── Concept ready: editable fields ────────────────────────────────── */}
      {hasConceptReady && !generating && (
        <>
          {/* Toolbar: Regenerate */}
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="small"
              startIcon={<Refresh sx={{ fontSize: "14px !important" }} />}
              onClick={handleGenerate}
              disabled={generating || saving}
              variant="outlined"
              sx={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.6)",
                borderColor: "rgba(255,255,255,0.12)",
                "&:hover": {
                  color: "#fff",
                  borderColor: "rgba(255,255,255,0.25)",
                },
                px: 1.25,
                py: 0.5,
              }}
            >
              Regenerar conceito
            </Button>
          </Box>

          {/* Video idea */}
          <Box>
            <FieldLabel>Ideia do vídeo</FieldLabel>
            <TextField
              value={videoIdea}
              onChange={(e) => setVideoIdea(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder="Resumo da ideia central do vídeo"
              inputProps={{ "aria-label": "Ideia do vídeo" }}
              sx={inputSx}
            />
          </Box>

          {/* Hook */}
          <Box>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}
            >
              <FieldLabel>Hook</FieldLabel>
              <Typography
                sx={{
                  fontSize: "0.65rem",
                  color: "rgba(255,255,255,0.3)",
                  mt: "-2px",
                }}
              >
                Abertura que captura atenção
              </Typography>
            </Box>
            <TextField
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              size="small"
              fullWidth
              placeholder="Frase de abertura impactante"
              inputProps={{ "aria-label": "Hook do vídeo" }}
              sx={inputSx}
            />
          </Box>

          {/* Copy */}
          <Box>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}
            >
              <FieldLabel>Copy</FieldLabel>
              <Typography
                sx={{
                  fontSize: "0.65rem",
                  color: "rgba(255,255,255,0.3)",
                  mt: "-2px",
                }}
              >
                Texto principal / roteiro
              </Typography>
            </Box>
            <TextField
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={3}
              placeholder="Corpo do vídeo — o que o avatar fala"
              inputProps={{ "aria-label": "Copy do vídeo" }}
              sx={inputSx}
            />
          </Box>

          {/* CTA */}
          <Box>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}
            >
              <FieldLabel>CTA</FieldLabel>
              <Typography
                sx={{
                  fontSize: "0.65rem",
                  color: "rgba(255,255,255,0.3)",
                  mt: "-2px",
                }}
              >
                Chamada para ação
              </Typography>
            </Box>
            <TextField
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              size="small"
              fullWidth
              placeholder="Ex: Compre agora pelo link na bio!"
              inputProps={{ "aria-label": "CTA do vídeo" }}
              sx={inputSx}
            />
          </Box>

          {/* Scenes */}
          {scenes.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <LightbulbOutlined
                  sx={{ fontSize: 15, color: "rgba(255,255,255,0.3)" }}
                />
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  Cenas sugeridas ({scenes.length})
                </Typography>
              </Box>
              {scenes.map((scene, i) => (
                <SceneCard
                  key={scene.sceneNumber}
                  scene={scene}
                  onChange={(updated) => updateScene(i, updated)}
                />
              ))}
            </Box>
          )}

          <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

          {/* Generation error after having a concept (regeneration failed) */}
          {generationError && (
            <Box
              role="alert"
              sx={{
                display: "flex",
                gap: 1,
                p: 1.5,
                borderRadius: 2,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <ErrorOutline
                sx={{
                  fontSize: 16,
                  color: "#ef4444",
                  flexShrink: 0,
                  mt: "1px",
                }}
              />
              <Typography sx={{ fontSize: "0.8rem", color: "#ef4444" }}>
                {generationError}
              </Typography>
            </Box>
          )}

          {/* Save error */}
          {saveError && (
            <Box
              role="alert"
              sx={{
                display: "flex",
                gap: 1,
                p: 1.5,
                borderRadius: 2,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <ErrorOutline
                sx={{
                  fontSize: 16,
                  color: "#ef4444",
                  flexShrink: 0,
                  mt: "1px",
                }}
              />
              <Typography sx={{ fontSize: "0.8rem", color: "#ef4444" }}>
                {saveError}
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* ── Action row ──────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
        <Button
          variant="text"
          startIcon={<ArrowBack />}
          onClick={onBack}
          disabled={generating || saving}
          sx={{
            color: "rgba(255,255,255,0.45)",
            "&:hover": { color: "#fff" },
            flexShrink: 0,
          }}
        >
          Voltar
        </Button>

        <Box sx={{ flex: 1 }} />

        {hasConceptReady && (
          <Button
            variant="contained"
            endIcon={
              saving ? (
                <CircularProgress size={14} sx={{ color: "inherit" }} />
              ) : (
                <ArrowForward />
              )
            }
            onClick={handleContinue}
            disabled={saving || generating}
            sx={{ borderRadius: 2, fontWeight: 600, px: 2.5 }}
          >
            {saving ? "Salvando…" : "Continuar"}
          </Button>
        )}
      </Box>
    </Box>
  );
}
