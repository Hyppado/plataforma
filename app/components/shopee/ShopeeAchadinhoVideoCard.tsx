/**
 * app/components/shopee/ShopeeAchadinhoVideoCard.tsx
 *
 * Card de vídeo para "Achadinhos Shopee" — replica o estilo e a funcionalidade
 * do VideoCard usado em "Vídeos em Alta", mas com dados dos produtos extraídos
 * via pipeline de IA (Whisper → GPT → Shopee API).
 *
 * Exibe: thumbnail do vídeo, status do processamento, nome do produto extraído,
 * preço da Shopee, vendas, categoria, link de afiliado e botão de edição (admin).
 */

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Box, Typography, Chip, IconButton, Tooltip } from "@mui/material";
import {
  PlayArrowRounded,
  ShoppingCart,
  AttachMoney,
  Link as LinkIcon,
  OpenInNew,
  Edit,
  CheckCircle,
  HourglassEmpty,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { formatNumber } from "@/lib/format";
import type { ShopeeAchadinhoDTO } from "@/lib/swr/useShopee";
import { EditAffiliateModal } from "./EditAffiliateModal";

interface ShopeeAchadinhoVideoCardProps {
  achadinho: ShopeeAchadinhoDTO;
  rank?: number;
  onUpdate?: () => void;
}

export function ShopeeAchadinhoVideoCard({
  achadinho,
  rank,
  onUpdate,
}: ShopeeAchadinhoVideoCardProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const statusConfig = getStatusConfig(achadinho.status);

  const imgSrc =
    !imgError && achadinho.coverUrl
      ? achadinho.coverUrl
      : "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300";

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2.5,
        overflow: "hidden",
        background: "#0D121C",
        border: "1px solid rgba(255,255,255,0.06)",
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: "rgba(45, 212, 255, 0.2)",
          transform: "translateY(-2px)",
          boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
        },
      }}
    >
      {/* Thumbnail com overlay */}
      <Box sx={{ position: "relative" }}>
        <Box
          sx={{
            width: "100%",
            paddingTop: "56.25%",
            background: "#0A0F18",
            overflow: "hidden",
          }}
        >
          {!imgLoaded && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(135deg, #0D121C 0%, #1A1F2E 100%)",
                animation: "shimmer 1.5s ease-in-out infinite",
                "@keyframes shimmer": {
                  "0%": { opacity: 1 },
                  "50%": { opacity: 0.5 },
                  "100%": { opacity: 1 },
                },
              }}
            />
          )}
          <Box
            component="img"
            src={imgSrc}
            alt={achadinho.productName || achadinho.videoTitle || ""}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
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
        </Box>

        {/* Play overlay */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.15)",
            opacity: 0,
            transition: "opacity 0.2s ease",
            "&:hover": { opacity: 1 },
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.2)",
              backdropFilter: "blur(4px)",
            }}
          >
            <PlayArrowRounded sx={{ fontSize: 28, color: "#fff" }} />
          </Box>
        </Box>

        {/* Rank badge */}
        {rank && (
          <Box
            sx={{
              position: "absolute",
              top: 6,
              left: 6,
              zIndex: 2,
              px: 0.6,
              py: 0.15,
              borderRadius: 1,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(4px)",
            }}
          >
            <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#2DD4FF" }}>
              #{rank}
            </Typography>
          </Box>
        )}

        {/* Status badge */}
        <Box
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
            zIndex: 2,
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
          <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: statusConfig.color }}>
            {statusConfig.label}
          </Typography>
        </Box>
      </Box>

      {/* Informações do produto */}
      <Box sx={{ p: 1.25 }}>
        {/* Nome do produto */}
        <Typography
          sx={{
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.3,
            mb: 0.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 32,
          }}
        >
          {achadinho.productName || achadinho.videoTitle || "Produto sem nome"}
        </Typography>

        {/* Preço e vendas */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          {achadinho.price && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
              <AttachMoney sx={{ fontSize: 13, color: "#2DD4FF" }} />
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#2DD4FF" }}>
                {achadinho.price.toFixed(2)}
              </Typography>
            </Box>
          )}
          {achadinho.saleCount > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
              <ShoppingCart sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
              <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)" }}>
                {formatNumber(achadinho.saleCount)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Categoria */}
        {achadinho.category && (
          <Chip
            label={achadinho.category}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.55rem",
              fontWeight: 600,
              background: "rgba(45, 212, 255, 0.08)",
              color: "rgba(45, 212, 255, 0.7)",
              border: "1px solid rgba(45, 212, 255, 0.15)",
              mb: 0.75,
            }}
          />
        )}

        {/* Link de afiliado + ação admin */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.3,
            p: 0.5,
            borderRadius: 1,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <LinkIcon sx={{ fontSize: 10, color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
          <Typography
            sx={{
              flex: 1,
              fontSize: "0.55rem",
              color: "rgba(255,255,255,0.4)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {achadinho.affiliateLink || "Sem link"}
          </Typography>
          {achadinho.affiliateLink && (
            <Tooltip title="Abrir link" arrow>
              <IconButton
                component="a"
                href={achadinho.affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                sx={{ color: "rgba(255,255,255,0.3)", "&:hover": { color: "#2DD4FF" }, p: 0.3 }}
              >
                <OpenInNew sx={{ fontSize: 11 }} />
              </IconButton>
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip title="Editar link de afiliado" arrow>
              <IconButton
                size="small"
                onClick={() => setEditModalOpen(true)}
                sx={{ color: "#F59E0B", "&:hover": { background: alpha("#F59E0B", 0.1) }, p: 0.3 }}
              >
                <Edit sx={{ fontSize: 11 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Modal de edição */}
      {editModalOpen && (
        <EditAffiliateModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          product={achadinho}
          onSuccess={onUpdate}
        />
      )}
    </Box>
  );
}

function getStatusConfig(status: string): {
  label: string;
  color: string;
  background: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "READY":
      return { label: "PRONTO", color: "#22C55E", background: "rgba(34, 197, 94, 0.15)", icon: <CheckCircle sx={{ fontSize: 10, color: "#22C55E" }} /> };
    case "PROCESSING":
      return { label: "PROC", color: "#F59E0B", background: "rgba(245, 158, 11, 0.15)", icon: <HourglassEmpty sx={{ fontSize: 10, color: "#F59E0B" }} /> };
    case "FAILED":
      return { label: "FALHA", color: "#EF4444", background: "rgba(239, 68, 68, 0.15)", icon: <ErrorIcon sx={{ fontSize: 10, color: "#EF4444" }} /> };
    default:
      return { label: "PEND", color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", icon: <HourglassEmpty sx={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }} /> };
  }
}