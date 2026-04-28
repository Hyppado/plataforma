"use client";

/**
 * app/components/avatar-video/StepImageGenerate.tsx
 *
 * Step 4 of the avatar video wizard — image reference generation.
 *
 * Flow:
 *   1. User clicks "Gerar imagem" — POSTs to generate-image (synchronous, ~30-60s)
 *   2. Server returns updated creation with status=IMAGES_READY and imageVariations
 *   3. User sees up to 2 variation cards, picks a preferred one
 *   4. User can click "Regenerar" to redo (quota consumed again)
 *   5. User clicks "Continuar" — selection is PATCHed, then onContinue() called
 *
 * States driven by creation.status:
 *   DRAFT / FAILED   → show generate button (with error message if FAILED)
 *   PENDING_IMAGES   → shouldn't occur (API is synchronous), shown as loading
 *   IMAGES_READY     → show variation cards + regenerate + continue
 */

import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import {
  AutoAwesome,
  Refresh,
  ArrowForward,
  ArrowBack,
  CheckCircle,
  Download,
  ErrorOutline,
  InfoOutlined,
} from "@mui/icons-material";
import type { CreationDTO, ImageVariationDTO } from "@/lib/avatar-video/types";

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

function VariationCard({
  variation,
  selected,
  index,
  onSelect,
}: {
  variation: ImageVariationDTO;
  selected: boolean;
  index: number;
  onSelect: () => void;
}) {
  const isReady = variation.status === "READY" && !!variation.blobUrl;
  const isFailed = variation.status === "FAILED";

  return (
    <Box
      component="button"
      type="button"
      onClick={isReady ? onSelect : undefined}
      aria-pressed={selected}
      disabled={!isReady}
      sx={{
        all: "unset",
        cursor: isReady ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        border: "2px solid",
        borderColor: selected ? "primary.main" : "rgba(255,255,255,0.08)",
        background: selected
          ? "rgba(45,212,255,0.06)"
          : "rgba(255,255,255,0.02)",
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
        flex: 1,
        minWidth: 0,
        position: "relative",
        "&:hover": isReady
          ? {
              borderColor: selected ? "primary.main" : "rgba(45,212,255,0.3)",
            }
          : undefined,
      }}
    >
      {/* Image area */}
      <Box
        sx={{
          width: "100%",
          aspectRatio: "9/16",
          background: "rgba(255,255,255,0.04)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isReady && variation.blobUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={variation.blobUrl}
            alt={`Variação ${index + 1}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : isFailed ? (
          <ErrorOutline sx={{ fontSize: 32, color: "rgba(239,68,68,0.6)" }} />
        ) : (
          <CircularProgress size={24} sx={{ color: "rgba(255,255,255,0.3)" }} />
        )}

        {/* Selected checkmark overlay */}
        {selected && isReady && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "primary.main",
              borderRadius: "50%",
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle sx={{ fontSize: 16, color: "#000" }} />
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 1.25,
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.5,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: selected ? 600 : 400,
            color: selected ? "primary.main" : "rgba(255,255,255,0.6)",
          }}
        >
          {isFailed ? "Falhou" : `Variação ${index + 1}`}
        </Typography>

        {/* Download link — stop event from bubbling to select handler */}
        {isReady && variation.blobUrl && (
          <Box
            component="a"
            href={variation.blobUrl}
            download={`variacao-${index + 1}.png`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Baixar variação ${index + 1}`}
            sx={{
              display: "flex",
              alignItems: "center",
              color: "rgba(255,255,255,0.45)",
              "&:hover": { color: "primary.main" },
              transition: "color 0.15s",
            }}
          >
            <Download sx={{ fontSize: 16 }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

function VariationsSkeleton() {
  return (
    <Box sx={{ display: "flex", gap: 1.5 }}>
      {[0, 1].map((i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          sx={{ flex: 1, aspectRatio: "9/16", borderRadius: 2 }}
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

function friendlyError(raw: string, status?: number): string {
  if (status === 429) {
    return "Você atingiu o limite de gerações de imagem. Aguarde ou entre em contato com o suporte.";
  }
  if (
    raw.toLowerCase().includes("quota") ||
    raw.toLowerCase().includes("limite")
  ) {
    return "Você atingiu o limite de gerações. Tente novamente mais tarde.";
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StepImageGenerate({
  creation,
  onCreationUpdate,
  onContinue,
  onBack,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Selected variation (initialise from DB-persisted value if present)
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(
    creation.selectedImageVariationId ?? null,
  );

  const status = creation.status;
  const readyVariations = creation.imageVariations.filter(
    (v) => v.status === "READY" || v.status === "FAILED",
  );
  const hasImages = status === "IMAGES_READY" && readyVariations.length > 0;

  // ── Generate / Regenerate ────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerationError(null);
    setSaveError(null);

    try {
      const res = await fetch(
        `/api/avatar-video/creations/${creation.id}/generate-image`,
        { method: "POST" },
      );

      const data = (await res.json().catch(() => ({}))) as {
        creation?: CreationDTO;
        error?: string;
      };

      if (!res.ok) {
        setGenerationError(
          friendlyError(data.error ?? "Erro ao gerar imagem", res.status),
        );
        return;
      }

      if (data.creation) {
        onCreationUpdate(data.creation);
        // Auto-select first READY variation after generation
        const firstReady = data.creation.imageVariations.find(
          (v) => v.status === "READY",
        );
        setSelectedVariationId(firstReady?.id ?? null);
      }
    } catch {
      setGenerationError("Erro de conexão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Select variation ─────────────────────────────────────────────────────

  const handleSelectVariation = async (variationId: string) => {
    setSelectedVariationId(variationId);
    setSaveError(null);
    // Fire-and-forget PATCH — UI updates optimistically
    fetch(`/api/avatar-video/creations/${creation.id}/select-variation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variationId }),
    }).catch(() => {
      // Non-critical — selection is in local state; silently ignore
    });
  };

  // ── Continue ─────────────────────────────────────────────────────────────

  // Allow advancing when images are ready OR when already past that step
  // (user navigated back from prompt step — status is PROMPT_READY or later).
  const pastImagesReady = status === "PROMPT_READY" || status === "COMPLETED";
  const canContinue =
    !saving &&
    !generating &&
    (status === "IMAGES_READY" || pastImagesReady) &&
    !!selectedVariationId;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    setSaveError(null);

    try {
      // When past IMAGES_READY (e.g. user navigated back from prompt step),
      // the variation selection is already saved — just advance.
      if (pastImagesReady) {
        onContinue();
        return;
      }

      // Ensure selection is persisted before advancing
      const res = await fetch(
        `/api/avatar-video/creations/${creation.id}/select-variation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variationId: selectedVariationId }),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Erro ao salvar seleção");
      }

      onContinue();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Header */}
      <Box>
        <Typography
          component="h2"
          sx={{ fontSize: "1rem", fontWeight: 700, color: "#fff", mb: 0.25 }}
        >
          Imagem de referência
        </Typography>
        <Typography
          sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}
        >
          Gere imagens para usar como base do vídeo com avatar
        </Typography>
      </Box>

      {/* ── IMAGES_READY: show variations ── */}
      {status === "IMAGES_READY" && (
        <>
          {readyVariations.length > 0 ? (
            <Box sx={{ display: "flex", gap: 1.5 }}>
              {readyVariations
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((variation, i) => (
                  <VariationCard
                    key={variation.id}
                    variation={variation}
                    selected={selectedVariationId === variation.id}
                    index={i}
                    onSelect={() => handleSelectVariation(variation.id)}
                  />
                ))}
            </Box>
          ) : (
            <VariationsSkeleton />
          )}

          <InfoCallout>
            Selecione a imagem que melhor representa o visual do vídeo. Ela será
            usada como referência para gerar o roteiro.
          </InfoCallout>
        </>
      )}

      {/* ── PENDING_IMAGES: loading state (shouldn't happen in practice) ── */}
      {status === "PENDING_IMAGES" && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            py: 4,
          }}
        >
          <CircularProgress size={36} sx={{ color: "primary.main" }} />
          <Typography
            sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}
          >
            Gerando imagens…
          </Typography>
        </Box>
      )}

      {/* ── DRAFT / FAILED: generate prompt ── */}
      {(status === "DRAFT" || status === "FAILED") && !generating && (
        <>
          {status === "FAILED" && creation.errorMessage && (
            <Box
              role="alert"
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  color: "#ef4444",
                  mb: 0.5,
                  fontWeight: 600,
                }}
              >
                Geração anterior falhou
              </Typography>
              <Typography
                sx={{ fontSize: "0.75rem", color: "rgba(239,68,68,0.8)" }}
              >
                {creation.errorMessage}
              </Typography>
            </Box>
          )}

          <InfoCallout>
            As imagens são geradas com IA a partir do produto e do cenário
            escolhidos. O processo leva cerca de 30 segundos.
          </InfoCallout>
        </>
      )}

      {/* Generating loading state */}
      {generating && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            py: 5,
          }}
        >
          <CircularProgress size={40} sx={{ color: "primary.main" }} />
          <Typography
            sx={{
              fontSize: "0.8125rem",
              color: "rgba(255,255,255,0.5)",
              textAlign: "center",
            }}
          >
            Gerando imagens com IA…
            <br />
            <Box component="span" sx={{ fontSize: "0.7rem" }}>
              Isso pode levar até 1 minuto
            </Box>
          </Typography>
        </Box>
      )}

      {/* Generation error */}
      {generationError && !generating && (
        <Box
          role="alert"
          sx={{
            p: 1.5,
            borderRadius: 2,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          <Typography sx={{ fontSize: "0.8125rem", color: "#ef4444" }}>
            {generationError}
          </Typography>
        </Box>
      )}

      {/* Save error */}
      {saveError && (
        <Box
          role="alert"
          sx={{
            p: 1.5,
            borderRadius: 2,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          <Typography sx={{ fontSize: "0.8125rem", color: "#ef4444" }}>
            {saveError}
          </Typography>
        </Box>
      )}

      {/* ── Action buttons ── */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 0.5 }}>
        {/* Generate / Regenerate button */}
        {(status === "DRAFT" ||
          status === "FAILED" ||
          status === "IMAGES_READY") &&
          !generating && (
            <Button
              variant={hasImages ? "outlined" : "contained"}
              onClick={handleGenerate}
              disabled={generating || saving}
              startIcon={hasImages ? <Refresh /> : <AutoAwesome />}
              fullWidth
              sx={{
                fontWeight: 700,
                textTransform: "none",
                fontSize: "0.875rem",
                py: 1.25,
                ...(hasImages && {
                  borderColor: "rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.7)",
                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.04)",
                  },
                }),
              }}
            >
              {hasImages ? "Regenerar imagens" : "Gerar imagem"}
            </Button>
          )}

        {/* Back / Continue row */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="text"
            onClick={onBack}
            disabled={generating || saving}
            startIcon={<ArrowBack />}
            sx={{
              fontWeight: 600,
              textTransform: "none",
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.5)",
              "&:hover": { color: "#fff" },
              flexShrink: 0,
            }}
          >
            Voltar
          </Button>

          <Button
            variant="contained"
            onClick={handleContinue}
            disabled={!canContinue}
            endIcon={saving ? <CircularProgress size={16} /> : <ArrowForward />}
            fullWidth
            sx={{
              fontWeight: 700,
              textTransform: "none",
              fontSize: "0.875rem",
              py: 1.25,
            }}
          >
            Continuar
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
