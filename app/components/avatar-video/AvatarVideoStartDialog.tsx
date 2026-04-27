"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { Close, Videocam, CheckCircle } from "@mui/icons-material";
import type { ProductDTO } from "@/lib/types/dto";

// ── palette ────────────────────────────────────────────────────
const ACCENT = "#2DD4FF";
const BG = "#0A0F18";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "rgba(255,255,255,0.92)";
const TEXT_SECONDARY = "rgba(255,255,255,0.65)";
const SECONDARY = "#FF2D78";

type Source = "products-hype" | "new-products";

interface AvatarVideoStartDialogProps {
  open: boolean;
  onClose: () => void;
  product: ProductDTO;
  source: Source;
  /** Images already fetched by the parent (e.g. ProductDetailsModal). When
   *  provided the dialog skips the extra API call. */
  preloadedImages?: string[];
}

export function AvatarVideoStartDialog({
  open,
  onClose,
  product,
  source,
  preloadedImages,
}: AvatarVideoStartDialogProps) {
  const router = useRouter();

  const [images, setImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load images when dialog opens ─────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (preloadedImages && preloadedImages.length > 0) {
      setImages(preloadedImages);
      setSelectedImage(preloadedImages[0]);
      return;
    }

    setLoadingImages(true);
    setError(null);

    fetch(`/api/trending/products/${product.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        const imgs: string[] =
          Array.isArray(data.images) && data.images.length > 0
            ? data.images
            : product.imageUrl
              ? [product.imageUrl]
              : [];
        setImages(imgs);
        setSelectedImage(imgs[0] ?? null);
      })
      .catch(() => {
        const fallback = product.imageUrl ? [product.imageUrl] : [];
        setImages(fallback);
        setSelectedImage(fallback[0] ?? null);
      })
      .finally(() => setLoadingImages(false));
  }, [open, product.id, product.imageUrl, preloadedImages]);

  // ── Reset on close ─────────────────────────────────────────────
  const handleClose = () => {
    if (starting) return;
    setError(null);
    onClose();
  };

  // ── Start creation ─────────────────────────────────────────────
  const handleStart = async () => {
    if (!selectedImage || starting) return;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/avatar-video/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productExternalId: product.id,
          selectedProductImageUrl: selectedImage,
          source,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Erro ao iniciar geração",
        );
      }

      const data = (await res.json()) as { id: string };
      // Invalidate cached creation so the wizard always shows fresh data
      await mutate(`/api/avatar-video/creations/${data.id}`);
      router.push(`/dashboard/avatar-video/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar geração");
      setStarting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2.5,
            py: 2,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <Videocam sx={{ color: SECONDARY, fontSize: 20 }} />
          <Typography
            sx={{
              flex: 1,
              color: SECONDARY,
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            Criar vídeo com avatar
          </Typography>
          <IconButton
            size="small"
            onClick={handleClose}
            disabled={starting}
            sx={{ color: TEXT_SECONDARY, "&:hover": { color: TEXT_PRIMARY } }}
          >
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* ── Body ──────────────────────────────────────────────── */}
      <DialogContent sx={{ p: 2.5 }}>
        {/* Product name */}
        <Typography
          sx={{
            fontSize: "0.82rem",
            color: TEXT_SECONDARY,
            mb: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {product.name}
        </Typography>

        {/* Image area */}
        {loadingImages ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 5,
            }}
          >
            <CircularProgress size={26} sx={{ color: ACCENT }} />
          </Box>
        ) : images.length > 1 ? (
          <>
            <Typography
              sx={{
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
                mb: 1.25,
              }}
            >
              Escolha a imagem de referência
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
                mb: 2.5,
              }}
            >
              {images.map((img, i) => {
                const isSelected = img === selectedImage;
                return (
                  <Box
                    key={i}
                    role="button"
                    aria-label={`Imagem ${i + 1}${isSelected ? " (selecionada)" : ""}`}
                    tabIndex={0}
                    onClick={() => setSelectedImage(img)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setSelectedImage(img)
                    }
                    sx={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      borderRadius: 1.5,
                      overflow: "hidden",
                      cursor: "pointer",
                      border: isSelected
                        ? `2px solid ${ACCENT}`
                        : "2px solid transparent",
                      transition: "border-color 120ms ease",
                      "&:hover": {
                        borderColor: isSelected
                          ? ACCENT
                          : "rgba(45,212,255,0.45)",
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${ACCENT}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Box
                      component="img"
                      src={img}
                      alt={`Imagem ${i + 1}`}
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0.25";
                      }}
                    />
                    {isSelected && (
                      <Box
                        sx={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(45,212,255,0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CheckCircle sx={{ color: ACCENT, fontSize: 22 }} />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </>
        ) : images.length === 1 ? (
          <Box
            sx={{
              width: "100%",
              maxWidth: 180,
              aspectRatio: "1 / 1",
              mx: "auto",
              mb: 2.5,
              borderRadius: 2,
              overflow: "hidden",
              border: `2px solid ${ACCENT}`,
            }}
          >
            <Box
              component="img"
              src={images[0]}
              alt={product.name}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </Box>
        ) : null}

        {/* Error */}
        {error && (
          <Typography
            sx={{
              fontSize: "0.8rem",
              color: "#F87171",
              mb: 1.5,
              p: 1.25,
              borderRadius: 1.5,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
            }}
          >
            {error}
          </Typography>
        )}

        {/* CTA */}
        <Button
          fullWidth
          variant="contained"
          disabled={!selectedImage || starting || loadingImages}
          onClick={handleStart}
          startIcon={
            starting ? (
              <CircularProgress size={16} sx={{ color: "inherit" }} />
            ) : (
              <Videocam />
            )
          }
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
            "&:disabled": {
              background: "rgba(255,45,120,0.25)",
              color: "rgba(255,255,255,0.5)",
            },
          }}
        >
          {starting ? "Iniciando…" : "Iniciar criação"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
