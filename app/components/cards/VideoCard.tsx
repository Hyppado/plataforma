"use client";

import { useState, useCallback } from "react";
import { Box, Chip } from "@mui/material";
import { PlayArrowRounded } from "@mui/icons-material";
import type { VideoDTO } from "@/lib/types/dto";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useSavedVideos, useSavedProducts } from "@/lib/storage/saved";
import { TranscriptDialog } from "@/app/components/videos/TranscriptDialog";
import { InsightDialog } from "@/app/components/videos/InsightDialog";
import { UI } from "./videoCardConfig";
import { RankBadge } from "./RankBadge";
import { VideoCardSkeleton } from "./VideoCardSkeleton";
import { VideoCardProduct } from "./VideoCardProduct";
import { VideoCardMetrics } from "./VideoCardMetrics";
import { VideoCardActions } from "./VideoCardActions";

type TranscriptUIStatus =
  | "idle"
  | "loading"
  | "READY"
  | "FAILED";

interface VideoCardProps {
  video?: VideoDTO;
  rank?: number;
  isLoading?: boolean;
}

export function VideoCard({ video, rank, isLoading = false }: VideoCardProps) {
  const savedVideos = useSavedVideos();
  const savedProducts = useSavedProducts();

  const [isPressed, setIsPressed] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [transcriptStatus, setTranscriptStatus] =
    useState<TranscriptUIStatus>("idle");
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const hasTikTokUrl = !!video?.tiktokUrl;
  const hasThumbnail = !!video?.thumbnailUrl;

  const displayProduct = video?.product ?? null;
  const hasRealProduct = !!video?.product;

  const saved = video ? savedVideos.isSaved(video.id) : false;
  const productSaved =
    displayProduct && hasRealProduct
      ? savedProducts.isSaved(video!.product!.id)
      : false;

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!video) return;
    savedVideos.toggle(video);
  };

  const handleProductSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!video?.product) return;
    savedProducts.toggle(video.product);
  };

  const handleTranscribe = useCallback(async () => {
    if (!video) return;
    setTranscriptOpen(true);

    // If already ready, just show it
    if (transcriptStatus === "READY" && transcriptText) return;

    setTranscriptStatus("loading");
    try {
      const res = await fetch("/api/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoExternalId: video.id }),
      });

      if (res.status === 429) {
        setTranscriptStatus("FAILED");
        setTranscriptText(null);
        setTranscriptError("Cota de transcrições excedida. Aguarde o próximo período.");
        return;
      }

      if (!res.ok) {
        setTranscriptStatus("FAILED");
        setTranscriptError(null);
        return;
      }

      const data = await res.json();
      setTranscriptStatus(data.status ?? "FAILED");
      setTranscriptText(data.transcriptText ?? null);
      setTranscriptError(data.errorMessage ?? null);
    } catch {
      setTranscriptStatus("FAILED");
      setTranscriptError(null);
    }
  }, [video, transcriptStatus, transcriptText]);

  const handleTranscriptRetry = useCallback(async () => {
    if (!video) return;
    setTranscriptStatus("loading");
    try {
      const res = await fetch("/api/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoExternalId: video.id }),
      });
      if (!res.ok) {
        setTranscriptStatus("FAILED");
        return;
      }
      const data = await res.json();
      setTranscriptStatus(data.status ?? "FAILED");
      setTranscriptText(data.transcriptText ?? null);
      setTranscriptError(data.errorMessage ?? null);
    } catch {
      setTranscriptStatus("FAILED");
      setTranscriptError(null);
    }
  }, [video]);

  const handleOpenTikTok = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!video || !hasTikTokUrl) return;
    window.open(video.tiktokUrl, "_blank", "noopener,noreferrer");
  };

  if (isLoading || !video) return <VideoCardSkeleton />;

  return (
    <Box
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      sx={{
        position: "relative",
        borderRadius: UI.card.radius,
        overflow: "hidden",
        background: UI.card.bg,
        border: `1px solid ${UI.card.border}`,
        transition: "all 160ms cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: UI.card.shadow,
        "&:hover": {
          background: UI.card.bgHover,
          borderColor: UI.card.borderHover,
          boxShadow: UI.card.shadowHover,
          transform: "translateY(-2px)",
        },
        ...(isPressed && { transform: "scale(0.98)" }),
      }}
    >
      {/* Thumbnail — clickable to open TikTok */}
      <Box
        className="thumbLink"
        onClick={handleOpenTikTok}
        role="button"
        tabIndex={0}
        aria-label={`Abrir vídeo ${video.title || video.id} no TikTok`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenTikTok(e as any);
          }
        }}
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: { xs: "4 / 5", sm: "4 / 5", md: "9 / 16" },
          overflow: "hidden",
          background:
            "linear-gradient(160deg, #0d1420 0%, #151c2a 50%, #0f1724 100%)",
          cursor: hasTikTokUrl ? "pointer" : "default",
          outline: "none",
          transition: "transform 180ms ease, filter 180ms ease",
          "&:hover": hasTikTokUrl ? { transform: "translateY(-1px)" } : {},
          "&:focus-visible": {
            boxShadow: "0 0 0 3px rgba(45, 212, 255, 0.35)",
          },
        }}
      >
        {hasThumbnail && (
          <Box
            component="img"
            src={video.thumbnailUrl!}
            alt={video.title}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Gradient overlay */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.18) 100%)",
            opacity: 0.9,
            pointerEvents: "none",
          }}
        />

        {/* Play icon */}
        {hasTikTokUrl && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "999px",
                background: "rgba(10, 15, 24, 0.35)",
                border: "1px solid rgba(255,255,255,0.14)",
                backdropFilter: "blur(8px)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
                opacity: 0.55,
                transform: "scale(0.98)",
                transition:
                  "opacity 160ms ease, transform 160ms ease, border-color 160ms ease",
                ".thumbLink:hover &": {
                  opacity: 0.78,
                  transform: "scale(1.02)",
                  borderColor: "rgba(255,255,255,0.22)",
                },
              }}
            >
              <PlayArrowRounded
                sx={{ fontSize: 22, color: "rgba(255,255,255,0.85)" }}
              />
            </Box>
          </Box>
        )}

        {rank !== undefined && <RankBadge rank={rank} />}

        {video.roas >= 3 && (
          <Chip
            size="small"
            label={`ROAS ${video.roas.toFixed(1)}x`}
            sx={{
              position: "absolute",
              bottom: { xs: 6, md: 8 },
              left: { xs: 6, md: 8 },
              zIndex: 5,
              height: { xs: 20, md: 22 },
              fontSize: { xs: "0.6rem", md: "0.65rem" },
              fontWeight: 700,
              background: `${UI.accent}E6`,
              color: "#06080F",
              boxShadow: "0 2px 10px rgba(45,212,255,0.35)",
            }}
          />
        )}
      </Box>

      {/* Content */}
      <Box sx={{ p: { xs: 0.9, sm: 0.9, md: 1.5 } }}>
        {displayProduct && (
          <VideoCardProduct
            product={displayProduct}
            thumbnailFallback={video.thumbnailUrl}
            isSaved={!!productSaved}
            onSave={handleProductSave}
            hasRealProduct={hasRealProduct}
          />
        )}

        <VideoCardMetrics
          revenueBRL={video.revenueBRL}
          views={video.views}
          sales={video.sales}
          currency={video.currency}
        />

        <VideoCardActions
          saved={saved}
          onTranscribe={handleTranscribe}
          onInsight={() => setInsightOpen(true)}
          onSave={handleSave}
        />
      </Box>

      {/* Dialogs */}
      <TranscriptDialog
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        transcriptText={transcriptText}
        videoTitle={video.title}
        status={transcriptStatus}
        errorMessage={transcriptError}
        onRetry={handleTranscriptRetry}
      />
      <InsightDialog
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        promptText={generatePrompt(video)}
        videoTitle={video.title}
      />
    </Box>
  );
}

/* ---- helpers ---- */

function generatePrompt(video: VideoDTO): string {
  const metricsSummary =
    [
      video.views > 0 ? `Views: ${formatNumber(video.views)}` : null,
      video.sales > 0 ? `Vendas: ${formatNumber(video.sales)}` : null,
      video.revenueBRL > 0
        ? `GMV: ${formatCurrency(video.revenueBRL, video.currency)}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ") || "—";

  return `Você é um gerador de roteiro curto inspirado em um vídeo do TikTok Shop.

Regras:
- Português do Brasil, linguagem simples, sem emojis.
- Estrutura: Hook (1 frase) -> Contexto (2 frases) -> Prova/Detalhes (3 bullets) -> CTA (1 frase).
- Sem prometer milagre. Tom de curadoria: 'eu filtro pra você'.

Dados do vídeo:
- Título: ${video.title || "—"}
- Creator: ${video.creatorHandle || "—"}
- Resumo de métricas: ${metricsSummary}

Entregue:
1) Roteiro falado (até 20 segundos)
2) 3 variações de hook
3) 1 CTA curto para 'salvar'`;
}
