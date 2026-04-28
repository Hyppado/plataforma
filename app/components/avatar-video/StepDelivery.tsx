"use client";

/**
 * app/components/avatar-video/StepDelivery.tsx
 *
 * Final delivery screen shown after a creation reaches COMPLETED status.
 *
 * Displays all final assets in one place:
 *   - Product name and image
 *   - Avatar used (profile image or uploaded image)
 *   - Scenario / tone / duration
 *   - Generated reference image
 *   - VEO 3 prompt JSON (read-only, copyable)
 *
 * Action buttons:
 *   - Copy all (copies the full prompt JSON to clipboard)
 *   - Download image (triggers download of the selected generated image)
 *   - Create another (navigates to the start of a new creation)
 *   - Back to products (navigates to /dashboard/trends)
 *
 * Important: An info callout makes clear that Hyppado does not generate the
 * final video inside the platform in this phase.
 */

import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Divider,
  Chip,
} from "@mui/material";
import {
  CheckCircle,
  ContentCopy,
  Check,
  Download,
  AddCircleOutline,
  ArrowBack,
  InfoOutlined,
  ImageOutlined,
  PersonOutlined,
  MovieOutlined,
  Inventory2Outlined,
} from "@mui/icons-material";
import type { CreationDTO } from "@/lib/avatar-video/types";
import type { Veo3Prompt } from "@/lib/avatar-video/veo-prompt";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  creation: CreationDTO;
  onCreateAnother: () => void;
  onBackToProducts: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParseVeo3Prompt(text: string | null | undefined): Veo3Prompt | null {
  if (!text) return null;
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

function getSelectedImageUrl(creation: CreationDTO): string | null {
  if (creation.selectedImageVariationId && creation.imageVariations.length > 0) {
    const selected = creation.imageVariations.find(
      (v) => v.id === creation.selectedImageVariationId,
    );
    if (selected?.blobUrl) return selected.blobUrl;
  }
  // Fallback: first READY variation
  const first = creation.imageVariations.find(
    (v) => v.status === "READY" && v.blobUrl,
  );
  return first?.blobUrl ?? null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
      <Box sx={{ color: "primary.main", display: "flex", fontSize: "1rem" }}>
        {icon}
      </Box>
      <Typography
        sx={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Box sx={{ display: "flex", gap: 1, mb: 0.5 }}>
      <Typography
        sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", minWidth: 80 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.85)" }}>
        {value}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StepDelivery({ creation, onCreateAnother, onBackToProducts }: Props) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const promptRow = creation.prompt;
  const promptJson = tryParseVeo3Prompt(
    typeof promptRow?.promptJson === "string"
      ? promptRow.promptJson
      : promptRow?.promptJson
        ? JSON.stringify(promptRow.promptJson, null, 2)
        : null,
  );
  const promptText = promptJson
    ? JSON.stringify(promptJson, null, 2)
    : (promptRow?.promptText ?? null);

  const selectedImageUrl = getSelectedImageUrl(creation);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleCopyAll = async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // clipboard may be blocked — silently ignore
    }
  };

  const handleDownloadImage = async () => {
    if (!selectedImageUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(selectedImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hyppado-avatar-${creation.id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // download failed — silently ignore
    } finally {
      setDownloading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Box>
      {/* Success header */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3, gap: 1 }}>
        <CheckCircle sx={{ color: "primary.main", fontSize: "2.5rem" }} />
        <Typography
          sx={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#fff",
            textAlign: "center",
          }}
        >
          Seus ativos estão prontos!
        </Typography>
        <Typography
          sx={{
            fontSize: "0.8125rem",
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Baixe a imagem de referência e copie o roteiro VEO 3 para gerar seu vídeo.
        </Typography>
      </Box>

      {/* Platform notice */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 2,
          background: "rgba(45,212,255,0.06)",
          border: "1px solid rgba(45,212,255,0.18)",
          display: "flex",
          gap: 1.25,
          alignItems: "flex-start",
        }}
      >
        <InfoOutlined
          sx={{ color: "primary.main", fontSize: "1.1rem", mt: "1px", flexShrink: 0 }}
        />
        <Typography sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          <strong style={{ color: "#fff" }}>Nesta fase, o Hyppado não gera o vídeo final.</strong>{" "}
          Use a imagem de referência e o roteiro VEO 3 abaixo diretamente na ferramenta de geração
          de vídeo de sua preferência (como o VEO 3 do Google). O Hyppado prepara todos os insumos
          para você.
        </Typography>
      </Box>

      {/* Action buttons — top */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          startIcon={copiedAll ? <Check /> : <ContentCopy />}
          onClick={handleCopyAll}
          disabled={!promptText || copiedAll}
          sx={{
            flex: 1,
            minWidth: 140,
            fontWeight: 700,
            fontSize: "0.8125rem",
            bgcolor: "primary.main",
            color: "#000",
            "&:hover": { bgcolor: "primary.dark" },
            "&.Mui-disabled": { opacity: 0.5 },
          }}
        >
          {copiedAll ? "Copiado!" : "Copiar roteiro"}
        </Button>

        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleDownloadImage}
          disabled={!selectedImageUrl || downloading}
          sx={{
            flex: 1,
            minWidth: 140,
            fontWeight: 700,
            fontSize: "0.8125rem",
            borderColor: "rgba(255,255,255,0.2)",
            color: "#fff",
            "&:hover": { borderColor: "rgba(255,255,255,0.4)", bgcolor: "rgba(255,255,255,0.04)" },
            "&.Mui-disabled": { opacity: 0.4 },
          }}
        >
          {downloading ? "Baixando…" : "Baixar imagem"}
        </Button>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 3 }} />

      {/* Product */}
      <Box sx={{ mb: 3 }}>
        <SectionLabel icon={<Inventory2Outlined fontSize="inherit" />} label="Produto" />
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          {creation.productSelectedImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creation.productSelectedImageUrl}
              alt={creation.productName ?? "Produto"}
              style={{
                width: 56,
                height: 56,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}
            />
          )}
          <Box>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#fff",
                lineHeight: 1.4,
                mb: 0.5,
              }}
            >
              {creation.productName ?? "—"}
            </Typography>
            {creation.productCategory && (
              <Chip
                label={creation.productCategory}
                size="small"
                sx={{
                  height: 18,
                  fontSize: "0.65rem",
                  bgcolor: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Avatar */}
      <Box sx={{ mb: 3 }}>
        <SectionLabel icon={<PersonOutlined fontSize="inherit" />} label="Avatar" />
        {creation.uploadedAvatarImageUrl ? (
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={creation.uploadedAvatarImageUrl}
              alt="Avatar enviado"
              style={{
                width: 48,
                height: 48,
                objectFit: "cover",
                borderRadius: "50%",
                border: "2px solid rgba(45,212,255,0.3)",
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.7)" }}>
              Imagem enviada pelo usuário
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}>
            Avatar da biblioteca
          </Typography>
        )}
      </Box>

      {/* Scenario */}
      <Box sx={{ mb: 3 }}>
        <SectionLabel icon={<MovieOutlined fontSize="inherit" />} label="Cenário e roteiro" />
        <InfoRow label="Tom" value={creation.tone} />
        <InfoRow label="Duração" value={creation.duration} />
        <InfoRow
          label="Takes"
          value={creation.takeCount ? String(creation.takeCount) : null}
        />
        {creation.customScenarioDescription && (
          <Box
            sx={{
              mt: 1,
              p: 1.5,
              borderRadius: 1.5,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {creation.customScenarioDescription}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Generated image */}
      <Box sx={{ mb: 3 }}>
        <SectionLabel icon={<ImageOutlined fontSize="inherit" />} label="Imagem de referência gerada" />
        {selectedImageUrl ? (
          <Box
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid rgba(45,212,255,0.15)",
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImageUrl}
              alt="Imagem de referência gerada"
              style={{
                width: "100%",
                display: "block",
                borderRadius: 8,
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              textAlign: "center",
            }}
          >
            <Typography sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
              Nenhuma imagem disponível
            </Typography>
          </Box>
        )}
      </Box>

      {/* VEO 3 prompt */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <SectionLabel icon={<ContentCopy fontSize="inherit" />} label="Roteiro VEO 3 (JSON)" />
        </Box>
        {promptText ? (
          <Box
            sx={{
              position: "relative",
              borderRadius: 2,
              border: "1px solid rgba(45,212,255,0.12)",
              background: "rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                fontSize: "0.7rem",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.75)",
                fontFamily: "'Fira Mono', 'Consolas', monospace",
                overflowX: "auto",
                maxHeight: 320,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {promptText}
            </Box>
          </Box>
        ) : (
          <Typography sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
            Roteiro não disponível
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 3 }} />

      {/* Bottom navigation buttons */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={<AddCircleOutline />}
          onClick={onCreateAnother}
          fullWidth
          sx={{
            fontWeight: 700,
            fontSize: "0.8125rem",
            borderColor: "rgba(45,212,255,0.3)",
            color: "primary.main",
            "&:hover": { borderColor: "primary.main", bgcolor: "rgba(45,212,255,0.06)" },
          }}
        >
          Criar outro vídeo
        </Button>

        <Button
          variant="text"
          startIcon={<ArrowBack />}
          onClick={onBackToProducts}
          fullWidth
          sx={{
            fontWeight: 600,
            fontSize: "0.8125rem",
            color: "rgba(255,255,255,0.5)",
            "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.04)" },
          }}
        >
          Voltar para produtos
        </Button>
      </Box>
    </Box>
  );
}
