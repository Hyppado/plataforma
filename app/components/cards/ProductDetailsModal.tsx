"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Grid,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import {
  Close,
  OpenInNew,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  ShoppingCart,
  Paid,
  Person,
  VideoLibrary,
  LiveTv,
  Star,
  LocalShipping,
  ChevronLeft,
  ChevronRight,
} from "@mui/icons-material";
import type { ProductDTO } from "@/lib/types/dto";
import type { ProductDetailResponse } from "@/app/api/trending/products/[id]/route";
import { formatCurrency, formatNumber } from "@/lib/format";
import { fetcher } from "@/lib/swr/fetcher";
import { useExchangeRate } from "@/lib/swr/useExchangeRate";

// ── palette ────────────────────────────────────────────────────
const ACCENT = "#2DD4FF";
const BG = "#0A0F18";
const CARD_BG = "#0D1422";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "rgba(255,255,255,0.92)";
const TEXT_SECONDARY = "rgba(255,255,255,0.65)";
const TEXT_MUTED = "rgba(255,255,255,0.38)";

// ── helpers ────────────────────────────────────────────────────

function TrendIcon({ flag }: { flag: 0 | 1 | 2 }) {
  if (flag === 1) return <TrendingUp sx={{ fontSize: 15, color: "#4ADE80" }} />;
  if (flag === 2)
    return <TrendingDown sx={{ fontSize: 15, color: "#F87171" }} />;
  return <TrendingFlat sx={{ fontSize: 15, color: TEXT_MUTED }} />;
}

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
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

// ── Image carousel ─────────────────────────────────────────────

function ImageCarousel({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) {
    return (
      <Box
        sx={{
          width: "100%",
          aspectRatio: "1 / 1",
          background: "linear-gradient(135deg, #0d1420 0%, #151c2a 100%)",
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Typography sx={{ color: TEXT_MUTED, fontSize: "0.75rem" }}>
          Sem imagem
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
      <Box
        component="img"
        src={images[idx]}
        alt={name}
        sx={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: 2,
          display: "block",
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      {/* Nav arrows */}
      {images.length > 1 && (
        <>
          <IconButton
            size="small"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            sx={{
              position: "absolute",
              left: 6,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.12)",
              width: 28,
              height: 28,
              "&:hover": { background: "rgba(0,0,0,0.75)" },
              "&:disabled": { opacity: 0.3 },
            }}
          >
            <ChevronLeft sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            size="small"
            disabled={idx === images.length - 1}
            onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))}
            sx={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.12)",
              width: 28,
              height: 28,
              "&:hover": { background: "rgba(0,0,0,0.75)" },
              "&:disabled": { opacity: 0.3 },
            }}
          >
            <ChevronRight sx={{ fontSize: 18 }} />
          </IconButton>

          {/* Dots */}
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 0.5,
            }}
          >
            {images.map((_, i) => (
              <Box
                key={i}
                onClick={() => setIdx(i)}
                sx={{
                  width: i === idx ? 16 : 6,
                  height: 6,
                  borderRadius: 99,
                  background: i === idx ? ACCENT : "rgba(255,255,255,0.35)",
                  cursor: "pointer",
                  transition: "all 180ms ease",
                }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Main modal ─────────────────────────────────────────────────

interface ProductDetailsModalProps {
  open: boolean;
  onClose: () => void;
  /** Base product data (shown immediately) */
  product: ProductDTO;
}

export function ProductDetailsModal({
  open,
  onClose,
  product,
}: ProductDetailsModalProps) {
  const { data: detail, isLoading } = useSWR<ProductDetailResponse>(
    open ? `/api/trending/products/${product.id}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const usdToBrl = useExchangeRate();

  const images = detail?.images ?? (product.imageUrl ? [product.imageUrl] : []);
  const currency = detail?.currency ?? product.currency ?? "USD";
  const name = detail?.name || product.name;

  const commissionText =
    detail?.commissionRate != null
      ? `${detail.commissionRate.toFixed(1)}%`
      : product.commissionRate != null
        ? `${product.commissionRate.toFixed(1)}%`
        : "—";

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
      {/* Header */}
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
          title={name}
        >
          {name}
        </Typography>

        <Tooltip title="Abrir no TikTok">
          <IconButton
            size="small"
            component="a"
            href={`https://www.tiktok.com/view/product/${product.id}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: TEXT_SECONDARY, "&:hover": { color: ACCENT } }}
          >
            <OpenInNew sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: TEXT_SECONDARY, "&:hover": { color: TEXT_PRIMARY } }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Body */}
      <DialogContent sx={{ p: { xs: 1.5, sm: 2 }, overflowY: "auto" }}>
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {/* Left — Image */}
          <Grid item xs={12} sm={5} md={4}>
            <ImageCarousel images={images} name={name} />

            {/* Tags */}
            <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {detail?.freeShipping && (
                <Chip
                  icon={<LocalShipping sx={{ fontSize: "14px !important" }} />}
                  label="Frete grátis"
                  size="small"
                  sx={{
                    fontSize: "0.7rem",
                    background: "rgba(74,222,128,0.12)",
                    color: "#4ADE80",
                    border: "1px solid rgba(74,222,128,0.25)",
                  }}
                />
              )}
              {detail?.salesTrend != null && (
                <Chip
                  icon={<TrendIcon flag={detail.salesTrend} />}
                  label={
                    detail.salesTrend === 1
                      ? "Em alta"
                      : detail.salesTrend === 2
                        ? "Em queda"
                        : "Estável"
                  }
                  size="small"
                  sx={{
                    fontSize: "0.7rem",
                    background:
                      detail.salesTrend === 1
                        ? "rgba(74,222,128,0.12)"
                        : detail.salesTrend === 2
                          ? "rgba(248,113,113,0.12)"
                          : "rgba(255,255,255,0.06)",
                    color:
                      detail.salesTrend === 1
                        ? "#4ADE80"
                        : detail.salesTrend === 2
                          ? "#F87171"
                          : TEXT_SECONDARY,
                    border: `1px solid ${
                      detail.salesTrend === 1
                        ? "rgba(74,222,128,0.25)"
                        : detail.salesTrend === 2
                          ? "rgba(248,113,113,0.25)"
                          : BORDER
                    }`,
                  }}
                />
              )}
              {!isLoading && !detail && null}
              {isLoading && (
                <Skeleton width={80} height={22} sx={{ borderRadius: 99 }} />
              )}
            </Box>
          </Grid>

          {/* Right — Details */}
          <Grid item xs={12} sm={7} md={8}>
            {/* Price + basics */}
            <Box sx={{ mb: 2 }}>
              {/* Price */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 1,
                  mb: 0.5,
                  flexWrap: "wrap",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "1.8rem",
                    fontWeight: 800,
                    color: ACCENT,
                    lineHeight: 1,
                  }}
                >
                  {detail
                    ? formatCurrency(detail.avgPrice, currency, usdToBrl)
                    : formatCurrency(product.priceBRL, currency, usdToBrl)}
                </Typography>
                {detail && detail.minPrice !== detail.maxPrice && (
                  <Typography sx={{ fontSize: "0.8rem", color: TEXT_MUTED }}>
                    {formatCurrency(detail.minPrice, currency, usdToBrl)} –{" "}
                    {formatCurrency(detail.maxPrice, currency, usdToBrl)}
                  </Typography>
                )}
              </Box>

              {/* Rating + reviews + commission */}
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1.5,
                  alignItems: "center",
                }}
              >
                {isLoading ? (
                  <Skeleton width={120} height={16} />
                ) : detail ? (
                  <>
                    {detail.rating > 0 && (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.4 }}
                      >
                        <Star sx={{ fontSize: 14, color: "#FBBF24" }} />
                        <Typography
                          sx={{ fontSize: "0.8rem", color: TEXT_SECONDARY }}
                        >
                          {detail.rating.toFixed(1)}
                        </Typography>
                      </Box>
                    )}
                    {detail.reviewCount > 0 && (
                      <Typography
                        sx={{ fontSize: "0.8rem", color: TEXT_MUTED }}
                      >
                        {formatNumber(detail.reviewCount)} avaliações
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: "0.8rem", color: TEXT_MUTED }}>
                      Comissão:{" "}
                      <Box
                        component="span"
                        sx={{ color: TEXT_SECONDARY, fontWeight: 600 }}
                      >
                        {commissionText}
                      </Box>
                    </Typography>
                  </>
                ) : null}
              </Box>
            </Box>

            {/* Product ID */}
            <Typography
              sx={{
                fontSize: "0.72rem",
                color: TEXT_MUTED,
                mb: 2,
                fontFamily: "monospace",
              }}
            >
              ID: {product.id}
            </Typography>

            <Divider sx={{ borderColor: BORDER, mb: 2 }} />

            {/* Metrics grid */}
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

            {isLoading ? (
              <Grid container spacing={1}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Grid item xs={6} sm={4} key={i}>
                    <Skeleton
                      variant="rectangular"
                      height={64}
                      sx={{ borderRadius: 2 }}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : detail ? (
              <Grid container spacing={1}>
                {detail.salesTotal > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<ShoppingCart sx={{ fontSize: 13 }} />}
                      label="Vendas totais"
                      value={formatNumber(detail.salesTotal)}
                    />
                  </Grid>
                )}
                {detail.sales7d > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<ShoppingCart sx={{ fontSize: 13 }} />}
                      label="Vendas 7d"
                      value={formatNumber(detail.sales7d)}
                    />
                  </Grid>
                )}
                {detail.sales30d > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<ShoppingCart sx={{ fontSize: 13 }} />}
                      label="Vendas 30d"
                      value={formatNumber(detail.sales30d)}
                    />
                  </Grid>
                )}
                {detail.gmvTotal > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<Paid sx={{ fontSize: 13 }} />}
                      label="Receita total"
                      value={formatCurrency(detail.gmvTotal, currency, usdToBrl)}
                    />
                  </Grid>
                )}
                {detail.gmv7d > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<Paid sx={{ fontSize: 13 }} />}
                      label="Receita 7d"
                      value={formatCurrency(detail.gmv7d, currency, usdToBrl)}
                    />
                  </Grid>
                )}
                {detail.gmv30d > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<Paid sx={{ fontSize: 13 }} />}
                      label="Receita 30d"
                      value={formatCurrency(detail.gmv30d, currency, usdToBrl)}
                    />
                  </Grid>
                )}
                {detail.creatorCount > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<Person sx={{ fontSize: 13 }} />}
                      label="Criadores"
                      value={formatNumber(detail.creatorCount)}
                    />
                  </Grid>
                )}
                {detail.videoCount > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<VideoLibrary sx={{ fontSize: 13 }} />}
                      label="Vídeos"
                      value={formatNumber(detail.videoCount)}
                    />
                  </Grid>
                )}
                {detail.liveCount > 0 && (
                  <Grid item xs={6} sm={4}>
                    <MetricCell
                      icon={<LiveTv sx={{ fontSize: 13 }} />}
                      label="Lives"
                      value={formatNumber(detail.liveCount)}
                    />
                  </Grid>
                )}
              </Grid>
            ) : (
              // Fallback — show what we already have from ProductDTO
              <Grid container spacing={1}>
                <Grid item xs={6} sm={4}>
                  <MetricCell
                    icon={<ShoppingCart sx={{ fontSize: 13 }} />}
                    label="Vendas"
                    value={formatNumber(product.sales)}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <MetricCell
                    icon={<Paid sx={{ fontSize: 13 }} />}
                    label="Receita"
                    value={formatCurrency(product.revenueBRL, currency, usdToBrl)}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <MetricCell
                    icon={<Person sx={{ fontSize: 13 }} />}
                    label="Criadores"
                    value={formatNumber(product.creatorCount)}
                  />
                </Grid>
              </Grid>
            )}

            {/* Specification */}
            {detail?.specification && detail.specification.length > 0 && (
              <>
                <Divider sx={{ borderColor: BORDER, my: 2 }} />
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
                  Especificações
                </Typography>
                <Box
                  component="dl"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    columnGap: 2,
                    rowGap: 0.5,
                    m: 0,
                  }}
                >
                  {detail.specification.map((s, i) => (
                    <Box key={i} sx={{ display: "contents" }}>
                      <Typography
                        component="dt"
                        sx={{
                          fontSize: "0.78rem",
                          color: TEXT_MUTED,
                          fontWeight: 500,
                          py: 0.25,
                        }}
                      >
                        {s.name}
                      </Typography>
                      <Typography
                        component="dd"
                        sx={{
                          fontSize: "0.78rem",
                          color: TEXT_SECONDARY,
                          margin: 0,
                          py: 0.25,
                        }}
                      >
                        {s.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {isLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                <CircularProgress size={20} sx={{ color: ACCENT }} />
              </Box>
            )}
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
