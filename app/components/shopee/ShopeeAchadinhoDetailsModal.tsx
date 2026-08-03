/**
 * app/components/shopee/ShopeeAchadinhoDetailsModal.tsx
 *
 * Modal de detalhes para "Achadinhos Shopee".
 *
 * SEPARAÇÃO DE LINKS (correção crítica):
 * - Botão "Comprar na Shopee" → usa estritamente shopeeAffiliateUrl (affiliateLink)
 * - Botão/Abrir "Ver no TikTok" → usa estritamente tiktokVideoUrl (videoUrl)
 *
 * Exibe exatamente 5 métricas formatadas corretamente:
 * 1. Receita          — price × sales (BRL)
 * 2. Views no TikTok  — play_count da EchoTik (ex: 1.0M, 25K)
 * 3. Vendas           — saleCount da Shopee (formatado)
 * 4. Comissão         — commission da Shopee (%)
 * 5. Preço            — price da Shopee (BRL)
 */

"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  Chip,
  Tooltip,
  Button,
  Grid,
} from "@mui/material";
import {
  Close,
  OpenInNew,
  ShoppingCart,
  SmartDisplay,
  AttachMoney,
  Percent,
  TrendingUp,
} from "@mui/icons-material";
import { formatNumber } from "@/lib/format";
import type { ShopeeAchadinhoDTO } from "@/lib/swr/useShopee";

// ── palette ────────────────────────────────────────────────────
const ACCENT = "#2DD4FF";
const BG = "#0A0F18";
const CARD_BG = "#0D1422";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "rgba(255,255,255,0.92)";
const TEXT_SECONDARY = "rgba(255,255,255,0.65)";
const TEXT_MUTED = "rgba(255,255,255,0.38)";

interface ShopeeAchadinhoDetailsModalProps {
  open: boolean;
  onClose: () => void;
  achadinho: ShopeeAchadinhoDTO;
}

// ── Mini-card de métrica ────────────────────────────────────────

function MetricCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Box
      sx={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 2,
        p: { xs: 1, sm: 1.5 },
        display: "flex",
        flexDirection: "column",
        gap: 0.25,
        height: "100%",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Box sx={{ color: TEXT_MUTED, display: "flex" }}>{icon}</Box>
        <Typography
          sx={{
            fontSize: "0.65rem",
            color: TEXT_MUTED,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: { xs: "0.85rem", sm: "0.95rem" },
          fontWeight: 700,
          color: TEXT_PRIMARY,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

// ── Formatação de moeda BRL ─────────────────────────────────────

function formatBRL(value: number | null | undefined): string {
  if (!value || value <= 0) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ── Modal principal ─────────────────────────────────────────────

export function ShopeeAchadinhoDetailsModal({
  open,
  onClose,
  achadinho,
}: ShopeeAchadinhoDetailsModalProps) {
  const [imgError, setImgError] = useState(false);

  // shopeeAffiliateUrl — link de venda/compra (estritamente Shopee)
  const shopeeAffiliateUrl = achadinho.affiliateLink || "";

  // tiktokVideoUrl — link do vídeo no TikTok (estritamente TikTok)
  const tiktokVideoUrl = achadinho.videoUrl || "";

  // Receita dinâmica = preço × vendas (ambos vindos da Shopee)
  const revenue = (achadinho.price ?? 0) * achadinho.saleCount;

  const fallbackImg =
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400";

  const imgSrc =
    !imgError && (achadinho.productImageUrl || achadinho.coverUrl)
      ? (achadinho.productImageUrl || achadinho.coverUrl)!
      : fallbackImg;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 3,
          width: { xs: "100%", sm: "92vw", md: 880 },
          maxWidth: 880,
          maxHeight: "96vh",
          overflow: "hidden",
          m: { xs: 0, sm: 2 },
        },
      }}
    >
      {/* Header: título + ações */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 2, sm: 3 },
          py: 1.75,
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
          // Garante que o header (com o botão "X") fique ACIMA de qualquer
          // camada do DialogContent que possa interceptar o clique.
          position: "relative",
          zIndex: 10,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          noWrap
          sx={{
            flex: 1,
            color: TEXT_PRIMARY,
            fontSize: { xs: "0.9rem", sm: "1rem" },
          }}
          title={achadinho.productName || achadinho.videoTitle || "Achadinho Shopee"}
        >
          {achadinho.productName || achadinho.videoTitle || "Achadinho Shopee"}
        </Typography>

        {/* Link do TikTok (tiktokVideoUrl) — separado do link de compra */}
        {tiktokVideoUrl && (
          <Tooltip title="Abrir no TikTok" arrow>
            <IconButton
              size="small"
              component="a"
              href={tiktokVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir vídeo no TikTok"
              sx={{
                color: TEXT_SECONDARY,
                "&:hover": { color: ACCENT },
              }}
            >
              <SmartDisplay sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}

        <IconButton
          size="small"
          type="button"
          aria-label="Fechar"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          sx={{
            color: TEXT_SECONDARY,
            "&:hover": { color: TEXT_PRIMARY },
            // z-index reforçado para garantir que o clique chegue ao botão.
            position: "relative",
            zIndex: 20,
          }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Body: duas colunas */}
      <DialogContent sx={{ p: { xs: 1.5, sm: 2 }, overflowY: "auto" }}>
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {/* Coluna esquerda — Imagem */}
          <Grid item xs={12} sm={5} md={4}>
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 2,
                overflow: "hidden",
                background:
                  "linear-gradient(135deg, #0d1420 0%, #151c2a 100%)",
              }}
            >
              <Box
                component="img"
                src={imgSrc}
                alt={achadinho.productName || achadinho.videoTitle || ""}
                onError={() => setImgError(true)}
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              {/* Badge Shopee */}
              <Chip
                label="Shopee"
                size="small"
                sx={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  height: 22,
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  background: "rgba(238,77,45,0.9)",
                  color: "#fff",
                  border: "none",
                  backdropFilter: "blur(4px)",
                }}
              />
            </Box>
          </Grid>

          {/* Coluna direita — Info */}
          <Grid item xs={12} sm={7} md={8}>
            {/* Preço + receita */}
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 1.25,
                  mb: 0.5,
                  flexWrap: "wrap",
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: "1.5rem", sm: "1.8rem" },
                    fontWeight: 800,
                    color: ACCENT,
                    lineHeight: 1,
                  }}
                >
                  {formatBRL(achadinho.price)}
                </Typography>
                {achadinho.commission != null && achadinho.commission > 0 && (
                  <Typography sx={{ fontSize: "0.8rem", color: TEXT_MUTED }}>
                    Comissão:{" "}
                    <Box component="span" sx={{ color: "#4ADE80", fontWeight: 700 }}>
                      {(achadinho.commission * 100).toFixed(1)}%
                    </Box>
                  </Typography>
                )}
              </Box>
            </Box>

            {/* 5 MÉTRICAS EXPLÍCITAS */}
            <Typography
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: TEXT_MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                mb: 1,
              }}
            >
              Desempenho
            </Typography>

            <Grid container spacing={1}>
              {/* 1. Receita (price × sales) em BRL */}
              <Grid item xs={6} sm={6}>
                <MetricCell
                  icon={<TrendingUp sx={{ fontSize: 13 }} />}
                  label="Receita"
                  value={formatBRL(revenue)}
                />
              </Grid>

              {/* 2. Views no TikTok (play_count da EchoTik) */}
              <Grid item xs={6} sm={6}>
                <MetricCell
                  icon={<SmartDisplay sx={{ fontSize: 13 }} />}
                  label="Views no TikTok"
                  value={achadinho.views > 0 ? formatNumber(achadinho.views) : "-"}
                />
              </Grid>

              {/* 3. Vendas (saleCount da Shopee) */}
              <Grid item xs={6} sm={6}>
                <MetricCell
                  icon={<ShoppingCart sx={{ fontSize: 13 }} />}
                  label="Vendas"
                  value={achadinho.saleCount > 0 ? formatNumber(achadinho.saleCount) : "-"}
                />
              </Grid>

              {/* 4. Comissão (commission da Shopee) */}
              <Grid item xs={6} sm={6}>
                <MetricCell
                  icon={<Percent sx={{ fontSize: 13 }} />}
                  label="Comissão"
                  value={
                    achadinho.commission != null && achadinho.commission > 0
                      ? `${(achadinho.commission * 100).toFixed(1).replace(".", ",")}%`
                      : "-"
                  }
                />
              </Grid>

              {/* 5. Preço (price da Shopee) em BRL */}
              <Grid item xs={6} sm={6}>
                <MetricCell
                  icon={<AttachMoney sx={{ fontSize: 13 }} />}
                  label="Preço"
                  value={formatBRL(achadinho.price)}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </DialogContent>

      {/* Footer CTA — separação rigorosa de links */}
      <Box
        sx={{
          px: { xs: 1.5, sm: 2 },
          pb: { xs: 1.5, sm: 2 },
          pt: 0,
          flexShrink: 0,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1,
        }}
      >
        {/* Botão de COMPRA → shopeeAffiliateUrl (link de venda da Shopee) */}
        {shopeeAffiliateUrl && (
          <Button
            fullWidth
            variant="contained"
            component="a"
            href={shopeeAffiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<ShoppingCart />}
            sx={{
              background: "#EE4D2D",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9rem",
              textTransform: "none",
              borderRadius: 2,
              py: 1.25,
              boxShadow: "none",
              "&:hover": {
                background: "#D9431F",
                boxShadow: "0 4px 16px rgba(238,77,45,0.3)",
              },
            }}
          >
            Comprar na Shopee
          </Button>
        )}

        {/* Botão de VÍDEO → tiktokVideoUrl (embed/player do TikTok) */}
        {tiktokVideoUrl && (
          <Button
            fullWidth
            variant="outlined"
            component="a"
            href={tiktokVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<OpenInNew />}
            sx={{
              color: ACCENT,
              borderColor: "rgba(45,212,255,0.35)",
              fontWeight: 600,
              fontSize: "0.9rem",
              textTransform: "none",
              borderRadius: 2,
              py: 1.25,
              "&:hover": {
                borderColor: ACCENT,
                background: "rgba(45,212,255,0.08)",
              },
            }}
          >
            Ver Vídeo no TikTok
          </Button>
        )}
      </Box>
    </Dialog>
  );
}