/**
 * app/components/shopee/ShopeeAchadinhoCard.tsx
 *
 * Card de vídeo para "Achadinhos Shopee".
 *
 * SEPARAÇÃO DE LINKS (correção crítica):
 * - Clique no produto / redirecionamento de compra → shopeeAffiliateUrl (affiliateLink)
 * - Embed do vídeo ou "Abrir no TikTok" → tiktokVideoUrl (videoUrl)
 *
 * Exibe EXATAMENTE 5 dados formatados corretamente:
 * 1. Receita          — price × sales (calculado dinamicamente, em BRL)
 * 2. Views no TikTok  — quantidade de visualizações (vinda da Echotik), formatada (ex: 1.0M, 25K)
 * 3. Vendas           — quantidade de vendas (vinda da Shopee), formatada
 * 4. Comissão         — valor da comissão (vinda da Shopee)
 * 5. Preço            — preço do produto em BRL (vindo da Shopee)
 */

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  Typography,
  Button,
  ButtonBase,
  CircularProgress,
} from "@mui/material";
import {
  PlayArrowRounded,
  Edit,
  TrendingUp,
  SmartDisplay,
  ShoppingCart,
  Percent,
  AttachMoney,
  Subtitles,
  AutoAwesome,
  Download,
  Bookmark,
  BookmarkBorder,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import type { ShopeeAchadinhoDTO } from "@/lib/swr/useShopee";
import { formatNumber } from "@/lib/format";
import { UI } from "@/app/components/cards/videoCardConfig";
import { RankBadge } from "@/app/components/cards/RankBadge";
import { TikTokPlayerModal } from "@/app/components/videos/TikTokPlayerModal";
import { TranscriptDialog } from "@/app/components/videos/TranscriptDialog";
import {
  InsightDialog,
  type InsightData,
} from "@/app/components/videos/InsightDialog";
import { useSavedVideos } from "@/lib/storage/saved";
import { toVideoDTO } from "@/lib/shopee/adapters";
import { EditAffiliateModal } from "./EditAffiliateModal";
import { ShopeeAchadinhoDetailsModal } from "./ShopeeAchadinhoDetailsModal";

export interface ShopeeAchadinhoCardProps {
  achadinho: ShopeeAchadinhoDTO;
  rank?: number;
  onUpdate?: () => void;
}

// ── Formatação BRL ──────────────────────────────────────────────

function formatBRL(value: number | null | undefined): string {
  if (!value || value <= 0) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ShopeeAchadinhoCard({
  achadinho,
  rank,
  onUpdate,
}: ShopeeAchadinhoCardProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const savedVideos = useSavedVideos();

  const [isPressed, setIsPressed] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [insightStatus, setInsightStatus] = useState<
    "idle" | "loading" | "READY" | "FAILED"
  >("idle");
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Salvar — reutiliza useSavedVideos (mesma lógica do "Vídeos em Alta")
  // Converte o Achadinho em VideoDTO para aparecer na aba "Vídeos Salvos"
  const videoDTO = toVideoDTO(achadinho);
  const videoExternalId = achadinho.videoExternalId;
  const saved = savedVideos.isSaved(videoExternalId);

  // Separação rigorosa de links:
  // shopeeAffiliateUrl — link de venda/compra (estritamente Shopee)
  const shopeeAffiliateUrl = achadinho.affiliateLink || "";
  // tiktokVideoUrl — link do vídeo no TikTok (embed/player)
  const tiktokVideoUrl = achadinho.videoUrl || "";

  const hasThumbnail = !!achadinho.coverUrl;
  const hasRealProduct = !!achadinho.productName;

  // 1. Receita dinâmica = preço × vendas (ambos da Shopee)
  const revenue = (achadinho.price ?? 0) * achadinho.saleCount;

  const handleOpenTikTok = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tiktokVideoUrl) return;
    setPlayerOpen(true);
  };

  // Os detalhes do produto agora abrem SOMENTE ao clicar no mini-card
  // do produto (igual ao TikTok Shop). Clicar no card/vídeo/botões NÃO
  // abre os detalhes.
  const handleProductCardClick = () => {
    if (hasRealProduct) {
      setProductModalOpen(true);
    }
  };

  // ── Ações do card (funcionalidades reais, mesmas do TikTok Shop) ──

  // Download do vídeo — a rota resolve a URL na EchoTik (assinada, expira) e
  // devolve o arquivo com Content-Disposition, senão o navegador só abriria
  // o vídeo numa aba em vez de baixar.
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;

    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/shopee/achadinhos/${achadinho.id}/download`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDownloadError(body.error ?? "Não foi possível baixar o vídeo.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="(.+?)"/)?.[1] ??
        `${achadinho.videoExternalId}.mp4`;
      // Precisa estar no DOM para o clique valer em todos os navegadores
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Falha de conexão ao baixar o vídeo.");
    } finally {
      setDownloading(false);
    }
  };

  // Transcrição: abre o TranscriptDialog já existente com o texto do achadinho
  const handleTranscribe = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTranscriptOpen(true);
  };

  // Insight Hyppado: chama a API /api/insights e abre o InsightDialog
  const handleInsight = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setInsightOpen(true);
    setInsightStatus("loading");
    setInsightError(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoExternalId: achadinho.videoExternalId,
          videoTitle: achadinho.videoTitle || achadinho.productName || undefined,
        }),
      });

      if (res.status === 429) {
        setInsightStatus("FAILED");
        setInsightData(null);
        setInsightError(
          "Cota de insights excedida. Aguarde o próximo período.",
        );
        return;
      }

      if (!res.ok) {
        setInsightStatus("FAILED");
        setInsightError(null);
        return;
      }

      const data = await res.json();
      setInsightStatus(data.status ?? "FAILED");
      if (data.status === "READY") {
        setInsightData({
          contextText: data.contextText ?? null,
          hookText: data.hookText ?? null,
          problemText: data.problemText ?? null,
          solutionText: data.solutionText ?? null,
          ctaText: data.ctaText ?? null,
          copyWorkedText: data.copyWorkedText ?? null,
        });
      }
      setInsightError(data.errorMessage ?? null);
    } catch {
      setInsightStatus("FAILED");
      setInsightError(null);
    }
  };

  const handleInsightRetry = async () => {
    setInsightStatus("loading");
    setInsightError(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoExternalId: achadinho.videoExternalId,
          videoTitle: achadinho.videoTitle || achadinho.productName || undefined,
        }),
      });
      if (!res.ok) {
        setInsightStatus("FAILED");
        return;
      }
      const data = await res.json();
      setInsightStatus(data.status ?? "FAILED");
      if (data.status === "READY") {
        setInsightData({
          contextText: data.contextText ?? null,
          hookText: data.hookText ?? null,
          problemText: data.problemText ?? null,
          solutionText: data.solutionText ?? null,
          ctaText: data.ctaText ?? null,
          copyWorkedText: data.copyWorkedText ?? null,
        });
      }
      setInsightError(data.errorMessage ?? null);
    } catch {
      setInsightStatus("FAILED");
      setInsightError(null);
    }
  };

  // Salvar: alterna o VÍDEO na biblioteca de vídeos salvos do usuário
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    savedVideos.toggle(videoDTO);
  };

  const statusConfig = getStatusConfig(achadinho.status);

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
        cursor: "default",
        "&:hover": {
          background: UI.card.bgHover,
          borderColor: UI.card.borderHover,
          boxShadow: UI.card.shadowHover,
          transform: "translateY(-2px)",
        },
        ...(isPressed && { transform: "scale(0.98)" }),
        "&:focus-visible": {
          outline: "none",
          boxShadow: "0 0 0 3px rgba(45, 212, 255, 0.35)",
        },
      }}
    >
      {/* Thumbnail — clique abre o TikTok (tiktokVideoUrl) */}
      <Box
        className="thumbLink"
        onClick={handleOpenTikTok}
        role="button"
        tabIndex={0}
        aria-label={`Assistir vídeo ${achadinho.videoTitle || achadinho.videoExternalId}`}
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
          cursor: tiktokVideoUrl ? "pointer" : "default",
          outline: "none",
          transition: "transform 180ms ease, filter 180ms ease",
          "&:hover": tiktokVideoUrl ? { transform: "translateY(-1px)" } : {},
          "&:focus-visible": {
            boxShadow: "0 0 0 3px rgba(45, 212, 255, 0.35)",
          },
        }}
      >
        {hasThumbnail && (
          <Box
            component="img"
            src={achadinho.coverUrl!}
            alt={achadinho.videoTitle || ""}
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
        {tiktokVideoUrl && (
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

        {/* Rank badge (topo esquerdo) */}
        {rank !== undefined && <RankBadge rank={rank} />}

        {/* Status badge (topo direito) */}
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            gap: 0.3,
            px: 0.6,
            py: 0.2,
            borderRadius: 1,
            background: statusConfig.background,
            backdropFilter: "blur(4px)",
          }}
        >
          {statusConfig.icon}
          <Box
            sx={{
              fontSize: "0.55rem",
              fontWeight: 700,
              color: statusConfig.color,
              lineHeight: 1,
            }}
          >
            {statusConfig.label}
          </Box>
        </Box>

        {/* Vendas chip (se aplicável) */}
        {achadinho.saleCount > 10 && (
          <Chip
            size="small"
            label={`${formatNumber(achadinho.saleCount)} vendas`}
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
        {/* Mini-card do produto — clique abre os detalhes (igual TikTok Shop).
            Clique no card/vídeo/botões NÃO abre os detalhes. */}
        <ButtonBase
          onClick={handleProductCardClick}
          disabled={!hasRealProduct}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: { xs: 1, md: 1.2 },
            p: { xs: 0.8, md: 1 },
            borderRadius: 3,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            width: "100%",
            textAlign: "left",
            cursor: hasRealProduct ? "pointer" : "default",
            transition: "background 150ms ease, border-color 150ms ease",
            "&:hover": hasRealProduct
              ? {
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(45,212,255,0.2)",
                }
              : {},
          }}
        >
          {/* Mini thumbnail do produto */}
          <Box
            component="img"
            src={achadinho.productImageUrl || achadinho.coverUrl || ""}
            alt={achadinho.productName || achadinho.videoTitle || "Achadinho Shopee"}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = "0.3";
            }}
            sx={{
              width: { xs: 44, md: 48 },
              height: { xs: 44, md: 48 },
              borderRadius: 2.5,
              objectFit: "cover",
              flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />

          {/* Info do produto */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: { xs: "0.78rem", md: "0.82rem" },
                fontWeight: 600,
                color: UI.text.primary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                mb: 0.2,
              }}
            >
              {achadinho.productName || achadinho.videoTitle || "Achadinho Shopee"}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "0.72rem", md: "0.76rem" },
                color: UI.accent,
                fontWeight: 600,
              }}
            >
              {formatBRL(achadinho.price)}
            </Typography>
          </Box>

          {/* Ícone de compra (shopeeAffiliateUrl) — abre a Shopee direto */}
          {shopeeAffiliateUrl && (
            <Tooltip title="Comprar na Shopee">
              <IconButton
                size="small"
                component="a"
                href={shopeeAffiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                sx={{
                  width: { xs: 28, md: 30 },
                  height: { xs: 28, md: 30 },
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  transition: "all 160ms ease",
                  "&:hover": {
                    background: "rgba(238,77,45,0.1)",
                    color: "#EE4D2D",
                    borderColor: "rgba(238,77,45,0.4)",
                  },
                }}
              >
                <ShoppingCart sx={{ fontSize: { xs: 14, md: 16 } }} />
              </IconButton>
            </Tooltip>
          )}
        </ButtonBase>

        {/* 5 MÉTRICAS EXPLÍCITAS — grid 2 colunas */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 0.5,
            mb: 1,
          }}
        >
          {/* 1. Receita — price × sales em BRL */}
          <MetricCell
            icon={<TrendingUp sx={{ fontSize: 11 }} />}
            label="Receita"
            value={formatBRL(revenue)}
            color={UI.accent}
          />
          {/* 2. Views no TikTok — da Echotik (play_count), formatado */}
          <MetricCell
            icon={<SmartDisplay sx={{ fontSize: 11 }} />}
            label="Views no TikTok"
            value={achadinho.views > 0 ? formatNumber(achadinho.views) : "-"}
            color={UI.text.primary}
          />
          {/* 3. Vendas — da Shopee (saleCount), formatado */}
          <MetricCell
            icon={<ShoppingCart sx={{ fontSize: 11 }} />}
            label="Vendas"
            value={achadinho.saleCount > 0 ? formatNumber(achadinho.saleCount) : "-"}
            color={UI.text.primary}
          />
          {/* 4. Comissão — da Shopee (commission) */}
          <MetricCell
            icon={<Percent sx={{ fontSize: 11 }} />}
            label="Comissão"
            value={
              achadinho.commission != null && achadinho.commission > 0
                ? `${(achadinho.commission * 100).toFixed(1).replace(".", ",")}%`
                : "-"
            }
            color={UI.text.primary}
          />
        </Box>

        {/* 5. Preço — da Shopee em BRL (destaque) */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.3,
            px: 0.75,
            py: 0.5,
            mb: 1,
            borderRadius: 2,
            background: "rgba(45,212,255,0.06)",
            border: "1px solid rgba(45,212,255,0.15)",
          }}
        >
          <AttachMoney sx={{ fontSize: 13, color: UI.accent }} />
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: UI.accent }}>
            {formatBRL(achadinho.price)}
          </Typography>
        </Box>

        {/* Ações do Card — espelha o layout do VideoCard (TikTok Shop) */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: 0.6, md: 0.75 },
          }}
        >
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Subtitles sx={{ fontSize: { xs: 15, md: 16 } }} />}
            onClick={handleTranscribe}
            sx={{
              py: { xs: 0.65, md: 0.75 },
              fontSize: { xs: "0.74rem", md: "0.78rem" },
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 3,
              color: UI.text.secondary,
              borderColor: "rgba(255,255,255,0.12)",
              transition: "all 160ms ease",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.04)",
                transform: "translateY(-1px)",
              },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            Transcrição
          </Button>

          <Tooltip title={downloadError ?? "Baixar o vídeo para repostar"} arrow>
            <span>
              <Button
                fullWidth
                variant="outlined"
                disabled={downloading}
                startIcon={
                  downloading ? (
                    <CircularProgress size={14} sx={{ color: "inherit" }} />
                  ) : (
                    <Download sx={{ fontSize: { xs: 15, md: 16 } }} />
                  )
                }
                onClick={handleDownload}
                sx={{
                  py: { xs: 0.65, md: 0.75 },
                  fontSize: { xs: "0.74rem", md: "0.78rem" },
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 3,
                  color: downloadError ? "#EF4444" : UI.text.secondary,
                  borderColor: downloadError
                    ? "rgba(239,68,68,0.4)"
                    : "rgba(255,255,255,0.12)",
                  transition: "all 160ms ease",
                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.22)",
                    background: "rgba(255,255,255,0.04)",
                    transform: "translateY(-1px)",
                  },
                  "&:active": { transform: "scale(0.98)" },
                }}
              >
                {downloading ? "Baixando..." : "Baixar vídeo"}
              </Button>
            </span>
          </Tooltip>

          <Button
            fullWidth
            variant="contained"
            startIcon={<AutoAwesome sx={{ fontSize: { xs: 15, md: 16 } }} />}
            onClick={handleInsight}
            sx={{
              background: UI.purple.bg,
              color: "#fff",
              fontWeight: 600,
              fontSize: { xs: "0.74rem", md: "0.78rem" },
              textTransform: "none",
              borderRadius: 3,
              py: { xs: 0.65, md: 0.75 },
              textShadow: "0 1px 2px rgba(0,0,0,0.2)",
              "&:hover": {
                background: UI.purple.bgHover,
                transform: "translateY(-1px)",
              },
              "&:active": { transform: "scale(0.98)" },
              transition: "all 160ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            Insight Hyppado
          </Button>

          {/* Salvar — ação secundária */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mt: { xs: 0.3, md: 0.4 },
            }}
          >
            <Button
              size="small"
              startIcon={
                saved ? (
                  <Bookmark sx={{ fontSize: 14 }} />
                ) : (
                  <BookmarkBorder sx={{ fontSize: 14 }} />
                )
              }
              onClick={handleSave}
              sx={{
                py: 0.5,
                px: 1.5,
                fontSize: "0.7rem",
                fontWeight: 500,
                textTransform: "none",
                borderRadius: 2,
                color: saved ? UI.accent : UI.text.muted,
                transition: "all 160ms ease",
                "&:hover": {
                  background: "rgba(255,255,255,0.04)",
                  color: UI.accent,
                },
              }}
            >
              {saved ? "Salvo" : "Salvar"}
            </Button>
          </Box>
        </Box>

        {/* Admin: Edit affiliate link */}
        {isAdmin && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
            <Tooltip title="Editar link do produto" arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditModalOpen(true);
                }}
                sx={{
                  color: "#F59E0B",
                  "&:hover": { background: alpha("#F59E0B", 0.1) },
                  p: 0.5,
                }}
              >
                <Edit sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Dialogs */}
      {tiktokVideoUrl && (
        <TikTokPlayerModal
          open={playerOpen}
          onClose={() => setPlayerOpen(false)}
          tiktokUrl={tiktokVideoUrl}
          videoTitle={achadinho.videoTitle ?? undefined}
        />
      )}
      {hasRealProduct && (
        <ShopeeAchadinhoDetailsModal
          open={productModalOpen}
          onClose={() => setProductModalOpen(false)}
          achadinho={achadinho}
        />
      )}
      {editModalOpen && (
        <EditAffiliateModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          product={achadinho}
          onSuccess={onUpdate}
        />
      )}
      {/* Transcrição — usa o texto da legenda/captions já salvo no achadinho */}
      <TranscriptDialog
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        transcriptText={achadinho.transcriptText}
        videoTitle={achadinho.videoTitle || achadinho.productName || undefined}
        status={achadinho.transcriptText ? "READY" : "idle"}
      />
      {/* Insight Hyppado — análise IA do vídeo */}
      <InsightDialog
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        videoTitle={achadinho.videoTitle || achadinho.productName || undefined}
        status={insightStatus}
        data={insightData}
        errorMessage={insightError}
        onRetry={() => void handleInsightRetry()}
      />
    </Box>
  );
}

/* ---- internal ---- */

function MetricCell({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Box
      sx={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 1.5,
        px: 0.75,
        py: 0.5,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, mb: 0.1 }}>
        <Box sx={{ color: "rgba(255,255,255,0.3)", display: "flex" }}>{icon}</Box>
        <Typography
          sx={{
            fontSize: "0.55rem",
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            lineHeight: 1.2,
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: { xs: "0.72rem", md: "0.78rem" },
          fontWeight: 700,
          color,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Retorna a configuração visual (cor, ícone, label) baseada no status do processamento.
 */
function getStatusConfig(status: string): {
  label: string;
  color: string;
  background: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "READY":
      return {
        label: "PRONTO",
        color: "#22C55E",
        background: "rgba(34, 197, 94, 0.15)",
        icon: (
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "#22C55E",
            }}
          />
        ),
      };
    case "PROCESSING":
      return {
        label: "PROC",
        color: "#F59E0B",
        background: "rgba(245, 158, 11, 0.15)",
        icon: (
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "#F59E0B",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ),
      };
    case "FAILED":
      return {
        label: "FALHA",
        color: "#EF4444",
        background: "rgba(239, 68, 68, 0.15)",
        icon: (
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "#EF4444",
            }}
          />
        ),
      };
    default:
      return {
        label: "PEND",
        color: "rgba(255,255,255,0.5)",
        background: "rgba(255,255,255,0.08)",
        icon: (
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "rgba(255,255,255,0.3)",
            }}
          />
        ),
      };
  }
}