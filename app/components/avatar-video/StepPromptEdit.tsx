"use client";

/**
 * app/components/avatar-video/StepPromptEdit.tsx
 *
 * Step 6 of the avatar video wizard — VEO 3 take-by-take prompt editor.
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

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  AutoAwesome,
  Refresh,
  ContentCopy,
  Check,
  ArrowBack,
  ErrorOutline,
  InfoOutlined,
  WarningAmber,
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
    index: t?.index ?? i + 1,
    cameraDirection: t?.cameraDirection ?? "",
    visualDirection: t?.visualDirection ?? "",
    spokenLines: t?.spokenLines ?? "",
  }));
}

function serializeTake(take: EditableTake): string {
  return JSON.stringify(
    {
      index: take.index,
      cameraDirection: take.cameraDirection,
      visualDirection: take.visualDirection,
      spokenLines: take.spokenLines,
    },
    null,
    2,
  );
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

/**
 * TakeEditor — shows a single 8-second take as an editable JSON block.
 * The JSON is the source of truth; fields are parsed from user edits.
 */
function TakeEditor({
  take,
  onChange,
}: {
  take: EditableTake;
  onChange: (updated: EditableTake) => void;
}) {
  const [rawJson, setRawJson] = useState(() => serializeTake(take));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Detect external changes (regeneration) vs user-driven edits via a signature.
  const appliedSigRef = useRef(
    `${take.cameraDirection}|||${take.visualDirection}|||${take.spokenLines}`,
  );
  const incomingSig = `${take.cameraDirection}|||${take.visualDirection}|||${take.spokenLines}`;

  useEffect(() => {
    if (incomingSig !== appliedSigRef.current) {
      appliedSigRef.current = incomingSig;
      setRawJson(serializeTake(take));
      setJsonError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSig]);

  const handleChange = (val: string) => {
    setRawJson(val);
    try {
      const parsed = JSON.parse(val) as Record<string, unknown>;
      setJsonError(null);
      const newTake: EditableTake = {
        index: take.index,
        cameraDirection:
          typeof parsed.cameraDirection === "string"
            ? parsed.cameraDirection
            : take.cameraDirection,
        visualDirection:
          typeof parsed.visualDirection === "string"
            ? parsed.visualDirection
            : take.visualDirection,
        spokenLines:
          typeof parsed.spokenLines === "string"
            ? parsed.spokenLines
            : take.spokenLines,
      };
      appliedSigRef.current = `${newTake.cameraDirection}|||${newTake.visualDirection}|||${newTake.spokenLines}`;
      onChange(newTake);
    } catch {
      setJsonError("JSON inválido — edite com cuidado");
    }
  };

  const spokenWords = take.spokenLines
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const spokenTooLong = take.spokenLines.trim().length > 0 && spokenWords > 20;
  const showFooter = jsonError != null || take.spokenLines.trim().length > 0;

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${
          jsonError ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.08)"
        }`,
        background: "rgba(255,255,255,0.02)",
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          pt: 1.25,
          pb: 0.75,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
          <Typography
            sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)" }}
          >
            8s
          </Typography>
        </Box>
        <CopyIconButton text={rawJson} label={`Copiar take ${take.index}`} />
      </Box>

      {/* Editable JSON body */}
      <Box
        component="textarea"
        value={rawJson}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          handleChange(e.target.value)
        }
        spellCheck={false}
        aria-label={`Take ${take.index} — JSON`}
        rows={9}
        sx={{
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          background: "rgba(0,0,0,0.28)",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          color: jsonError ? "rgba(239,68,68,0.85)" : "rgba(255,255,255,0.72)",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          fontSize: "0.7rem",
          lineHeight: 1.7,
          p: 1.5,
          resize: "vertical",
          outline: "none",
          transition: "color 0.15s, background 0.15s",
          "&:focus": {
            background: "rgba(0,0,0,0.38)",
          },
        }}
      />

      {/* Footer: word-count / JSON error */}
      {showFooter && (
        <Box
          sx={{
            px: 1.5,
            py: 0.6,
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          {jsonError ? (
            <>
              <ErrorOutline sx={{ fontSize: 10, color: "#ef4444" }} />
              <Typography sx={{ fontSize: "0.6rem", color: "#ef4444" }}>
                {jsonError}
              </Typography>
            </>
          ) : (
            <>
              {spokenTooLong && (
                <WarningAmber sx={{ fontSize: 10, color: "#f59e0b" }} />
              )}
              <Typography
                sx={{
                  fontSize: "0.6rem",
                  color: spokenTooLong ? "#f59e0b" : "rgba(255,255,255,0.2)",
                  transition: "color 0.15s",
                }}
              >
                {spokenWords} {spokenWords === 1 ? "palavra" : "palavras"} na
                fala
                {spokenTooLong
                  ? " · pode exceder 8s — reduza para ≈ 20 palavras"
                  : ""}
              </Typography>
            </>
          )}
        </Box>
      )}
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

  const existingTakeCount =
    (promptRow?.promptJson as Veo3Prompt | null)?.takes?.length ?? null;

  const [editedTakes, setEditedTakes] = useState<EditableTake[]>(() =>
    promptToTakes(promptRow?.promptJson),
  );
  const [selectedDuration, setSelectedDuration] = useState<number>(
    existingTakeCount != null ? existingTakeCount * 8 : 32,
  );

  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Sync takes (and duration) when a new prompt arrives after generate/regenerate
  useEffect(() => {
    if (promptRow?.promptJson != null) {
      setEditedTakes(promptToTakes(promptRow.promptJson));
      const tc = (promptRow.promptJson as Veo3Prompt).takes?.length;
      if (tc != null) setSelectedDuration(tc * 8);
    }
  }, [promptRow?.promptJson]);

  const hasPrompt = status === "PROMPT_READY" && promptRow != null;

  // Assembled VEO 3 JSON — updates live as user edits takes
  const assembledPromptJson: Veo3Prompt = {
    prompt: (promptRow?.promptJson as Veo3Prompt | null)?.prompt ?? "",
    duration: editedTakes.length * 8,
    aspectRatio: "9:16",
    style: "ugc",
    language: "pt-BR",
    takes: editedTakes as Veo3Take[],
  };
  const veoJsonText = JSON.stringify(assembledPromptJson, null, 2);

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

  const copyAllText = veoJsonText;

  // ── Generate / Regenerate ─────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerationError(null);
    setCompleteError(null);

    const takeCount = Math.max(1, Math.round(selectedDuration / 8));

    try {
      const res = await fetch(
        `/api/avatar-video/creations/${creation.id}/generate-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ takeCount }),
        },
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
        err instanceof Error
          ? err.message
          : "Erro inesperado. Tente novamente.",
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
          <Typography
            sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)" }}
          >
            Você precisa gerar e aprovar o conceito do vídeo antes de criar os
            takes. Volte à etapa anterior.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
          <Button
            variant="text"
            startIcon={<ArrowBack />}
            onClick={onBack}
            sx={{
              color: "rgba(255,255,255,0.45)",
              "&:hover": { color: "#fff" },
            }}
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
        <Typography
          sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}
        >
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

          {/* Duration selector */}
          <Box>
            <Typography
              sx={{
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                mb: 0.75,
              }}
            >
              Duração total
            </Typography>
            <ToggleButtonGroup
              value={selectedDuration}
              exclusive
              onChange={(_, v) => {
                if (v != null) setSelectedDuration(v as number);
              }}
              size="small"
              sx={{
                flexWrap: "wrap",
                gap: 0.5,
                "& .MuiToggleButton-root": {
                  fontSize: "0.7rem",
                  color: "rgba(255,255,255,0.45)",
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: "6px !important",
                  px: 1.25,
                  py: 0.5,
                  "&.Mui-selected": {
                    color: "primary.main",
                    background: "rgba(45,212,255,0.08)",
                    borderColor: "rgba(45,212,255,0.3)",
                  },
                  "&.Mui-selected:hover": {
                    background: "rgba(45,212,255,0.14)",
                  },
                },
              }}
            >
              {([16, 24, 32, 40, 48] as number[]).map((d) => (
                <ToggleButton key={d} value={d}>
                  {d}s &middot; {d / 8} take{d / 8 !== 1 ? "s" : ""}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

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
          {/* Duration picker \u2014 shown above toolbar for re-generation */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.65rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.28)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                flexShrink: 0,
              }}
            >
              Duração
            </Typography>
            <ToggleButtonGroup
              value={selectedDuration}
              exclusive
              onChange={(_, v) => {
                if (v != null) setSelectedDuration(v as number);
              }}
              size="small"
              sx={{
                flexWrap: "wrap",
                gap: 0.5,
                "& .MuiToggleButton-root": {
                  fontSize: "0.65rem",
                  color: "rgba(255,255,255,0.4)",
                  borderColor: "rgba(255,255,255,0.08)",
                  borderRadius: "5px !important",
                  px: 1,
                  py: 0.3,
                  "&.Mui-selected": {
                    color: "primary.main",
                    background: "rgba(45,212,255,0.07)",
                    borderColor: "rgba(45,212,255,0.25)",
                  },
                },
              }}
            >
              {([16, 24, 32, 40, 48] as number[]).map((d) => (
                <ToggleButton key={d} value={d}>
                  {d}s
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography
              sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.22)" }}
            >
              {Math.round(selectedDuration / 8)} take
              {Math.round(selectedDuration / 8) !== 1 ? "s" : ""} solicitado
              {editedTakes.length > 0 &&
                ` · ${editedTakes.length} gerado${editedTakes.length !== 1 ? "s" : ""}`}
            </Typography>
          </Box>

          {/* Toolbar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
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
                  "&:hover": {
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.25)",
                  },
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
                sx={{
                  fontSize: 16,
                  color: "#ef4444",
                  flexShrink: 0,
                  mt: "1px",
                }}
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
