"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Chip,
} from "@mui/material";
import {
  Bookmark,
  BookmarkBorder,
  OpenInNew,
  TrendingUp,
  Person,
  Paid,
  ShoppingCart,
} from "@mui/icons-material";
import type { ProductDTO } from "@/lib/types/dto";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { useSavedProducts } from "@/lib/storage/saved";

const UI = {
  card: {
    bg: "linear-gradient(165deg, #0D1422 0%, #0A0F18 100%)",
    border: "rgba(255,255,255,0.08)",
    borderHover: "rgba(45,212,255,0.22)",
    radius: 4.5,
    shadow: "0 2px 8px rgba(0,0,0,0.12)",
    shadowHover: "0 8px 24px rgba(0,0,0,0.25), 0 0 12px rgba(45,212,255,0.08)",
  },
  text: {
    primary: "rgba(255,255,255,0.92)",
    secondary: "rgba(255,255,255,0.68)",
    muted: "rgba(255,255,255,0.42)",
  },
  accent: "#2DD4FF",
};

interface ProductCardProps {
  product?: ProductDTO;
  onViewDetails?: (product: ProductDTO) => void;
  isLoading?: boolean;
}

export function ProductCard({
  product,
  onViewDetails,
  isLoading = false,
}: ProductCardProps) {
  const savedProducts = useSavedProducts();
  const [isPressed, setIsPressed] = useState(false);

  const saved = product ? savedProducts.isSaved(product.id) : false;

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product) return;
    savedProducts.toggle(product);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product) return;
    if (product.tiktokUrl) {
      window.open(product.tiktokUrl, "_blank", "noopener,noreferrer");
    } else if (product.sourceUrl) {
      window.open(product.sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleViewDetails = () => {
    if (!product) return;
    onViewDetails?.(product);
  };

  // Loading skeleton
  if (isLoading || !product) {
    return (
      <Box
        sx={{
          borderRadius: UI.card.radius,
          overflow: "hidden",
          background: UI.card.bg,
          border: `1px solid ${UI.card.border}`,
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            background: "#0a0f18",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #0d1420 0%, #151c2a 100%)",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(45,212,255,0.06) 50%, transparent 100%)",
                animation: "shimmer 2.5s infinite ease-in-out",
                transform: "translateX(-100%)",
              },
              "@keyframes shimmer": {
                "0%": { transform: "translateX(-100%)" },
                "100%": { transform: "translateX(100%)" },
              },
            }}
          />
        </Box>
        <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
          <Skeleton width="90%" height={14} sx={{ mb: 0.5 }} />
          <Skeleton width="55%" height={12} sx={{ mb: 0.75 }} />
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Skeleton width={50} height={12} />
            <Skeleton width={45} height={12} />
          </Box>
        </Box>
      </Box>
    );
  }

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
        transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: UI.card.shadow,
        "&:hover": {
          borderColor: UI.card.borderHover,
          boxShadow: UI.card.shadowHover,
          transform: "translateY(-2px)",
        },
        ...(isPressed && {
          transform: "scale(0.98)",
        }),
      }}
    >
      {/* Product Image */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0d1420 0%, #151c2a 100%)",
        }}
      >
        <Box
          component="img"
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* New badge */}
        {product.isNew && (
          <Chip
            size="small"
            label="Novo"
            sx={{
              position: "absolute",
              top: { xs: 8, md: 10 },
              left: { xs: 8, md: 10 },
              zIndex: 5,
              height: { xs: 22, md: 24 },
              fontSize: { xs: "0.65rem", md: "0.7rem" },
              fontWeight: 700,
              background: "#4CAF50",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(76,175,80,0.3)",
            }}
          />
        )}

        {/* Action buttons overlay */}
        <Box
          sx={{
            position: "absolute",
            top: { xs: 8, md: 10 },
            right: { xs: 8, md: 10 },
            zIndex: 5,
            display: "flex",
            gap: 0.5,
          }}
        >
          <Tooltip title={saved ? "Remover dos salvos" : "Salvar produto"}>
            <IconButton
              size="small"
              onClick={handleSave}
              sx={{
                width: { xs: 30, md: 32 },
                height: { xs: 30, md: 32 },
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                color: saved ? UI.accent : "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.12)",
                transition: "all 180ms ease",
                "&:hover": {
                  background: "rgba(0,0,0,0.7)",
                  color: UI.accent,
                  borderColor: UI.accent,
                },
              }}
            >
              {saved ? (
                <Bookmark sx={{ fontSize: { xs: 16, md: 18 } }} />
              ) : (
                <BookmarkBorder sx={{ fontSize: { xs: 16, md: 18 } }} />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title="Abrir">
            <IconButton
              size="small"
              onClick={handleOpen}
              sx={{
                width: { xs: 30, md: 32 },
                height: { xs: 30, md: 32 },
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.12)",
                transition: "all 180ms ease",
                "&:hover": {
                  background: "rgba(0,0,0,0.7)",
                  color: UI.accent,
                  borderColor: UI.accent,
                },
              }}
            >
              <OpenInNew sx={{ fontSize: { xs: 16, md: 18 } }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
        {/* Product name */}
        <Typography
          sx={{
            fontSize: { xs: "0.95rem", md: "1rem" },
            fontWeight: 650,
            color: UI.text.primary,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            mb: { xs: 0.4, md: 0.5 },
            minHeight: "2.4em",
          }}
        >
          {product.name}
        </Typography>

        {/* Category */}
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: UI.text.muted,
            mb: { xs: 0.75, md: 1 },
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {product.category}
        </Typography>

        {/* Price */}
        <Typography
          sx={{
            fontSize: { xs: "1.1rem", md: "1.2rem" },
            fontWeight: 700,
            color: UI.accent,
            mb: { xs: 1, md: 1.25 },
          }}
        >
          {formatCurrency(product.priceBRL, product.currency)}
        </Typography>

        {/* Metrics */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: { xs: 0.5, md: 1 },
            mb: { xs: 1, md: 1.25 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <Paid sx={{ fontSize: { xs: 13, md: 16 }, color: UI.text.muted, flexShrink: 0 }} />
            <Typography
              noWrap
              sx={{
                fontSize: { xs: "0.7rem", md: "0.8125rem" },
                color: UI.text.secondary,
              }}
            >
              {formatCurrency(product.revenueBRL, product.currency)}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <ShoppingCart
              sx={{ fontSize: { xs: 13, md: 16 }, color: UI.text.muted, flexShrink: 0 }}
            />
            <Typography
              noWrap
              sx={{
                fontSize: { xs: "0.7rem", md: "0.8125rem" },
                color: UI.text.secondary,
              }}
            >
              {formatNumber(product.sales)}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <Person
              sx={{ fontSize: { xs: 13, md: 16 }, color: UI.text.muted, flexShrink: 0 }}
            />
            <Typography
              noWrap
              sx={{
                fontSize: { xs: "0.7rem", md: "0.8125rem" },
                color: UI.text.secondary,
              }}
            >
              {formatNumber(product.creatorCount)}
            </Typography>
          </Box>
        </Box>

        {/* CTA Button */}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<TrendingUp />}
          onClick={handleViewDetails}
          sx={{
            color: UI.accent,
            borderColor: `${UI.accent}40`,
            fontWeight: 600,
            fontSize: { xs: "0.8rem", md: "0.85rem" },
            textTransform: "none",
            borderRadius: 2,
            py: { xs: 0.75, md: 1 },
            "&:hover": {
              borderColor: UI.accent,
              background: `${UI.accent}10`,
            },
            transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          Ver Detalhes
        </Button>
      </Box>
    </Box>
  );
}
