"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Grid,
  Avatar,
  Skeleton,
  Chip,
} from "@mui/material";
import {
  Whatshot,
  VideoLibrary,
  FaceRetouchingNatural,
  MenuBook,
  FiberNew,
  Person,
  TrendingUp,
  TrendingDown,
  ArrowForward,
} from "@mui/icons-material";
import { useSession } from "next-auth/react";
import {
  useTrendingProducts,
  useTrendingVideos,
} from "@/lib/swr/useTrending";
import { getStoredRegion } from "@/lib/region";

import type { ProductDTO, VideoDTO } from "@/lib/types/dto";

// ---------------------------------------------------------------------------
// Quick-access tool cards
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    label: "Produtos Hype",
    description: "Produtos em alta no TikTok Shop",
    icon: Whatshot,
    href: "/dashboard/trends",
    color: "#FF2D78",
  },
  {
    label: "Vídeos em Alta",
    description: "Top vídeos por vendas e visualizações",
    icon: VideoLibrary,
    href: "/dashboard/videos",
    color: "#2DD4FF",
  },
  {
    label: "Vídeo com Avatar",
    description: "Crie imagens UGC com IA",
    icon: FaceRetouchingNatural,
    href: "/dashboard/influencer-ia",
    color: "#C7A3FF",
  },
  {
    label: "Novos Produtos",
    description: "Lançamentos recentes no Shop",
    icon: FiberNew,
    href: "/dashboard/products",
    color: "#81C784",
  },
  {
    label: "Creators",
    description: "Top criadores de conteúdo",
    icon: Person,
    href: "/dashboard/creators",
    color: "#FFB74D",
  },
  {
    label: "Biblioteca de Prompts",
    description: "Prompts prontos para TikTok",
    icon: MenuBook,
    href: "/dashboard/prompt-library",
    color: "#FF8A65",
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function growthColor(pct: number | null | undefined): string {
  if (pct == null) return "rgba(255,255,255,0.5)";
  return pct >= 0 ? "#81C784" : "#EF5350";
}

function formatGrowth(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("pt-BR");
}


// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ToolCard({
  label,
  description,
  icon: Icon,
  href,
  color,
}: (typeof TOOLS)[number]) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          p: 2,
          borderRadius: 2.5,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
          cursor: "pointer",
          transition: "border-color 150ms, background 150ms",
          height: "100%",
          "&:hover": {
            borderColor: `${color}40`,
            background: `${color}08`,
          },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon sx={{ fontSize: 18, color }} />
        </Box>
        <Box>
          <Typography
            sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", mb: 0.25 }}
          >
            {label}
          </Typography>
          <Typography
            sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.3 }}
          >
            {description}
          </Typography>
        </Box>
      </Box>
    </Link>
  );
}

function TopProductsTable({
  products,
  loading,
  region,
}: {
  products: ProductDTO[];
  loading: boolean;
  region: string;
}) {
  const router = useRouter();
  const regionLabel = region === "BR" ? "Brasil" : region;

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(10,15,24,0.8)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 2,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Whatshot sx={{ fontSize: 18, color: "secondary.main" }} />
          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
            Top Produtos {regionLabel}
          </Typography>
          <Chip
            label="Ao Vivo"
            size="small"
            sx={{
              height: 18,
              fontSize: "0.6rem",
              fontWeight: 700,
              background: "rgba(129,199,132,0.15)",
              color: "#81C784",
              border: "1px solid rgba(129,199,132,0.3)",
            }}
          />
        </Box>
        <Link
          href="/dashboard/trends"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
        >
          <Typography
            sx={{ fontSize: "0.75rem", color: "primary.main", fontWeight: 600 }}
          >
            Ver Ranking Completo
          </Typography>
          <ArrowForward sx={{ fontSize: 14, color: "primary.main" }} />
        </Link>
      </Box>

      {/* Column headers */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 110px",
          px: 2.5,
          py: 1,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {["PRODUTO & NICHO", "CRESCIMENTO (7D)", "UNIDADES VENDIDAS"].map((h) => (
          <Typography
            key={h}
            sx={{
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              "&:not(:first-of-type)": { textAlign: "right" },
            }}
          >
            {h}
          </Typography>
        ))}
      </Box>

      {/* Rows */}
      {loading
        ? Array.from({ length: 6 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 110px",
                px: 2.5,
                py: 1.4,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Skeleton variant="rounded" width={36} height={36} sx={{ bgcolor: "rgba(255,255,255,0.06)", borderRadius: 1.5 }} />
                <Box>
                  <Skeleton width={180} height={14} sx={{ bgcolor: "rgba(255,255,255,0.06)" }} />
                  <Skeleton width={60} height={11} sx={{ bgcolor: "rgba(255,255,255,0.04)", mt: 0.5 }} />
                </Box>
              </Box>
              <Skeleton width={50} height={14} sx={{ bgcolor: "rgba(255,255,255,0.06)", ml: "auto" }} />
              <Skeleton width={60} height={14} sx={{ bgcolor: "rgba(255,255,255,0.06)", ml: "auto" }} />
            </Box>
          ))
        : products.slice(0, 8).map((p) => (
            <Box
              key={p.id}
              onClick={() => router.push(`/dashboard/trends`)}
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 110px",
                px: 2.5,
                py: 1.4,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                cursor: "pointer",
                transition: "background 120ms",
                "&:hover": { background: "rgba(255,255,255,0.02)" },
                "&:last-child": { borderBottom: "none" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar
                  src={p.imageUrl}
                  variant="rounded"
                  sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.06)" }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </Typography>
                  <Typography sx={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>
                    {p.category}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.4 }}>
                {(p as unknown as { growthRate?: number }).growthRate != null &&
                  ((p as unknown as { growthRate?: number }).growthRate! >= 0 ? (
                    <TrendingUp sx={{ fontSize: 13, color: "#81C784" }} />
                  ) : (
                    <TrendingDown sx={{ fontSize: 13, color: "#EF5350" }} />
                  ))}
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: growthColor((p as unknown as { growthRate?: number }).growthRate),
                  }}
                >
                  {formatGrowth((p as unknown as { growthRate?: number }).growthRate)}
                </Typography>
              </Box>

              <Typography
                sx={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.75)",
                  textAlign: "right",
                  alignSelf: "center",
                }}
              >
                {formatNumber(p.sales)}
              </Typography>
            </Box>
          ))}
    </Box>
  );
}

function TopVideosPreview({
  videos,
  loading,
}: {
  videos: VideoDTO[];
  loading: boolean;
}) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(10,15,24,0.8)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 2,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <VideoLibrary sx={{ fontSize: 18, color: "primary.main" }} />
          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
            Vídeos em Alta
          </Typography>
        </Box>
        <Link
          href="/dashboard/videos"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "primary.main", fontWeight: 600 }}>
            Ver Todos
          </Typography>
          <ArrowForward sx={{ fontSize: 14, color: "primary.main" }} />
        </Link>
      </Box>

      {/* Column headers */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 90px 90px",
          px: 2.5,
          py: 1,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {["VÍDEO & CRIADOR", "VENDAS", "VISUALIZAÇÕES"].map((h) => (
          <Typography
            key={h}
            sx={{
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              "&:not(:first-of-type)": { textAlign: "right" },
            }}
          >
            {h}
          </Typography>
        ))}
      </Box>

      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px",
                px: 2.5,
                py: 1.4,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Skeleton variant="rounded" width={40} height={52} sx={{ bgcolor: "rgba(255,255,255,0.06)", borderRadius: 1 }} />
                <Box>
                  <Skeleton width={160} height={13} sx={{ bgcolor: "rgba(255,255,255,0.06)" }} />
                  <Skeleton width={80} height={11} sx={{ bgcolor: "rgba(255,255,255,0.04)", mt: 0.5 }} />
                </Box>
              </Box>
              <Skeleton width={50} height={13} sx={{ bgcolor: "rgba(255,255,255,0.06)", ml: "auto" }} />
              <Skeleton width={60} height={13} sx={{ bgcolor: "rgba(255,255,255,0.06)", ml: "auto" }} />
            </Box>
          ))
        : videos.slice(0, 6).map((v) => (
            <Box
              key={v.id}
              component="a"
              href={v.tiktokUrl || v.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px",
                px: 2.5,
                py: 1.4,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                textDecoration: "none",
                cursor: "pointer",
                transition: "background 120ms",
                "&:hover": { background: "rgba(255,255,255,0.02)" },
                "&:last-child": { borderBottom: "none" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                <Avatar
                  src={v.thumbnailUrl ?? undefined}
                  variant="rounded"
                  sx={{ width: 40, height: 52, borderRadius: 1, bgcolor: "rgba(255,255,255,0.06)", flexShrink: 0 }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {v.title || "—"}
                  </Typography>
                  <Typography sx={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.4)" }}>
                    @{v.creatorHandle}
                  </Typography>
                </Box>
              </Box>
              <Typography
                sx={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.75)", textAlign: "right", alignSelf: "center" }}
              >
                {formatNumber(v.sales)}
              </Typography>
              <Typography
                sx={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.75)", textAlign: "right", alignSelf: "center" }}
              >
                {formatNumber(v.views)}
              </Typography>
            </Box>
          ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardHomePage() {
  const { data: session } = useSession();
  const region = getStoredRegion();

  const firstName = useMemo(() => {
    const name = session?.user?.name;
    if (!name) return null;
    return name.trim().split(/\s+/)[0];
  }, [session]);

  const { items: products, isLoading: productsLoading } = useTrendingProducts({
    range: "7d",
    region,
    sort: "sales",
    pageSize: 8,
  });

  const { items: videos, isLoading: videosLoading } = useTrendingVideos({
    range: "7d",
    region,
    sort: "sales",
    pageSize: 6,
  });

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* Welcome header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 0.5 }}>
          {firstName ? `Olá, ${firstName}! 👋` : "Bem-vindo ao Hyppado!"}
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.95rem" }}>
          Confira o que está em alta hoje no TikTok Shop.
        </Typography>
      </Box>

      {/* Quick access tools */}
      <Box sx={{ mb: 4 }}>
        <Typography
          sx={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", mb: 1.5 }}
        >
          Acesso Rápido
        </Typography>
        <Grid container spacing={1.5}>
          {TOOLS.map((tool) => (
            <Grid item xs={6} sm={4} md={2} key={tool.href}>
              <ToolCard {...tool} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Main content: two columns */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <TopProductsTable
            products={products}
            loading={productsLoading}
            region={region}
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <TopVideosPreview videos={videos} loading={videosLoading} />
        </Grid>
      </Grid>
    </Box>
  );
}
