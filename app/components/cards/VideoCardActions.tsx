"use client";

import { Box, Button } from "@mui/material";
import {
  Subtitles,
  AutoAwesome,
  Bookmark,
  BookmarkBorder,
} from "@mui/icons-material";
import { UI } from "./videoCardConfig";

interface VideoCardActionsProps {
  saved: boolean;
  onTranscribe: () => void;
  onInsight: () => void;
  onSave: (e: React.MouseEvent) => void;
}

/** CTA buttons + save action for VideoCard */
export function VideoCardActions({
  saved,
  onTranscribe,
  onInsight,
  onSave,
}: VideoCardActionsProps) {
  return (
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
        onClick={onTranscribe}
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

      <Button
        fullWidth
        variant="contained"
        startIcon={<AutoAwesome sx={{ fontSize: { xs: 15, md: 16 } }} />}
        onClick={onInsight}
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

      {/* Save video — secondary action */}
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
          onClick={onSave}
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
  );
}
