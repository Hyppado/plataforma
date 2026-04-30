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
  IconButton,
  Tooltip,
  Alert,
} from "@mui/material";
import {
  ContentCopy,
  Check,
  Close,
  MenuBook,
  ErrorOutline,
} from "@mui/icons-material";
import {
  usePromptLibrary,
  type PromptLibraryItem,
} from "@/lib/swr/usePromptLibrary";
import { useCopyToClipboard } from "@/lib/swr/useCopyToClipboard";
import { resolveEmbed } from "@/lib/prompt-library/embed";

// ---------------------------------------------------------------------------
// Shared video renderer — handles all supported platforms (YouTube, Vimeo,
// TikTok, Instagram, direct file URLs)
// ---------------------------------------------------------------------------

function isVimeoOrIframeOnly(src: string): boolean {
  const embed = resolveEmbed(src);
  return !!embed && embed.kind === "iframe";
}

function VideoRenderer({
  src,
  videoRef,
  style,
  sx,
}: {
  src: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  style?: React.CSSProperties;
  sx?: object;
}) {
  const embed = resolveEmbed(src);
  if (!embed) return null;
  if (embed.kind === "iframe") {
    return (
      <Box
        component="iframe"
        src={embed.src}
        allow="autoplay; fullscreen; picture-in-picture"
        frameBorder={0}
        sx={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          ...sx,
        }}
      />
    );
  }
  return (
    <video
      ref={videoRef}
      src={embed.src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Video card — autoplays and loops silently
// ---------------------------------------------------------------------------

function PromptVideoCard({
  item,
  onViewPrompt,
}: {
  item: PromptLibraryItem;
  onViewPrompt: (item: PromptLibraryItem) => void;
}) {
  const { copyState, copy } = useCopyToClipboard();

  const handleCopy = useCallback(
    () => copy(item.promptText),
    [copy, item.promptText],
  );

  return (
    <Box
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
          aspectRatio: "9/16",
          background: "#000",
          overflow: "hidden",
        }}
      >
        <VideoRenderer
          src={item.videoBlobUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          sx={{ aspectRatio: "9/16" }}
        />
      </Box>

      {/* Card content */}
      <Box
        sx={{
          p: { xs: 1, sm: 2 },
          display: "flex",
          flexDirection: "column",
          gap: { xs: 0.75, sm: 1.5 },
          flex: 1,
        }}
      >
        {/* Category chip */}
        <Chip
          label={item.category}
          size="small"
          sx={{
            alignSelf: "flex-start",
            fontSize: { xs: "0.6rem", sm: "0.7rem" },
            height: { xs: 18, sm: 22 },
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
            fontSize: { xs: "0.75rem", sm: "0.9rem" },
            color: "#fff",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: { xs: 2, sm: 3 },
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.title}
        </Typography>

        {/* Description — hidden on mobile to save space */}
        {item.description && (
          <Typography
            sx={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.5,
              display: { xs: "none", sm: "-webkit-box" },
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </Typography>
        )}

        {/* Actions */}
        <Box sx={{ display: "flex", gap: { xs: 0.5, sm: 1 }, mt: "auto" }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onViewPrompt(item)}
            sx={{
              flex: 1,
              fontSize: { xs: "0.65rem", sm: "0.75rem" },
              px: { xs: 0.5, sm: 1 },
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
          <Tooltip
            title={
              copyState === "success"
                ? "Copiado!"
                : copyState === "error"
                  ? "Falha ao copiar"
                  : "Copiar prompt"
            }
          >
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                border: "1px solid",
                borderRadius: 1,
                borderColor:
                  copyState === "success"
                    ? "primary.main"
                    : copyState === "error"
                      ? "#ef4444"
                      : "rgba(255,255,255,0.15)",
                color:
                  copyState === "success"
                    ? "primary.main"
                    : copyState === "error"
                      ? "#ef4444"
                      : "rgba(255,255,255,0.6)",
                "&:hover": {
                  borderColor:
                    copyState === "error" ? "#ef4444" : "primary.main",
                  color: copyState === "error" ? "#ef4444" : "primary.main",
                  background:
                    copyState === "error"
                      ? "rgba(239,68,68,0.05)"
                      : "rgba(45,212,255,0.05)",
                },
              }}
            >
              {copyState === "success" ? (
                <Check sx={{ fontSize: 16 }} />
              ) : copyState === "error" ? (
                <ErrorOutline sx={{ fontSize: 16 }} />
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
// Detail modal — video + full prompt
// ---------------------------------------------------------------------------

function PromptDialog({
  item,
  onClose,
}: {
  item: PromptLibraryItem | null;
  onClose: () => void;
}) {
  const { copyState, copy } = useCopyToClipboard();
  const videoRef = useRef<HTMLVideoElement>(null);
  const open = item !== null;
  const isVimeo = item ? isVimeoOrIframeOnly(item.videoBlobUrl) : false;

  // Play video when dialog opens, pause when it closes (native video only)
  const handleEntered = useCallback(() => {
    if (!isVimeo) videoRef.current?.play().catch(() => {});
  }, [isVimeo]);

  const handleExited = useCallback(() => {
    if (isVimeo) return;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  }, [isVimeo]);

  const handleCopy = useCallback(() => {
    if (!item) return;
    copy(item.promptText);
  }, [copy, item]);

  // Reset copy state tracking when a different item is opened
  const prevIdRef = useRef<string | null>(null);
  if (item && item.id !== prevIdRef.current) {
    prevIdRef.current = item.id;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionProps={{ onEntered: handleEntered, onExited: handleExited }}
      PaperProps={{
        sx: {
          background: "#0D1117",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 3,
          overflow: "hidden",
          m: { xs: 1, sm: 2 },
          maxHeight: { xs: "calc(100dvh - 16px)", sm: "calc(100dvh - 64px)" },
        },
      }}
    >
      {/* Close button — absolute so it floats above both columns */}
      <IconButton
        size="small"
        onClick={onClose}
        aria-label="Fechar"
        sx={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          color: "rgba(255,255,255,0.7)",
          "&:hover": { background: "rgba(0,0,0,0.75)", color: "#fff" },
        }}
      >
        <Close sx={{ fontSize: 18 }} />
      </IconButton>

      {/* Two-column layout: video | content */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          height: "100%",
          maxHeight: "inherit",
        }}
      >
        {/* Left — video */}
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: "100%", sm: 220, md: 260 },
            maxHeight: { xs: 320, sm: "none" },
            background: "#000",
            display: "flex",
            alignItems: "stretch",
          }}
        >
          {item && (
            <VideoRenderer
              src={item.videoBlobUrl}
              videoRef={videoRef}
              style={{ width: "100%", objectFit: "cover", display: "block" }}
              sx={{ flex: 1 }}
            />
          )}
        </Box>

        {/* Right — content */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <Box sx={{ px: 3, pt: 3, pb: 1.5, flexShrink: 0 }}>
            <Chip
              label={item?.category ?? ""}
              size="small"
              sx={{
                fontSize: "0.7rem",
                height: 22,
                mb: 1.5,
                color: "primary.main",
                background: "rgba(45,212,255,0.08)",
                border: "1px solid rgba(45,212,255,0.2)",
                borderRadius: 1,
              }}
            />
            <Typography
              component="h2"
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1rem", sm: "1.15rem" },
                color: "#fff",
                lineHeight: 1.3,
                mb: item?.description ? 1 : 0,
                pr: 4, // avoid overlap with close button
              }}
            >
              {item?.title ?? ""}
            </Typography>
            {item?.description && (
              <Typography
                sx={{
                  fontSize: "0.82rem",
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.5,
                }}
              >
                {item.description}
              </Typography>
            )}
            <Typography
              sx={{
                mt: 1.5,
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
            >
              Prompt de referência
            </Typography>
          </Box>

          {/* Scrollable prompt text */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              px: 3,
              pb: 1,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-track": { background: "transparent" },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(255,255,255,0.12)",
                borderRadius: 2,
              },
            }}
          >
            <Box
              sx={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 2,
                p: 2,
              }}
            >
              <Typography
                component="pre"
                sx={{
                  fontSize: { xs: "0.8rem", sm: "0.875rem" },
                  color: "rgba(255,255,255,0.88)",
                  lineHeight: 1.75,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "inherit",
                  m: 0,
                }}
              >
                {item?.promptText ?? ""}
              </Typography>
            </Box>
          </Box>

          {/* Footer actions */}
          <Box
            sx={{
              px: 3,
              py: 2,
              flexShrink: 0,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <Button
              variant="contained"
              fullWidth
              startIcon={
                copyState === "success" ? (
                  <Check />
                ) : copyState === "error" ? (
                  <ErrorOutline />
                ) : (
                  <ContentCopy />
                )
              }
              onClick={handleCopy}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.875rem",
                py: 1,
                background:
                  copyState === "success"
                    ? "rgba(52,211,153,0.15)"
                    : copyState === "error"
                      ? "rgba(239,68,68,0.12)"
                      : "rgba(45,212,255,0.12)",
                color:
                  copyState === "success"
                    ? "#34d399"
                    : copyState === "error"
                      ? "#ef4444"
                      : "primary.main",
                border: "1px solid",
                borderColor:
                  copyState === "success"
                    ? "#34d399"
                    : copyState === "error"
                      ? "#ef4444"
                      : "primary.main",
                boxShadow: "none",
                "&:hover": {
                  background:
                    copyState === "success"
                      ? "rgba(52,211,153,0.22)"
                      : copyState === "error"
                        ? "rgba(239,68,68,0.18)"
                        : "rgba(45,212,255,0.2)",
                  boxShadow: "none",
                },
              }}
            >
              {copyState === "success"
                ? "Prompt copiado!"
                : copyState === "error"
                  ? "Falha ao copiar"
                  : "Copiar prompt"}
            </Button>
          </Box>
        </Box>
      </Box>
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

  const handleCategoryClick = useCallback((cat: string) => {
    setActiveCategory((prev) => (prev === cat ? "" : cat));
  }, []);

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <MenuBook sx={{ color: "primary.main", fontSize: "1.75rem" }} />
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
                  color:
                    activeCategory === ""
                      ? "primary.main"
                      : "rgba(255,255,255,0.7)",
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
        <Box sx={{ position: "relative" }}>
          <Grid container spacing={{ xs: 1, sm: 2 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Grid item key={i} xs={6} sm={6} md={4} lg={3}>
                <CardSkeleton />
              </Grid>
            ))}
          </Grid>
          {/* Mobile peek gradient */}
          <Box
            sx={{
              display: { xs: "block", sm: "none" },
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
              background: "linear-gradient(to bottom, transparent, #070B12)",
              pointerEvents: "none",
            }}
          />
        </Box>
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
        <Box sx={{ position: "relative" }}>
          <Grid container spacing={{ xs: 1, sm: 2 }}>
            {filteredItems.map((item) => (
              <Grid item key={item.id} xs={6} sm={6} md={4} lg={3}>
                <PromptVideoCard item={item} onViewPrompt={setPromptItem} />
              </Grid>
            ))}
          </Grid>
          {/* Mobile peek gradient — hints at more content below */}
          {filteredItems.length > 4 && (
            <Box
              sx={{
                display: { xs: "block", sm: "none" },
                position: "sticky",
                bottom: 0,
                left: 0,
                right: 0,
                height: 80,
                mt: -10,
                background: "linear-gradient(to bottom, transparent, #070B12)",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>
      )}

      {/* Prompt dialog */}
      <PromptDialog item={promptItem} onClose={() => setPromptItem(null)} />
    </Container>
  );
}
