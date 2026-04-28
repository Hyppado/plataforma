"use client";

/**
 * app/components/avatar-video/StepPromptEdit.tsx
 *
 * Step 5 of the avatar video wizard — VEO 3 take-by-take prompt editor.
 *
 * Section B of Task 3.6: VEO 3 take prompts.
 *
 * Flow:
 *   1. If status is CONCEPT_READY (no prompt yet): user clicks "Generate takes"
 *   2. POST /generate-prompt — synchronous, returns updated creation with prompt
 *      The prompt is generated using the approved concept from Step 4.
 *   3. Per-take editors appear — one editable card per take
 *   4. Each take has: camera direction (EN), visual direction (EN), spoken lines (PT)
 *   5. "Regenerate" replaces the current takes via POST /generate-prompt
 *   6. "Copy take" copies the formatted animation prompt for a single take
 *   7. "Copy all" copies all takes formatted together
 *   8. "Finish" saves any edits via PATCH /edit-prompt, marks COMPLETED, calls onComplete()
 *
 * States driven by creation.status:
 *   CONCEPT_READY  → no prompt yet → show Generate button
 *   PENDING_PROMPT → shouldn't occur (API is synchronous) → loading
 *   PROMPT_READY   → per-take editors + copy actions
 *   FAILED         → show error + retry button
 */

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  IconButton,
  TextField,
} from "@mui/material";
import {
  AutoAwesome,
  Refresh,
  ContentCopy,
  Check,
  ArrowBack,
  ErrorOutline,
  InfoOutlined,
} from "@mui/icons-material";
import type { CreationDTO } from "@/lib/avatar-video/types";
import type { Veo3Prompt, Veo3Take } from "@/lib/avatar-video/veo-prompt";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  creation: CreationDTO;
  onCreationUpdate: (creation: CreationDTO) => void;
  onComplete: () => void;
  onBack: () => void;
}

type EditableTake = {
  index: number;
  cameraDirection: string;
  visualDirection: string;
  spokenLines: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function promptToTakes(json: unknown): EditableTake[] {
  if (
    typeof json !== "object" ||
    json === null ||
    !Array.isArray((json as Record<string, unknown>).takes)
  ) {
    return [];
  }
  return (json as Veo3Prompt).takes!.map((t, i) => ({
    index: (t?.index ?? i + 1),
    cameraDirection: t?.cameraDirection ?? "",
    visualDirection: t?.visualDirection ?? "",
    spokenLines: t?.spokenLines ?? "",
  }));
}

function formatTakeForCopy(take: EditableTake): string {
  return [
    `Take ${take.index}`,
    `Camera: ${take.cameraDirection}`,
    `Visual: ${take.visualDirection}`,
    `Script: "${take.spokenLines}"`,
  ].join("\n");
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
        sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function CopyIconButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <Tooltip title={copied ? "Copiado!" : label}>
      <IconButton
        size="small"
        onClick={handleCopy}
        aria-label={label}
        sx={{
          color: copied ? "primary.main" : "rgba(255,255,255,0.45)",
          transition: "color 0.15s",
          "&:hover": { color: "primary.main" },
        }}
      >
        {copied ? (
          <Check sx={{ fontSize: 14 }} />
        ) : (
          <ContentCopy sx={{ fontSize: 14 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <Button
      size="small"
      startIcon={
        copied ? (
          <Check sx={{ fontSize: "14px !important" }} />
        ) : (
          <ContentCopy sx={{ fontSize: "14px !important" }} />
        )
      }
      onClick={handleCopy}
      variant="outlined"
      sx={{
        fontSize: "0.75rem",
        color: copied ? "primary.main" : "rgba(255,255,255,0.6)",
        borderColor: copied ? "rgba(45,212,255,0.3)" : "rgba(255,255,255,0.12)",
        "&:hover": { color: "#fff", borderColor: "rgba(255,255,255,0.25)" },
        px: 1.25,
        py: 0.5,
        minWidth: 0,
        transition: "color 0.15s, border-color 0.15s",
      }}
    >
      {copied ? "Copiado!" : label}
    </Button>
  );
}

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "0.8125rem",
    color: "rgba(255,255,255,0.85)",
    "& fieldset": { borderColor: "rgba(255,255,255,0.08)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.18)" },
    "&.Mui-focused fieldset": { borderColor: "primary.main" },
  },
  "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,0.2)" },
};

function FieldLabel({
  children,
  badge,
}: {
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
      <Typography
        sx={{
          fontSize: "0.65rem",
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {children}
      </Typography>
      {badge && (
        <Box
          component="span"
          sx={{
            fontSize: "0.6rem",
            color: "rgba(255,255,255,0.25)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 0.75,
            px: 0.5,
            py: 0.1,
            lineHeight: 1.3,
          }}
        >
          {badge}
        </Box>
      )}
    </Box>
  );
}

function TakeEditor({
  take,
  onChange,
}: {
  take: EditableTake;
  onChange: (updated: EditableTake) => void;
}) {
  const copyText = formatTakeForCopy(take);

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "primary.main",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Take {take.index}
        </Typography>
        <CopyIconButton text={copyText} label={`Copiar take ${take.index}`} />
      </Box>

      {/* Camera direction */}
      <Box>
        <FieldLabel badge="EN">Câmera</FieldLabel>
        <TextField
          value={take.cameraDirection}
          onChange={(e) =>
            onChange({ ...take, cameraDirection: e.target.value })
          }
          size="small"
          fullWidth
          placeholder="Ex: Medium shot, slow zoom in"
          inputProps={{
            "aria-label": `Take ${take.index} — direção de câmera`,
          }}
          sx={fieldSx}
        />
      </Box>

      {/* Visual direction */}
      <Box>
        <FieldLabel badge="EN">Visual</FieldLabel>
        <TextField
          value={take.visualDirection}
          onChange={(e) =>
            onChange({ ...take, visualDirection: e.target.value })
          }
          size="small"
          fullWidth
          multiline
          minRows={2}
          placeholder="Ex: Avatar picks up product and holds it to camera. Max 8 seconds."
          inputProps={{
            "aria-label": `Take ${take.index} — direção visual`,
          }}
          sx={fieldSx}
        />
      </Box>

      {/* Spoken lines */}
      <Box>
        <FieldLabel badge="PT">Fala</FieldLabel>
        <TextField
          value={take.spokenLines}
          onChange={(e) => onChange({ ...take, spokenLines: e.target.value })}
          size="small"
          fullWidth
          multiline
          minRows={2}
          placeholder="Diálogo em português que o avatar fala neste take"
          inputProps={{
            "aria-label": `Take ${take.index} — fala`,
          }}
          sx={fieldSx}
        />
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StepPromptEdit({
  creation,
  onCreationUpdate,
  onComplete,
  onBack,
}: Props) {
  const status = creation.status;
  const promptRow = creation.prompt;

  const [editedTakes, setEditedTakes] = useState<EditableTake[]>(
    () => promptToTakes(promptRow?.promptJson),
  );

  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Sync takes when a new prompt arrives (after generate / regenerate)
  useEffect(() => {
    if (promptRow?.promptJson != null) {
      setEditedTakes(promptToTakes(promptRow.promptJson));
    }
  }, [promptRow?.promptJson]);

  const hasPrompt = status === "PROMPT_READY" && promptRow != null;

  // Guard: creation hasn't gone through the concept step yet.
  const needsConcept =
    status !== "CONCEPT_READY" &&
    status !== "PENDING_CONCEPT" &&
    status !== "PENDING_PROMPT" &&
    status !== "PROMPT_READY" &&
    status !== "COMPLETED" &&
    status !== "FAILED";

  const updateTake = useCallback((index: number, updated: EditableTake) => {
    setEditedTakes((prev) => prev.map((t, i) => (i === index ? updated : t)));
  }, []);

  const copyAllText = editedTakes.map(formatTakeForCopy).join("\n\n---\n\n");

  // ── Generate / Regenerate ─────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerationError(null);
    setCompleteError(null);

    try {
      const res = await fetch(
        `/api/avatar-video/creations/${creation.id}/generate-prompt`,
        { method: "POST" },
      );

      const data = (await res.json().catch(() => ({}))) as {
        creation?: CreationDTO;
        error?: string;
      };

      if (!res.ok) {
        setGenerationError(
          data.error ?? "Erro ao gerar roteiro. Tente novamente.",
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

  // ── Save & Complete ───────────────────────────────────────────────────────

  const handleComplete = async () => {
    setCompleting(true);
    setCompleteError(null);

    try {
      const originalJson =
        promptRow?.promptJson != null
          ? (promptRow.promptJson as Veo3Prompt)
          : null;

      const updatedJson: Veo3Prompt = {
        prompt: originalJson?.prompt ?? "",
        duration: originalJson?.duration ?? editedTakes.length * 8,
        aspectRatio: originalJson?.aspectRatio ?? "9:16",
        style: originalJson?.style ?? "ugc",
        language: originalJson?.language ?? "pt-BR",
        takes: editedTakes as Veo3Take[],
      };

      // 1. Save edited takes
      const patchRes = await fetch(
        `/api/avatar-video/creations/${creation.id}/edit-prompt`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promptText: updatedJson.prompt || copyAllText,
            promptJson: updatedJson,
          }),
        },
      );

      if (!patchRes.ok) {
        const d = (await patchRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(d.error ?? "Erro ao salvar roteiro");
      }

      // 2. Mark creation COMPLETED
      const completeRes = await fetch(
        `/api/avatar-video/creations/${creation.id}/complete`,
        { method: "POST" },
      );

      if (!completeRes.ok) {
        const d = (await completeRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(d.error ?? "Erro ao finalizar criação");
      }

      onComplete();
    } catch (err) {
      setCompleteError(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setCompleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (needsConcept) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box>
          <Typography
            component="h2"
            sx={{ fontSize: "1rem", fontWeight: 700, color: "#fff", mb: 0.25 }}
          >
            Takes VEO 3
          </Typography>
        </Box>
        <Box
          role="alert"
          sx={{
            display: "flex",
            gap: 1,
            p: 1.5,
            borderRadius: 2,
            background: "rgba(255,193,7,0.08)",
            border: "1px solid rgba(255,193,7,0.2)",
          }}
        >
          <ErrorOutline
            sx={{ fontSize: 16, color: "#ffc107", flexShrink: 0, mt: "1px" }}
          />
          <Typography sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)" }}>
            Você precisa gerar e aprovar o conceito do vídeo antes de criar os
            takes. Volte à etapa anterior.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
          <Button
            variant="text"
            startIcon={<ArrowBack />}
            onClick={onBack}
            sx={{ color: "rgba(255,255,255,0.45)", "&:hover": { color: "#fff" } }}
          >
            Voltar ao Conceito
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Header */}
      <Box>
        <Typography
          component="h2"
          sx={{ fontSize: "1rem", fontWeight: 700, color: "#fff", mb: 0.25 }}
        >
          Takes VEO 3
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}>
          Prompts de animação para cada take — edite antes de copiar
        </Typography>
      </Box>

      {/* ── No prompt yet: show Generate button ─────────────────────────── */}
      {!hasPrompt && !generating && (
        <>
          <InfoCallout>
            Os takes são gerados a partir do conceito aprovado na etapa
            anterior. Cada take tem no máximo 8 segundos. As direções de câmera
            e visual são em inglês; as falas são em português.
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
                sx={{ fontSize: 16, color: "#ef4444", flexShrink: 0, mt: "1px" }}
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
            Gerar takes
          </Button>
        </>
      )}

      {/* ── Generating: loading indicator ────────────────────────────────── */}
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
            Gerando takes…
          </Typography>
        </Box>
      )}

      {/* ── Prompt ready: per-take editors ──────────────────────────────── */}
      {hasPrompt && !generating && (
        <>
          {/* Toolbar */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Box sx={{ flex: 1 }} />

            <CopyButton text={copyAllText} label="Copiar todos" />

            <Tooltip title="Gerar novamente (substitui os takes atuais)">
              <Button
                size="small"
                startIcon={<Refresh sx={{ fontSize: "14px !important" }} />}
                onClick={handleGenerate}
                disabled={generating}
                variant="outlined"
                sx={{
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.6)",
                  borderColor: "rgba(255,255,255,0.12)",
                  "&:hover": { color: "#fff", borderColor: "rgba(255,255,255,0.25)" },
                  px: 1.25,
                  py: 0.5,
                  minWidth: 0,
                }}
              >
                Regenerar
              </Button>
            </Tooltip>
          </Box>

          {/* Per-take editors */}
          {editedTakes.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {editedTakes.map((take, i) => (
                <TakeEditor
                  key={take.index}
                  take={take}
                  onChange={(updated) => updateTake(i, updated)}
                />
              ))}
            </Box>
          )}

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
                sx={{ fontSize: 16, color: "#ef4444", flexShrink: 0, mt: "1px" }}
              />
              <Typography sx={{ fontSize: "0.8rem", color: "#ef4444" }}>
                {generationError}
              </Typography>
            </Box>
          )}

          {completeError && (
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
                sx={{ fontSize: 16, color: "#ef4444", flexShrink: 0, mt: "1px" }}
              />
              <Typography sx={{ fontSize: "0.8rem", color: "#ef4444" }}>
                {completeError}
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
          disabled={generating || completing}
          sx={{
            color: "rgba(255,255,255,0.45)",
            "&:hover": { color: "#fff" },
            flexShrink: 0,
          }}
        >
          Voltar
        </Button>

        <Box sx={{ flex: 1 }} />

        {hasPrompt && (
          <Button
            variant="contained"
            onClick={handleComplete}
            disabled={completing || generating}
            startIcon={
              completing ? (
                <CircularProgress size={14} sx={{ color: "inherit" }} />
              ) : (
                <Check />
              )
            }
            sx={{ borderRadius: 2, fontWeight: 600, px: 2.5 }}
          >
            {completing ? "Salvando…" : "Concluir"}
          </Button>
        )}
      </Box>
    </Box>
  );
}
