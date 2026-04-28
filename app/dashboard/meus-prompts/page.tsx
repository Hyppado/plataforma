"use client";

import { useState } from "react";
import {
  Box,
  Container,
  Typography,
  Chip,
  Skeleton,
  Button,
  Divider,
} from "@mui/material";
import {
  AutoAwesome,
  CheckCircleOutline,
  EditNoteOutlined,
  ErrorOutline,
  HourglassEmpty,
  ImageOutlined,
  Add,
} from "@mui/icons-material";
import Link from "next/link";
import NextImage from "next/image";
import { useAvatarVideoCreations } from "@/lib/swr/useAvatarVideoCreations";
import type { CreationDTO } from "@/lib/avatar-video/types";
import type { AvatarVideoCreationStatus } from "@prisma/client";
import type { Veo3Prompt } from "@/lib/avatar-video/veo-prompt";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_META: Record<
  AvatarVideoCreationStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: "Rascunho",
    color: "rgba(255,255,255,0.5)",
    bg: "rgba(255,255,255,0.06)",
    icon: <EditNoteOutlined sx={{ fontSize: 11 }} />,
  },
  PENDING_IMAGES: {
    label: "Gerando imagens",
    color: "#2DD4FF",
    bg: "rgba(45,212,255,0.08)",
    icon: <HourglassEmpty sx={{ fontSize: 11 }} />,
  },
  IMAGES_READY: {
    label: "Imagens prontas",
    color: "#2DD4FF",
    bg: "rgba(45,212,255,0.08)",
    icon: <ImageOutlined sx={{ fontSize: 11 }} />,
  },
  PENDING_CONCEPT: {
    label: "Gerando conceito",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.08)",
    icon: <HourglassEmpty sx={{ fontSize: 11 }} />,
  },
  CONCEPT_READY: {
    label: "Conceito pronto",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.08)",
    icon: <AutoAwesome sx={{ fontSize: 11 }} />,
  },
  PENDING_PROMPT: {
    label: "Gerando roteiro",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    icon: <HourglassEmpty sx={{ fontSize: 11 }} />,
  },
  PROMPT_READY: {
    label: "Roteiro pronto",
    color: "#34d399",
    bg: "rgba(52,211,153,0.08)",
    icon: <CheckCircleOutline sx={{ fontSize: 11 }} />,
  },
  COMPLETED: {
    label: "Concluído",
    color: "#34d399",
    bg: "rgba(52,211,153,0.08)",
    icon: <CheckCircleOutline sx={{ fontSize: 11 }} />,
  },
  FAILED: {
    label: "Falhou",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    icon: <ErrorOutline sx={{ fontSize: 11 }} />,
  },
};

function StatusBadge({ status }: { status: AvatarVideoCreationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  return (
    <Chip
      icon={<Box sx={{ color: `${meta.color} !important`, display: "flex" }}>{meta.icon}</Box>}
      label={meta.label}
      size="small"
      sx={{
        height: 20,
        fontSize: "0.65rem",
        fontWeight: 600,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.color}22`,
        "& .MuiChip-label": { px: 0.75 },
        "& .MuiChip-icon": { ml: 0.75, mr: -0.25 },
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Single card
// ---------------------------------------------------------------------------

function CreationCard({ creation }: { creation: CreationDTO }) {
  const href = `/dashboard/avatar-video/${creation.id}`;

  const selectedVariation =
    creation.selectedImageVariationId != null
      ? creation.imageVariations.find(
          (v) => v.id === creation.selectedImageVariationId,
        )
      : creation.imageVariations.find((v) => v.status === "READY");

  const referenceImageUrl = selectedVariation?.blobUrl ?? null;
  const productImageUrl = creation.productSelectedImageUrl ?? creation.productImageUrl;

  const takes =
    creation.prompt?.promptJson != null
      ? ((creation.prompt.promptJson as Veo3Prompt).takes ?? [])
      : [];

  const concept = creation.concept;
  const hasPrompt = creation.status === "PROMPT_READY" || creation.status === "COMPLETED";

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(creation.createdAt));

  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: "block",
        textDecoration: "none",
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.025)",
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
        "&:hover": {
          borderColor: "rgba(45,212,255,0.25)",
          background: "rgba(255,255,255,0.04)",
        },
      }}
    >
      {/* Top: product + reference images */}
      <Box sx={{ display: "flex", height: 120, overflow: "hidden" }}>
        {/* Product image */}
        <Box
          sx={{
            width: 96,
            flexShrink: 0,
            position: "relative",
            background: "rgba(255,255,255,0.04)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {productImageUrl ? (
            <NextImage
              src={productImageUrl}
              alt={creation.productName ?? "Produto"}
              fill
              style={{ objectFit: "cover" }}
              sizes="96px"
              unoptimized
            />
          ) : (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImageOutlined sx={{ fontSize: 28, color: "rgba(255,255,255,0.15)" }} />
            </Box>
          )}
        </Box>

        {/* Reference image (generated) */}
        <Box
          sx={{
            flex: 1,
            position: "relative",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          {referenceImageUrl ? (
            <NextImage
              src={referenceImageUrl}
              alt="Imagem de referência"
              fill
              style={{ objectFit: "cover" }}
              sizes="(max-width: 600px) calc(100vw - 96px), 240px"
              unoptimized
            />
          ) : (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
              }}
            >
              <AutoAwesome sx={{ fontSize: 22, color: "rgba(255,255,255,0.1)" }} />
              <Typography
                sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)" }}
              >
                Sem imagem
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        {/* Status + date */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <StatusBadge status={creation.status as AvatarVideoCreationStatus} />
          <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)" }}>
            {formattedDate}
          </Typography>
        </Box>

        {/* Product name */}
        <Typography
          sx={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {creation.productName ?? "Produto sem nome"}
        </Typography>

        {/* Concept snippet */}
        {concept?.hook && (
          <>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />
            <Box>
              <Typography
                sx={{
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  color: "rgba(167,139,250,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  mb: 0.25,
                }}
              >
                Hook
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {concept.hook}
              </Typography>
            </Box>
          </>
        )}

        {/* Takes preview */}
        {hasPrompt && takes.length > 0 && (
          <>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />
            <Box>
              <Typography
                sx={{
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  color: "rgba(52,211,153,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  mb: 0.5,
                }}
              >
                {takes.length} take{takes.length !== 1 ? "s" : ""} gerados
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                {takes.slice(0, 2).map((take) => (
                  <Typography
                    key={take.index}
                    sx={{
                      fontSize: "0.7rem",
                      color: "rgba(255,255,255,0.45)",
                      lineHeight: 1.35,
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    <Box component="span" sx={{ color: "rgba(52,211,153,0.5)", fontWeight: 600 }}>
                      T{take.index}
                    </Box>{" "}
                    {take.spokenLines || take.visualDirection}
                  </Typography>
                ))}
                {takes.length > 2 && (
                  <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>
                    +{takes.length - 2} take{takes.length - 2 !== 1 ? "s" : ""}
                  </Typography>
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CreationCardSkeleton() {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.025)",
        overflow: "hidden",
      }}
    >
      <Skeleton variant="rectangular" height={120} sx={{ bgcolor: "rgba(255,255,255,0.05)" }} />
      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Skeleton variant="rounded" width={90} height={20} sx={{ bgcolor: "rgba(255,255,255,0.05)" }} />
          <Skeleton variant="text" width={50} sx={{ bgcolor: "rgba(255,255,255,0.04)" }} />
        </Box>
        <Skeleton variant="text" width="80%" sx={{ bgcolor: "rgba(255,255,255,0.05)" }} />
        <Skeleton variant="text" width="60%" sx={{ bgcolor: "rgba(255,255,255,0.04)" }} />
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type FilterKey = "all" | "completed" | "draft";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "completed", label: "Concluídos" },
  { key: "draft", label: "Em andamento" },
];

function filterCreations(creations: CreationDTO[], filter: FilterKey): CreationDTO[] {
  if (filter === "completed") {
    return creations.filter(
      (c) => c.status === "COMPLETED" || c.status === "PROMPT_READY",
    );
  }
  if (filter === "draft") {
    return creations.filter(
      (c) =>
        c.status !== "COMPLETED" &&
        c.status !== "PROMPT_READY" &&
        c.status !== "FAILED",
    );
  }
  return creations;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MeusPromptsPage() {
  const { creations, isLoading, error } = useAvatarVideoCreations();
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = filterCreations(creations, filter);

  const completedCount = creations.filter(
    (c) => c.status === "COMPLETED" || c.status === "PROMPT_READY",
  ).length;
  const draftCount = creations.filter(
    (c) =>
      c.status !== "COMPLETED" &&
      c.status !== "PROMPT_READY" &&
      c.status !== "FAILED",
  ).length;

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "1.5rem", md: "1.75rem" },
              fontWeight: 700,
              color: "#fff",
              mb: 0.5,
            }}
          >
            Meus Prompts
          </Typography>
          <Typography
            sx={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.5)" }}
          >
            {isLoading
              ? "Carregando…"
              : `${creations.length} ${creations.length === 1 ? "criação" : "criações"} — ${completedCount} concluída${completedCount !== 1 ? "s" : ""}, ${draftCount} em andamento`}
          </Typography>
        </Box>

        <Button
          component={Link}
          href="/dashboard/trends"
          variant="contained"
          startIcon={<Add />}
          size="small"
          sx={{ borderRadius: 2, fontWeight: 600, flexShrink: 0 }}
        >
          Novo prompt
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 0.75, mb: 3, flexWrap: "wrap" }}>
        {FILTERS.map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            onClick={() => setFilter(key)}
            variant={filter === key ? "filled" : "outlined"}
            size="small"
            sx={{
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: filter === key ? 700 : 400,
              color: filter === key ? "#000" : "rgba(255,255,255,0.55)",
              background: filter === key ? "primary.main" : "transparent",
              bgcolor: filter === key ? "primary.main" : "transparent",
              borderColor:
                filter === key
                  ? "primary.main"
                  : "rgba(255,255,255,0.12)",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.25)",
                bgcolor: filter === key ? "primary.dark" : "rgba(255,255,255,0.04)",
              },
            }}
          />
        ))}
      </Box>

      {/* Error */}
      {error && (
        <Box
          role="alert"
          sx={{
            p: 2,
            borderRadius: 2,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#ef4444",
            fontSize: "0.875rem",
            mb: 3,
          }}
        >
          {error}
        </Box>
      )}

      {/* Loading */}
      {isLoading && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(4, 1fr)",
            },
            gap: 2,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <CreationCardSkeleton key={i} />
          ))}
        </Box>
      )}

      {/* Empty state */}
      {!isLoading && !error && creations.length === 0 && (
        <Box
          sx={{
            borderRadius: 3,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(45,212,255,0.08)",
            p: { xs: 5, md: 8 },
            textAlign: "center",
          }}
        >
          <AutoAwesome sx={{ fontSize: 40, color: "rgba(45,212,255,0.25)", mb: 2 }} />
          <Typography
            sx={{ fontSize: "1rem", fontWeight: 600, color: "#fff", mb: 1 }}
          >
            Nenhum prompt ainda
          </Typography>
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.45)",
              mb: 3,
              maxWidth: 360,
              mx: "auto",
            }}
          >
            Escolha um produto em Produtos Hype e crie seu primeiro vídeo com
            avatar.
          </Typography>
          <Button
            component={Link}
            href="/dashboard/trends"
            variant="contained"
            startIcon={<Add />}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Escolher produto
          </Button>
        </Box>
      )}

      {/* Empty filtered state */}
      {!isLoading && !error && creations.length > 0 && filtered.length === 0 && (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography sx={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.4)" }}>
            Nenhuma criação nesta categoria.
          </Typography>
        </Box>
      )}

      {/* Grid */}
      {!isLoading && !error && filtered.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(4, 1fr)",
            },
            gap: 2,
          }}
        >
          {filtered.map((creation) => (
            <CreationCard key={creation.id} creation={creation} />
          ))}
        </Box>
      )}
    </Container>
  );
}
