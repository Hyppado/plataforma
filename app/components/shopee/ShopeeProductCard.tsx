/**
 * app/components/shopee/ShopeeProductCard.tsx
 *
 * Card de produto para exibição no ranking da Shopee.
 *
 * Estratégia de imagem:
 * 1. Tenta carregar a URL real da Shopee (product.coverUrl)
 * 2. Se falhar (onError), troca permanentemente para o fallback da Unsplash
 * 3. O fallback da Unsplash é garantido de funcionar (sem restrição de CORS)
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Button,
} from "@mui/material";
import {
  TrendingUp,
  ShoppingCart,
  Store,
  FaceRetouchingNatural,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { formatNumber } from "@/lib/format";
import type { ShopeeProductTrendDTO } from "@/lib/swr/useShopee";

interface ShopeeProductCardProps {
  product: ShopeeProductTrendDTO;
  onClick?: (product: ShopeeProductTrendDTO) => void;
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200";

export function ShopeeProductCard({ product, onClick }: ShopeeProductCardProps) {
  const router = useRouter();

  // Começa com a URL da Shopee, se existir. Caso contrário, vai direto pro fallback.
  const [imgSrc, setImgSrc] = useState(() => {
    if (product.coverUrl && product.coverUrl.startsWith("http")) {
      return product.coverUrl;
    }
    return FALLBACK_IMG;
  });

  const handleImgError = useCallback(() => {
    // Se a URL original da Shopee falhar, troca permanentemente pro fallback
    setImgSrc(FALLBACK_IMG);
  }, []);

  const handleClick = () => {
    onClick?.(product);
  };

  const handleCreateAvatarVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    params.set("shopeeProductId", product.productExternalId);
    params.set("productName", product.productName);
    params.set("productImageUrl", product.coverUrl || FALLBACK_IMG);
    params.set("productPrice", String(product.price || 0));
    router.push(`/dashboard/influencer-ia?${params.toString()}`);
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        position: "relative",
        borderRadius: 2.5,
        overflow: "hidden",
        background: "#0D121C",
        border: "1px solid rgba(255,255,255,0.06)",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        "&:hover": onClick
          ? {
              borderColor: "rgba(45, 212, 255, 0.3)",
              transform: "translateY(-2px)",
              boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
            }
          : {},
      }}
    >
      {/* Posição no ranking */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 0.8,
          py: 0.3,
          borderRadius: 1.5,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
      >
        <TrendingUp sx={{ fontSize: 11, color: "#2DD4FF" }} />
        <Typography
          sx={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "#2DD4FF",
          }}
        >
          #{product.rankPosition}
        </Typography>
      </Box>

      {/* Imagem do produto */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          paddingTop: "100%",
          background: "#0A0F18",
          overflow: "hidden",
        }}
      >
        <Box
          component="img"
          src={imgSrc}
          alt={product.productName}
          referrerPolicy="no-referrer"
          onError={handleImgError}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </Box>

      {/* Informações do produto */}
      <Box sx={{ p: 1.5 }}>
        {/* Nome do produto */}
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.3,
            mb: 1,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 30,
          }}
        >
          {product.productName}
        </Typography>

        {/* Preço e comissão */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
          <Typography
            sx={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#2DD4FF",
            }}
          >
            R$ {product.price.toFixed(2)}
          </Typography>
          <Chip
            label={`${(product.commissionRate * 100).toFixed(1)}%`}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.6rem",
              fontWeight: 600,
              background: alpha("#22C55E", 0.15),
              color: "#22C55E",
              border: "none",
            }}
          />
        </Box>

        {/* Métricas: vendas e GMV */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 0.75 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
            <ShoppingCart sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
            <Typography
              sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)" }}
            >
              {formatNumber(product.saleCount)}
            </Typography>
          </Box>
          {product.shopName && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
              <Store sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
              <Typography
                sx={{
                  fontSize: "0.6rem",
                  color: "rgba(255,255,255,0.4)",
                  maxWidth: 80,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {product.shopName}
              </Typography>
            </Box>
          )}
        </Box>

        {/* CTA Buttons */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<TrendingUp />}
            onClick={handleClick}
            sx={{
              color: "#2DD4FF",
              borderColor: "rgba(45, 212, 255, 0.25)",
              fontWeight: 600,
              fontSize: "0.78rem",
              textTransform: "none",
              borderRadius: 2,
              py: 0.75,
              "&:hover": {
                borderColor: "#2DD4FF",
                background: "rgba(45, 212, 255, 0.08)",
              },
            }}
          >
            Ver Detalhes
          </Button>

          <Button
            fullWidth
            variant="contained"
            startIcon={<FaceRetouchingNatural sx={{ fontSize: 14 }} />}
            onClick={handleCreateAvatarVideo}
            sx={{
              background: "linear-gradient(90deg, #FF2D78 0%, #E0256A 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.7rem",
              textTransform: "none",
              borderRadius: 2,
              py: 0.75,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              boxShadow: "none",
              "&:hover": {
                background: "linear-gradient(90deg, #E0256A 0%, #c01d58 100%)",
                boxShadow: "0 4px 14px rgba(255,45,120,0.3)",
              },
            }}
          >
            Criar Vídeo com Avatar
          </Button>
        </Box>
      </Box>
    </Box>
  );
}