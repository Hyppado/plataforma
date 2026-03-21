"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Chip,
} from "@mui/material";
import {
  Bookmark,
  BookmarkBorder,
  OpenInNew,
  MoreVert,
  FolderOpen,
  Visibility,
  WorkspacePremium,
  MilitaryTech,
  Paid,
  ShoppingCart,
  AccessTime,
} from "@mui/icons-material";
import type { VideoDTO } from "@/lib/types/dto";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Skeleton } from "@/app/components/ui/Skeleton";

// ============================================
// Design Tokens
// ============================================
const UI = {
  card: {
    bg: "linear-gradient(165deg, #0D1422 0%, #0A0F18 100%)",
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(45,212,255,0.22)",
    radius: 4.5,
    shadow: "0 2px 8px rgba(0,0,0,0.12)",
    shadowHover: "0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(45,212,255,0.15)",
  },
  text: {
    primary: "rgba(255,255,255,0.92)",
    secondary: "rgba(255,255,255,0.64)",
    muted: "rgba(255,255,255,0.42)",
  },
  accent: "#2DD4FF",
};

const TOP_3_STYLES: Record<
  number,
  { color: string; border: string; icon: typeof WorkspacePremium }
> = {
  1: {
    color: "#F5C84C",
    border: "rgba(245,200,76,0.3)",
    icon: WorkspacePremium,
  },
  2: {
    color: "#D1D5DB",
    border: "rgba(209,213,219,0.25)",
    icon: WorkspacePremium,
  },
  3: {
    color: "#CD9777",
    border: "rgba(205,151,119,0.25)",
    icon: MilitaryTech,
  },
};

// ============================================
// Props
// ============================================
interface VideoCardProps {
  video?: VideoDTO;
  rank?: number;
  onSave?: (video: VideoDTO) => void;
  onAddToCollection?: (video: VideoDTO) => void;
  onClick?: (video: VideoDTO) => void;
  isSaved?: boolean;
  isLoading?: boolean;
}

/**
 * VideoCard — lightweight card with placeholder preview + click-to-open.
 * No TikTok embed/iframe. Click opens TikTok URL in new tab.
 */
export function VideoCard({
  video,
  rank,
  onSave,
  onAddToCollection,
  onClick,
  isSaved = false,
  isLoading = false,
}: VideoCardProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [saved, setSaved] = useState(isSaved);
  const [isPressed, setIsPressed] = useState(false);
  const menuOpen = Boolean(anchorEl);

  const isTop3 = rank !== undefined && rank >= 1 && rank <= 3;
  const topStyle = isTop3 ? TOP_3_STYLES[rank] : null;
  const hasTikTokUrl = !!video?.tiktokUrl;
  const hasSourceUrl = !!video?.sourceUrl;
  const hasThumbnail = !!video?.thumbnailUrl;

  // ---- handlers ----
  const handleCardClick = () => {
    if (!video) return;
    if (hasTikTokUrl) {
      window.open(video.tiktokUrl, "_blank", "noopener,noreferrer");
    }
    onClick?.(video);
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!video) return;
    setSaved(!saved);
    onSave?.(video);
  };

  const handleOpenTikTok = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!video || !hasTikTokUrl) return;
    window.open(video.tiktokUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenSource = () => {
    handleMenuClose();
    if (!video || !hasSourceUrl) return;
    window.open(video.sourceUrl, "_blank", "noopener,noreferrer");
  };

  const handleAddToCollection = () => {
    handleMenuClose();
    if (!video) return;
    onAddToCollection?.(video);
  };

  // ---- Loading / skeleton state ----
  if (isLoading || !video) {
    return (
      <Box
        aria-busy="true"
        aria-label="Carregando vídeo"
        sx={{
          borderRadius: UI.card.radius,
          overflow: "hidden",
          background: UI.card.bg,
          border: `1px solid ${UI.card.border}`,
        }}
      >
        {/* Skeleton preview area */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: { xs: "1 / 1", md: "4 / 5" },
            background: "#0a0f18",
            borderRadius: `${UI.card.radius * 2}px ${UI.card.radius * 2}px 0 0`,
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
                  "linear-gradient(90deg, transparent 0%, rgba(45,212,255,0.04) 50%, transparent 100%)",
                animation: "shimmer 2s infinite ease-in-out",
                transform: "translateX(-100%)",
              },
              "@keyframes shimmer": {
                "0%": { transform: "translateX(-100%)" },
                "100%": { transform: "translateX(100%)" },
              },
            }}
          />
        </Box>
        <Box sx={{ p: 1.5 }}>
          <Skeleton width="90%" height={14} sx={{ mb: 0.4 }} />
          <Skeleton width="55%" height={12} sx={{ mb: 0.75 }} />
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Skeleton width={50} height={12} />
            <Skeleton width={45} height={12} />
          </Box>
        </Box>
      </Box>
    );
  }

  // ---- Main card ----
  return (
    <Box
      onClick={handleCardClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={
        hasTikTokUrl
          ? `Abrir vídeo: ${video.title}`
          : `Vídeo: ${video.title} (link indisponível)`
      }
      sx={{
        position: "relative",
        borderRadius: UI.card.radius,
        overflow: "hidden",
        background: UI.card.bg,
        border: `1px solid ${topStyle ? topStyle.border : UI.card.border}`,
        cursor: hasTikTokUrl ? "pointer" : "default",
        transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: UI.card.shadow,
        ...((hasTikTokUrl || true) && {
          "&:hover": {
            borderColor: UI.card.borderHover,
            boxShadow: UI.card.shadowHover,
            transform: "translateY(-3px)",
          },
          "&:active": {
            transform: "scale(0.98)",
          },
        }),
        ...(isPressed && {
          transform: "scale(0.98)",
        }),
        "&:focus-visible": {
          outline: `2px solid ${UI.card.borderHover}`,
          outlineOffset: 2,
        },
      }}
    >
      {/* ======== Preview Area (1:1 mobile, 4:5 desktop) ======== */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: { xs: "1 / 1", md: "4 / 5" },
          overflow: "hidden",
          borderRadius: `${UI.card.radius * 2}px ${UI.card.radius * 2}px 0 0`,
          background:
            "linear-gradient(160deg, #0d1420 0%, #151c2a 50%, #0f1724 100%)",
        }}
      >
        {/* Real thumbnail image (from oEmbed) */}
        {hasThumbnail && (
          <Box
            component="img"
            src={video.thumbnailUrl!}
            alt={video.title}
            loading="lazy"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 1,
            }}
          />
        )}

        {/* Dot pattern placeholder (visible when no thumbnail) */}
        {!hasThumbnail && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.06,
              backgroundImage:
                "radial-gradient(circle at 25% 25%, #2DD4FF 1px, transparent 1px), radial-gradient(circle at 75% 75%, #2DD4FF 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
        )}

        {/* Rank badge — top left */}
        {rank !== undefined && (
          <Box
            sx={{
              position: "absolute",
              top: { xs: 8, md: 10 },
              left: { xs: 8, md: 10 },
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: { xs: 0.8, md: 1 },
              py: { xs: 0.35, md: 0.45 },
              borderRadius: 3,
              fontWeight: 700,
              fontSize: { xs: "0.7rem", md: "0.75rem" },
              color: topStyle ? topStyle.color : "rgba(255,255,255,0.9)",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              border: `1px solid ${topStyle ? topStyle.border : "rgba(255,255,255,0.10)"}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            {topStyle && (
              <topStyle.icon
                sx={{ fontSize: { xs: 14, md: 15 }, color: topStyle.color }}
              />
            )}
            #{rank}
          </Box>
        )}

        {/* Duration chip — top right */}
        {video.duration && video.duration !== "0:00" && (
          <Chip
            size="small"
            icon={<AccessTime sx={{ fontSize: { xs: 11, md: 12 } }} />}
            label={video.duration}
            sx={{
              position: "absolute",
              top: { xs: 8, md: 10 },
              right: { xs: 8, md: 10 },
              zIndex: 5,
              height: { xs: 22, md: 24 },
              fontSize: { xs: "0.65rem", md: "0.7rem" },
              fontWeight: 600,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              color: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              "& .MuiChip-icon": { color: "rgba(255,255,255,0.64)" },
            }}
          />
        )}

        {/* Bottom gradient for legibility */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
            zIndex: 3,
            pointerEvents: "none",
          }}
        />

        {/* ROAS badge — bottom left inside preview */}
        {video.roas >= 3 && (
          <Chip
            size="small"
            label={`ROAS ${video.roas.toFixed(1)}x`}
            sx={{
              position: "absolute",
              bottom: { xs: 8, md: 10 },
              left: { xs: 8, md: 10 },
              zIndex: 5,
              height: { xs: 22, md: 24 },
              fontSize: { xs: "0.65rem", md: "0.7rem" },
              fontWeight: 700,
              background: "rgba(45, 212, 255, 0.9)",
              color: "#06080F",
              boxShadow: "0 2px 8px rgba(45,212,255,0.3)",
            }}
          />
        )}
      </Box>

      {/* ======== Content area ======== */}
      <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
        {/* Title — 2 lines */}
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
          {video.title}
        </Typography>

        {/* Creator handle */}
        <Typography
          sx={{
            fontSize: "0.85rem",
            color: UI.text.secondary,
            mb: { xs: 0.75, md: 1 },
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {video.creatorHandle}
        </Typography>

        {/* Metrics row */}
        <Box
          sx={{
            display: "flex",
            gap: { xs: 1, md: 1.5 },
            mb: { xs: 0.75, md: 1 },
            flexWrap: "wrap",
          }}
        >
          {/* Revenue */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <Paid
              sx={{ fontSize: { xs: 14, md: 16 }, color: `${UI.accent}E6` }}
            />
            <Typography
              sx={{
                fontSize: { xs: "0.8rem", md: "0.85rem" },
                color: UI.accent,
                fontWeight: 600,
              }}
            >
              {formatCurrency(video.revenueBRL)}
            </Typography>
          </Box>
          {/* Views */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <Visibility
              sx={{ fontSize: { xs: 14, md: 16 }, color: UI.text.muted }}
            />
            <Typography
              sx={{
                fontSize: { xs: "0.8rem", md: "0.85rem" },
                color: UI.text.secondary,
              }}
            >
              {formatNumber(video.views)}
            </Typography>
          </Box>
          {/* Sales */}
          {video.sales > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
              <ShoppingCart
                sx={{ fontSize: { xs: 14, md: 16 }, color: UI.text.muted }}
              />
              <Typography
                sx={{
                  fontSize: { xs: "0.8rem", md: "0.85rem" },
                  color: UI.text.secondary,
                }}
              >
                {formatNumber(video.sales)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Action buttons row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", gap: 0.15 }}>
            <Tooltip title={saved ? "Remover dos salvos" : "Salvar"}>
              <IconButton
                size="small"
                onClick={handleSave}
                aria-label={saved ? "Remover dos salvos" : "Salvar vídeo"}
                sx={{
                  color: saved ? UI.accent : "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 3,
                  padding: { xs: "7px", md: "8px" },
                  transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    color: "rgba(255,255,255,0.80)",
                    background: "rgba(255,255,255,0.06)",
                    borderColor: UI.card.borderHover,
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

            <Tooltip
              title={hasTikTokUrl ? "Abrir no TikTok" : "Link indisponível"}
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!hasTikTokUrl}
                  onClick={handleOpenTikTok}
                  aria-label="Abrir no TikTok"
                  sx={{
                    color: "rgba(255,255,255,0.55)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 3,
                    padding: { xs: "7px", md: "8px" },
                    transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      color: "rgba(255,255,255,0.80)",
                      background: "rgba(255,255,255,0.06)",
                      borderColor: UI.card.borderHover,
                    },
                    "&.Mui-disabled": {
                      color: "rgba(255,255,255,0.15)",
                      borderColor: "rgba(255,255,255,0.03)",
                    },
                  }}
                >
                  <OpenInNew sx={{ fontSize: { xs: 14, md: 16 } }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <IconButton
            size="small"
            onClick={handleMenuClick}
            aria-label="Mais opções"
            aria-controls={menuOpen ? "video-card-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={menuOpen ? "true" : undefined}
            sx={{
              color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 3,
              padding: { xs: "7px", md: "8px" },
              transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                color: "rgba(255,255,255,0.80)",
                background: "rgba(255,255,255,0.06)",
                borderColor: UI.card.borderHover,
              },
            }}
          >
            <MoreVert sx={{ fontSize: { xs: 14, md: 16 } }} />
          </IconButton>

          <Menu
            id="video-card-menu"
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            MenuListProps={{ "aria-labelledby": "more-options-button" }}
            PaperProps={{
              sx: {
                background: UI.card.bg,
                border: `1px solid ${UI.card.borderHover}`,
                borderRadius: 3,
                boxShadow: UI.card.shadowHover,
                "& .MuiMenuItem-root": {
                  fontSize: "0.85rem",
                  color: UI.text.primary,
                  gap: 1.5,
                  transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    background: "rgba(255,255,255,0.06)",
                    color: UI.accent,
                  },
                },
              },
            }}
          >
            <MenuItem onClick={handleAddToCollection}>
              <FolderOpen sx={{ fontSize: 16 }} />
              Adicionar à coleção
            </MenuItem>
            <MenuItem onClick={handleOpenSource} disabled={!hasSourceUrl}>
              <OpenInNew sx={{ fontSize: 16 }} />
              Ver detalhes
            </MenuItem>
          </Menu>
        </Box>
      </Box>
    </Box>
  );
}

export default VideoCard;
