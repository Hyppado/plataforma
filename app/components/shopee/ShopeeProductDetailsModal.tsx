/**
 * app/components/shopee/ShopeeProductDetailsModal.tsx
 *
 * Modal de detalhes para produtos do ranking da Shopee.
 * Exibe: imagem (com fallback), nome, preço, comissão, vendas, receita,
 * loja, avaliação, botão "Página do produto" e botão "Criar Vídeo com Avatar".
 *
 * Layout de duas colunas — idêntico ao modal de "Produtos em Alta"
 * (app/components/cards/ProductDetailsModal.tsx):
 * - Coluna esquerda: imagem em aspect-ratio square com badges sobrepostos
 * - Coluna direita: título, preço, comissão inline, grid DESEMPENHO
 *
 * Dedicado à Shopee — sem dependência de componentes do TikTok.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  TrendingUp,
  ShoppingCart,
  Store,
  AttachMoney,
  Star,
  FaceRetouchingNatural,
} from "@mui/icons-material";
import { formatNumber } from "@/lib/format";
import type { ShopeeProductTrendDTO } from "@/lib/swr/useShopee";

// ── palette ────────────────────────────────────────────────────
const ACCENT = "#2DD4FF";
const BG = "#0A0F18";
const CARD_BG = "#0D1422";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "rgba(255,255,255,0.92)";
const TEXT_SECONDARY = "rgba(255,255,255,0.65)";
const TEXT_MUTED = "rgba(255,255,255,0.38)";

interface ShopeeProductDetailsModalProps {
  open: boolean;
  onClose: () => void;
  product: ShopeeProductTrendDTO;
}

// ── Mini-card de métrica (mesma classe do ProductDetailsModal) ──

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

// ── Imagem do produto com badges sobrepostos ────────────────────

function ProductImage({
  product,
  fallbackImg,
}: {
  product: ShopeeProductTrendDTO;
  fallbackImg: string;
}) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
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
      {!imgLoaded && !imgError && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #0A0F18 0%, #151C2A 100%)",
          }}
        />
      )}
      {imgError ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            width: "100%",
            height: "100%",
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1,
              background: "rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.2)",
            }}
          >
            <ShoppingCart sx={{ fontSize: 24 }} />
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>
            Imagem indisponível
          </Typography>
        </Box>
      ) : (
        <Box
          component="img"
          src={product.coverUrl || fallbackImg}
          alt={product.productName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setImgLoaded(false);
            setImgError(true);
          }}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      )}

      {/* Badges sobrepostos no canto inferior da imagem */}
      <Box
        sx={{
          position: "absolute",
          bottom: 8,
          left: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          zIndex: 2,
        }}
      >
        {product.rankPosition <= 3 && (
          <Chip
            icon={<TrendingUp sx={{ fontSize: "12px !important" }} />}
            label="Em alta"
            size="small"
            sx={{
              height: 22,
              fontSize: "0.62rem",
              fontWeight: 700,
              background: "rgba(74,222,128,0.9)",
              color: "#052e12",
              border: "none",
              backdropFilter: "blur(4px)",
              "& .MuiChip-icon": { color: "#052e12" },
            }}
          />
        )}
        <Chip
          label="Shopee"
          size="small"
          sx={{
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
    </Box>
  );
}

// ── Modal principal ─────────────────────────────────────────────

export function ShopeeProductDetailsModal({
  open,
  onClose,
  product,
}: ShopeeProductDetailsModalProps) {
  const router = useRouter();

  // Fallback de imagem quando a URL da Shopee falha
  const fallbackImg =
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400";

  // GMV calculado dinamicamente: a API de afiliados da Shopee não retorna
  // o campo GMV pronto, então derivamos de preço × vendas.
  const calculatedGmv = (product.price || 0) * (product.saleCount || 0);

  const handleCreateVideo = () => {
    const params = new URLSearchParams();
    params.set("shopeeProductId", product.productExternalId);
    params.set("productName", product.productName);
    params.set("productImageUrl", product.coverUrl || fallbackImg);
    params.set("productPrice", String(product.price || 0));
    router.push(`/dashboard/influencer-ia?${params.toString()}`);
  };

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
          title={product.productName}
        >
          {product.productName}
        </Typography>

        <Tooltip title="Abrir na Shopee" arrow>
          <span>
            <IconButton
              size="small"
              component="a"
              href={product.affiliateLink || undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir na Shopee"
              sx={{
                color: TEXT_SECONDARY,
                "&:hover": { color: ACCENT },
                "&.Mui-disabled": { color: "rgba(255,255,255,0.2)" },
              }}
            >
              <OpenInNew sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>

        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            color: TEXT_SECONDARY,
            "&:hover": { color: TEXT_PRIMARY },
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
            <ProductImage product={product} fallbackImg={fallbackImg} />
          </Grid>

          {/* Coluna direita — Header e Info */}
          <Grid item xs={12} sm={7} md={8}>
            {/* Preço + comissão */}
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
                  R$ {product.price.toFixed(2)}
                </Typography>
                {/* Comissão inline — texto ao lado do preço */}
                <Typography sx={{ fontSize: "0.8rem", color: TEXT_MUTED }}>
                  Comissão:{" "}
                  <Box component="span" sx={{ color: "#4ADE80", fontWeight: 700 }}>
                    {(product.commissionRate * 100).toFixed(1)}%
                  </Box>
                </Typography>
              </Box>
            </Box>

            {/* DESEMPENHO — grid de mini-cards escuros */}
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
              <Grid item xs={6} sm={6}>
                <MetricCell
                  icon={<ShoppingCart sx={{ fontSize: 13 }} />}
                  label="Vendas totais"
                  value={formatNumber(product.saleCount)}
                />
              </Grid>
              <Grid item xs={6} sm={6}>
                <MetricCell
                  icon={<AttachMoney sx={{ fontSize: 13 }} />}
                  label="Receita"
                  value={`R$ ${formatNumber(calculatedGmv)}`}
                />
              </Grid>
              {product.shopName && (
                <Grid item xs={6} sm={6}>
                  <MetricCell
                    icon={<Store sx={{ fontSize: 13 }} />}
                    label="Loja"
                    value={product.shopName}
                  />
                </Grid>
              )}
              {product.rating > 0 && (
                <Grid item xs={6} sm={6}>
                  <MetricCell
                    icon={<Star sx={{ fontSize: 13 }} />}
                    label="Avaliação"
                    value={product.rating.toFixed(1)}
                  />
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
      </DialogContent>

      {/* Footer CTA */}
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
        {product.affiliateLink && (
          <Button
            fullWidth
            variant="contained"
            component="a"
            href={product.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<OpenInNew />}
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
            Página do produto
          </Button>
        )}

        <Button
          fullWidth
          variant="contained"
          startIcon={<FaceRetouchingNatural />}
          onClick={handleCreateVideo}
          sx={{
            background: "linear-gradient(90deg, #FF2D78 0%, #e0256a 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.9rem",
            textTransform: "none",
            borderRadius: 2,
            py: 1.25,
            boxShadow: "none",
            "&:hover": {
              background: "linear-gradient(90deg, #e0256a 0%, #c01d58 100%)",
              boxShadow: "0 4px 16px rgba(255,45,120,0.3)",
            },
          }}
        >
          Criar Vídeo com Avatar
        </Button>
      </Box>
    </Dialog>
  );
}