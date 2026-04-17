"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Box,
  Typography,
  Tooltip,
} from "@mui/material";
import { Close, OpenInNew } from "@mui/icons-material";

interface TikTokPlayerModalProps {
  open: boolean;
  onClose: () => void;
  tiktokUrl: string;
  videoTitle?: string | null;
}

/**
 * Extracts the numeric TikTok video ID from a canonical TikTok URL.
 * Supports:
 *   https://www.tiktok.com/@handle/video/1234567890
 *   https://vm.tiktok.com/1234567890/
 */
function extractVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  if (match) return match[1];
  // short-link fallback — just strip trailing slash
  const short = url.match(/tiktok\.com\/([A-Za-z0-9]+)\/?$/);
  return short ? short[1] : null;
}

export function TikTokPlayerModal({
  open,
  onClose,
  tiktokUrl,
  videoTitle,
}: TikTokPlayerModalProps) {
  const videoId = extractVideoId(tiktokUrl);
  const embedSrc = videoId
    ? `https://www.tiktok.com/embed/v2/${videoId}`
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          background: "#0a0f18",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 3,
          width: { xs: "95vw", sm: 400 },
          maxHeight: "95vh",
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          py: 1.5,
          px: 2,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {videoTitle ? (
            <Typography
              variant="body2"
              fontWeight={600}
              noWrap
              title={videoTitle}
              sx={{ color: "text.primary", fontSize: "0.8rem" }}
            >
              {videoTitle}
            </Typography>
          ) : (
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontSize: "0.8rem" }}
            >
              Vídeo TikTok
            </Typography>
          )}
        </Box>

        <Tooltip title="Abrir no TikTok">
          <IconButton
            size="small"
            component="a"
            href={tiktokUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: "rgba(255,255,255,0.45)", "&:hover": { color: "primary.main" } }}
          >
            <OpenInNew sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Fechar">
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: "rgba(255,255,255,0.45)", "&:hover": { color: "text.primary" } }}
          >
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent
        sx={{ p: 0, display: "flex", flexDirection: "column", height: "100%" }}
      >
        {embedSrc ? (
          <Box
            sx={{
              width: "100%",
              aspectRatio: "9 / 16",
              background: "#000",
              overflow: "hidden",
            }}
          >
            <Box
              component="iframe"
              src={embedSrc}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              scrolling="no"
              frameBorder={0}
              sx={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
              }}
              title={videoTitle ?? "TikTok video"}
            />
          </Box>
        ) : (
          // Fallback when embed URL cannot be constructed (short links etc.)
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              py: 6,
              px: 3,
            }}
          >
            <Typography variant="body2" color="text.secondary" align="center">
              Não foi possível incorporar este vídeo.
            </Typography>
            <Typography
              component="a"
              href={tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              Abrir no TikTok →
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
