"use client";

/**
 * app/components/avatar-video/StepPromptEdit.tsx
 *
 * Step 5 of the avatar video wizard — VEO 3 JSON generation and editing.
 *
 * Flow:
 *   1. If status is IMAGES_READY (no prompt yet): user clicks "Generate JSON"
 *   2. POST /generate-prompt — synchronous, returns updated creation with prompt
 *   3. The structured JSON is shown in an editable code area
 *   4. User may manually edit the JSON — validation runs on every change
 *   5. Invalid JSON shows a warning chip but never blocks copy actions
 *   6. "Copy All" copies the raw content of the editor (regardless of validity)
 *   7. Each take card has a "Copy Take" button for per-take formatted text
 *   8. "Regenerate" replaces the current JSON via POST /generate-prompt
 *   9. "Save & Finish" saves edits via PATCH /edit-prompt, completes the
 *      creation via POST /complete, then calls onComplete()
 *
 * States driven by creation.status:
 *   IMAGES_READY            → no prompt yet → show Generate button
 *   PENDING_PROMPT          → shouldn't occur (API is synchronous) → loading
 *   PROMPT_READY            → JSON editor + actions
 *   FAILED (with no prompt) → show error + retry button
 */

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Chip,
  Tooltip,
  IconButton,
} from "@mui/material";
import {
  AutoAwesome,
  Refresh,
  ContentCopy,
  Check,
  ArrowBack,
  ErrorOutline,
  WarningAmberRounded,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParseVeo3Prompt(text: string): Veo3Prompt | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).prompt === "string"
    ) {
      return parsed as Veo3Prompt;
    }
    return null;
  } catch {
    return null;
  }
}

function formatTakeForCopy(take: Veo3Take): string {
  return [
    `Take ${take.index}`,
    `Camera: ${take.cameraDirection}`,
    `Visual: ${take.visualDirection}`,
    `Script: ${take.spokenLines}`,
  ].join("\n");
}

function friendlyError(raw: string, status?: number): string {
  if (status === 429) {
    return "Você atingiu o limite de gerações. Aguarde ou entre em contato com o suporte.";
  }
  if (raw.toLowerCase().includes("quota") || raw.toLowerCase().includes("limite")) {
    return "Limite de gerações atingido. Tente novamente mais tarde.";
  }
  return raw;
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

function CopyButton({
  text,
  label,
  size = "small",
}: {
  text: string;
  label: string;
  size?: "small" | "medium";
}) {
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
        size={size}
        onClick={handleCopy}
        aria-label={label}
        sx={{
          color: copied ? "primary.main" : "rgba(255,255,255,0.45)",
          transition: "color 0.15s",
          "&:hover": { color: "primary.main" },
        }}
      >
        {copied ? (
          <Check sx={{ fontSize: size === "small" ? 14 : 18 }} />
        ) : (
          <ContentCopy sx={{ fontSize: size === "small" ? 14 : 18 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}

function TakeCard({ take, index }: { take: Veo3Take; index: number }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
      }}
    >
      {/* Header row */}
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
          Take {take.index ?? index + 1}
        </Typography>
        <CopyButton
          text={formatTakeForCopy(take)}
          label={`Copiar take ${take.index ?? index + 1}`}
        />
      </Box>

      {/* Camera direction */}
      <Box>
        <Typography
          sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", mb: 0.25 }}
        >
          Câmera
        </Typography>
        <Typography sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.75)" }}>
          {take.cameraDirection}
        </Typography>
      </Box>

      {/* Visual direction */}
      <Box>
        <Typography
          sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", mb: 0.25 }}
        >
          Visual
        </Typography>
        <Typography sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.75)" }}>
          {take.visualDirection}
        </Typography>
      </Box>

      {/* Spoken lines */}
      <Box>
        <Typography
          sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", mb: 0.25 }}
        >
          Fala
        </Typography>
        <Typography
          sx={{
            fontSize: "0.8rem",
            color: "#fff",
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          &ldquo;{take.spokenLines}&rdquo;
        </Typography>
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

  // Initialize the editor with whatever JSON we have from the server.
  // Re-init whenever the creation's prompt changes (after generate/regenerate).
  const initialJson =
    promptRow?.promptJson != null
      ? JSON.stringify(promptRow.promptJson, null, 2)
      : "";

  const [editedJson, setEditedJson] = useState(initialJson);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Sync editor when a new prompt arrives (e.g. after regenerate)
  useEffect(() => {
    if (promptRow?.promptJson != null) {
      setEditedJson(JSON.stringify(promptRow.promptJson, null, 2));
    }
  }, [promptRow?.promptJson]);

  // Derived: parse to get takes for per-take display
  const parsedPrompt = tryParseVeo3Prompt(editedJson);
  const isValidJson = parsedPrompt !== null || editedJson.trim() === "";
  const takes: Veo3Take[] = parsedPrompt?.takes ?? [];

  const hasPrompt =
    status === "PROMPT_READY" && promptRow != null;

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
          friendlyError(data.error ?? "Erro ao gerar JSON", res.status),
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
      // 1. Save edited JSON (best-effort — persist whatever the user typed)
      const promptJson = parsedPrompt ?? undefined;
      const promptText =
        parsedPrompt?.prompt ?? (editedJson.trim() || (promptRow?.promptText ?? ""));

      const patchRes = await fetch(
        `/api/avatar-video/creations/${creation.id}/edit-prompt`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptText, promptJson }),
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Header */}
      <Box>
        <Typography
          component="h2"
          sx={{ fontSize: "1rem", fontWeight: 700, color: "#fff", mb: 0.25 }}
        >
          Roteiro VEO 3
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}>
          Gere e edite o JSON estruturado para a geração de vídeo com VEO 3
        </Typography>
      </Box>

      {/* ── No prompt yet: show Generate button ─────────────────────────── */}
      {!hasPrompt && !generating && (
        <>
          <InfoCallout>
            O roteiro é gerado automaticamente com base no produto, avatar,
            cenário e imagens de referência selecionados nas etapas anteriores.
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
            Gerar JSON VEO 3
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
          <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}>
            Gerando roteiro…
          </Typography>
        </Box>
      )}

      {/* ── Prompt ready: editor + actions ──────────────────────────────── */}
      {hasPrompt && !generating && (
        <>
          {/* Toolbar row: validation chip + Copy All + Regenerate */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            {/* Validation state chip */}
            {editedJson.trim() !== "" && (
              <Chip
                size="small"
                icon={
                  isValidJson ? (
                    <Check sx={{ fontSize: "14px !important" }} />
                  ) : (
                    <WarningAmberRounded sx={{ fontSize: "14px !important" }} />
                  )
                }
                label={isValidJson ? "JSON válido" : "JSON inválido"}
                sx={{
                  height: 24,
                  fontSize: "0.7rem",
                  bgcolor: isValidJson
                    ? "rgba(34,197,94,0.12)"
                    : "rgba(245,158,11,0.12)",
                  color: isValidJson
                    ? "rgb(134,239,172)"
                    : "rgb(252,211,77)",
                  border: "1px solid",
                  borderColor: isValidJson
                    ? "rgba(34,197,94,0.25)"
                    : "rgba(245,158,11,0.25)",
                  "& .MuiChip-icon": {
                    color: "inherit",
                    ml: "6px",
                  },
                }}
              />
            )}

            <Box sx={{ flex: 1 }} />

            {/* Copy All */}
            <Tooltip title="Copiar tudo">
              <Button
                size="small"
                startIcon={<ContentCopy sx={{ fontSize: "14px !important" }} />}
                onClick={() =>
                  navigator.clipboard.writeText(editedJson).catch(() => {})
                }
                sx={{
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.6)",
                  borderColor: "rgba(255,255,255,0.12)",
                  "&:hover": { color: "#fff", borderColor: "rgba(255,255,255,0.25)" },
                  px: 1.25,
                  py: 0.5,
                  minWidth: 0,
                }}
                variant="outlined"
              >
                Copiar tudo
              </Button>
            </Tooltip>

            {/* Regenerate */}
            <Tooltip title="Gerar novamente (substitui o JSON atual)">
              <Button
                size="small"
                startIcon={<Refresh sx={{ fontSize: "14px !important" }} />}
                onClick={handleGenerate}
                disabled={generating}
                sx={{
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.6)",
                  borderColor: "rgba(255,255,255,0.12)",
                  "&:hover": { color: "#fff", borderColor: "rgba(255,255,255,0.25)" },
                  px: 1.25,
                  py: 0.5,
                  minWidth: 0,
                }}
                variant="outlined"
              >
                Regenerar
              </Button>
            </Tooltip>
          </Box>

          {/* JSON editor textarea */}
          <Box
            sx={{
              position: "relative",
              borderRadius: 2,
              border: "1px solid",
              borderColor: isValidJson
                ? "rgba(45,212,255,0.18)"
                : "rgba(245,158,11,0.35)",
              background: "rgba(0,0,0,0.3)",
              transition: "border-color 0.15s",
              "&:focus-within": {
                borderColor: isValidJson
                  ? "primary.main"
                  : "rgba(245,158,11,0.6)",
              },
            }}
          >
            <Box
              component="textarea"
              value={editedJson}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setEditedJson(e.target.value)
              }
              aria-label="JSON do roteiro VEO 3"
              spellCheck={false}
              sx={{
                display: "block",
                width: "100%",
                minHeight: 240,
                maxHeight: 400,
                resize: "vertical",
                background: "transparent",
                border: "none",
                outline: "none",
                p: 1.5,
                fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                fontSize: "0.75rem",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.85)",
                caretColor: "#2DD4FF",
                boxSizing: "border-box",
                "&::placeholder": { color: "rgba(255,255,255,0.2)" },
              }}
            />
          </Box>

          {/* Invalid JSON warning */}
          {!isValidJson && editedJson.trim() !== "" && (
            <Box
              role="alert"
              sx={{
                display: "flex",
                gap: 1,
                p: 1.25,
                borderRadius: 2,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
              }}
            >
              <WarningAmberRounded
                sx={{
                  fontSize: 15,
                  color: "rgb(252,211,77)",
                  flexShrink: 0,
                  mt: "1px",
                }}
              />
              <Typography sx={{ fontSize: "0.75rem", color: "rgb(252,211,77)", lineHeight: 1.5 }}>
                O JSON editado contém erros de sintaxe. Você ainda pode copiar e
                usar o conteúdo, mas o roteiro não será salvo como estruturado.
              </Typography>
            </Box>
          )}

          {/* Per-take cards (only when JSON is valid and has takes) */}
          {takes.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Takes ({takes.length})
              </Typography>
              {takes.map((take, i) => (
                <TakeCard key={take.index ?? i} take={take} index={i} />
              ))}
            </Box>
          )}

          {/* Generation error (after having a prompt — e.g. regeneration failed) */}
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

          {/* Save & Complete error */}
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
        {/* Back */}
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

        {/* Finish */}
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
