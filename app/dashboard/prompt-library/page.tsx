"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Chip,
  Grid,
  Skeleton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Alert,
} from "@mui/material";
import {
  ContentCopy,
  Check,
  Close,
  MenuBook,
  PlayArrow,
} from "@mui/icons-material";
import {
  usePromptLibrary,
  type PromptLibraryItem,
} from "@/lib/swr/usePromptLibrary";

// ---------------------------------------------------------------------------
// Video card — plays on hover, loops silently
// ---------------------------------------------------------------------------

function PromptVideoCard({
  item,
  onViewPrompt,
}: {
  item: PromptLibraryItem;
  onViewPrompt: (item: PromptLibraryItem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    videoRef.current?.play().catch(() => {
      // Autoplay blocked — silently ignore
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(item.promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  }, [item.promptText]);

  return (
    <Box
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s",
        "&:hover": {
          borderColor: "rgba(45,212,255,0.25)",
        },
      }}
    >
      {/* Video */}
      <Box
        sx={{
          position: "relative",
          aspectRatio: "9/16",
          background: "#000",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          src={item.videoBlobUrl}
          loop
          muted
          playsInline
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Play hint when not hovered */}
        {!hovered && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.25)",
              pointerEvents: "none",
            }}
          >
            <PlayArrow
              sx={{ fontSize: 40, color: "rgba(255,255,255,0.7)" }}
            />
          </Box>
        )}
      </Box>

      {/* Card content */}
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
        {/* Category chip */}
        <Chip
          label={item.category}
          size="small"
          sx={{
            alignSelf: "flex-start",
            fontSize: "0.7rem",
            height: 22,
            color: "primary.main",
            background: "rgba(45,212,255,0.08)",
            border: "1px solid rgba(45,212,255,0.2)",
            borderRadius: 1,
          }}
        />

        {/* Title */}
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "#fff",
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </Typography>

        {/* Description */}
        {item.description && (
          <Typography
            sx={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </Typography>
        )}

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 1, mt: "auto" }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onViewPrompt(item)}
            sx={{
              flex: 1,
              fontSize: "0.75rem",
              textTransform: "none",
              borderColor: "rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.8)",
              "&:hover": {
                borderColor: "primary.main",
                color: "primary.main",
                background: "rgba(45,212,255,0.05)",
              },
            }}
          >
            Ver prompt
          </Button>
          <Tooltip title={copied ? "Copiado!" : "Copiar prompt"}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 1,
                color: copied ? "primary.main" : "rgba(255,255,255,0.6)",
                "&:hover": {
                  borderColor: "primary.main",
                  color: "primary.main",
                  background: "rgba(45,212,255,0.05)",
                },
              }}
            >
              {copied ? (
                <Check sx={{ fontSize: 16 }} />
              ) : (
                <ContentCopy sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Skeleton
        variant="rectangular"
        sx={{ aspectRatio: "9/16", width: "100%" }}
      />
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        <Skeleton variant="rounded" width={80} height={22} />
        <Skeleton variant="text" sx={{ fontSize: "0.9rem" }} />
        <Skeleton variant="text" width="70%" sx={{ fontSize: "0.8rem" }} />
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Skeleton variant="rounded" height={30} sx={{ flex: 1 }} />
          <Skeleton variant="rounded" width={34} height={30} />
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Prompt dialog
// ---------------------------------------------------------------------------

function PromptDialog({
  item,
  onClose,
}: {
  item: PromptLibraryItem | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently ignore
    }
  }, [item]);

  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: "#0D1117",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          color: "secondary.main",
          fontWeight: 700,
          fontSize: "1.1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pr: 1.5,
        }}
      >
        {item?.title ?? ""}
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: "rgba(255,255,255,0.5)" }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        {item?.description && (
          <Typography
            sx={{
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.55)",
              mb: 2,
            }}
          >
            {item.description}
          </Typography>
        )}
        <Box
          sx={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {item?.promptText ?? ""}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          variant="contained"
          startIcon={copied ? <Check /> : <ContentCopy />}
          onClick={handleCopy}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            background: copied
              ? "rgba(52,211,153,0.2)"
              : "rgba(45,212,255,0.15)",
            color: copied ? "#34d399" : "primary.main",
            border: "1px solid",
            borderColor: copied ? "#34d399" : "primary.main",
            boxShadow: "none",
            "&:hover": {
              background: copied
                ? "rgba(52,211,153,0.25)"
                : "rgba(45,212,255,0.2)",
              boxShadow: "none",
            },
          }}
        >
          {copied ? "Copiado!" : "Copiar prompt"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PromptLibraryPage() {
  const { items, categories, isLoading, error } = usePromptLibrary();
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [promptItem, setPromptItem] = useState<PromptLibraryItem | null>(null);

  const filteredItems = useMemo(() => {
    if (!activeCategory) return items;
    return items.filter(
      (i) => i.category.toLowerCase() === activeCategory.toLowerCase(),
    );
  }, [items, activeCategory]);

  const handleCategoryClick = useCallback(
    (cat: string) => {
      setActiveCategory((prev) => (prev === cat ? "" : cat));
    },
    [],
  );

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <MenuBook
            sx={{ color: "primary.main", fontSize: "1.75rem" }}
          />
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "1.5rem", md: "1.75rem" },
              fontWeight: 700,
              color: "#fff",
            }}
          >
            Biblioteca de Prompts
          </Typography>
        </Box>
        <Typography
          sx={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.5)" }}
        >
          Explore vídeos de referência e use os prompts prontos nos seus
          conteúdos.
        </Typography>
      </Box>

      {/* Error */}
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#ef4444",
          }}
        >
          Não foi possível carregar a biblioteca. Tente novamente mais tarde.
        </Alert>
      )}

      {/* Category filter chips */}
      {(isLoading || categories.length > 0) && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            mb: 3,
          }}
        >
          {isLoading ? (
            <>
              {[80, 100, 70, 90].map((w) => (
                <Skeleton
                  key={w}
                  variant="rounded"
                  width={w}
                  height={30}
                  sx={{ borderRadius: 4 }}
                />
              ))}
            </>
          ) : (
            <>
              <Chip
                label="Todos"
                onClick={() => setActiveCategory("")}
                sx={{
                  cursor: "pointer",
                  fontWeight: activeCategory === "" ? 700 : 400,
                  background:
                    activeCategory === ""
                      ? "rgba(45,212,255,0.15)"
                      : "rgba(255,255,255,0.05)",
                  color: activeCategory === "" ? "primary.main" : "rgba(255,255,255,0.7)",
                  border: "1px solid",
                  borderColor:
                    activeCategory === ""
                      ? "primary.main"
                      : "rgba(255,255,255,0.1)",
                  "&:hover": {
                    background: "rgba(45,212,255,0.1)",
                    borderColor: "primary.main",
                  },
                }}
              />
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  onClick={() => handleCategoryClick(cat)}
                  sx={{
                    cursor: "pointer",
                    fontWeight: activeCategory === cat ? 700 : 400,
                    background:
                      activeCategory === cat
                        ? "rgba(45,212,255,0.15)"
                        : "rgba(255,255,255,0.05)",
                    color:
                      activeCategory === cat
                        ? "primary.main"
                        : "rgba(255,255,255,0.7)",
                    border: "1px solid",
                    borderColor:
                      activeCategory === cat
                        ? "primary.main"
                        : "rgba(255,255,255,0.1)",
                    "&:hover": {
                      background: "rgba(45,212,255,0.1)",
                      borderColor: "primary.main",
                    },
                  }}
                />
              ))}
            </>
          )}
        </Box>
      )}

      {/* Grid */}
      {isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid item key={i} xs={12} sm={6} md={4} lg={3}>
              <CardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : filteredItems.length === 0 ? (
        /* Empty state */
        <Box
          sx={{
            borderRadius: 3,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(45,212,255,0.08)",
            p: 8,
            textAlign: "center",
          }}
        >
          <MenuBook
            sx={{ fontSize: 48, color: "rgba(255,255,255,0.15)", mb: 2 }}
          />
          <Typography
            sx={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.4)",
              mb: 0.5,
            }}
          >
            {activeCategory
              ? "Nenhum prompt nesta categoria"
              : "Biblioteca vazia"}
          </Typography>
          <Typography
            sx={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.25)" }}
          >
            {activeCategory
              ? "Tente selecionar outra categoria."
              : "Nenhum prompt foi adicionado ainda."}
          </Typography>
          {activeCategory && (
            <Button
              size="small"
              onClick={() => setActiveCategory("")}
              sx={{
                mt: 2,
                textTransform: "none",
                color: "primary.main",
                fontSize: "0.82rem",
              }}
            >
              Ver todos
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredItems.map((item) => (
            <Grid item key={item.id} xs={12} sm={6} md={4} lg={3}>
              <PromptVideoCard item={item} onViewPrompt={setPromptItem} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Prompt dialog */}
      <PromptDialog item={promptItem} onClose={() => setPromptItem(null)} />
    </Container>
  );
}
