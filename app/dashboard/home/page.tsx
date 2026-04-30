"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Typography, Avatar, Skeleton } from "@mui/material";
import {
  Whatshot,
  VideoLibrary,
  FaceRetouchingNatural,
  MenuBook,
  FiberNew,
  Person,
  EastOutlined,
} from "@mui/icons-material";
import { useSession } from "next-auth/react";
import { useTrendingProducts, useTrendingVideos } from "@/lib/swr/useTrending";
import { getStoredRegion, REGION_FLAGS } from "@/lib/region";
import type { ProductDTO, VideoDTO } from "@/lib/types/dto";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("pt-BR");
}

const TOOLS = [
  {
    label: "Produtos Hype",
    icon: Whatshot,
    href: "/dashboard/trends",
    color: "#FF2D78",
  },
  {
    label: "Vídeos em Alta",
    icon: VideoLibrary,
    href: "/dashboard/videos",
    color: "#2DD4FF",
  },
  {
    label: "Vídeo com Avatar",
    icon: FaceRetouchingNatural,
    href: "/dashboard/influencer-ia",
    color: "#C7A3FF",
  },
  {
    label: "Novos Produtos",
    icon: FiberNew,
    href: "/dashboard/products",
    color: "#81C784",
  },
  {
    label: "Creators",
    icon: Person,
    href: "/dashboard/creators",
    color: "#FFB74D",
  },
  {
    label: "Prompts",
    icon: MenuBook,
    href: "/dashboard/prompt-library",
    color: "#FF8A65",
  },
] as const;

function HeroBanner({ firstName }: { firstName: string | null }) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.07)",
        background:
          "linear-gradient(135deg, rgba(255,45,120,0.08) 0%, rgba(10,15,24,1) 50%, rgba(45,212,255,0.06) 100%)",
        overflow: "hidden",
        position: "relative",
        mb: 3,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { md: "center" },
          gap: 3,
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 3.5 },
        }}
      >
        <Box sx={{ flexShrink: 0, maxWidth: 360 }}>
          <Typography
            sx={{
              fontSize: { xs: "1.4rem", sm: "1.65rem" },
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: "#fff",
              mb: 1,
            }}
          >
            O QUE VOCÊ VAI{" "}
            <Box component="span" sx={{ color: "secondary.main" }}>
              CRIAR HOJE?
            </Box>
          </Typography>
          <Typography
            sx={{
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.5,
            }}
          >
            {firstName ? `Olá, ${firstName}. ` : ""}Da mineração de produtos ao
            vídeo final — tudo que você precisa para dominar o TikTok Shop.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            overflowX: "auto",
            flexShrink: 1,
            minWidth: 0,
            pb: 0.5,
            "&::-webkit-scrollbar": { height: 4 },
            "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 4,
            },
          }}
        >
          {TOOLS.map(({ label, icon: Icon, href, color }) => (
            <Link
              key={href}
              href={href}
              style={{ textDecoration: "none", flexShrink: 0 }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 1.75,
                  width: 110,
                  borderRadius: 2.5,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  transition:
                    "border-color 150ms, background 150ms, transform 150ms",
                  "&:hover": {
                    borderColor: `${color}50`,
                    background: `${color}0D`,
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 2,
                    background: `${color}18`,
                    border: `1px solid ${color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon sx={{ fontSize: 19, color }} />
                </Box>
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.8)",
                    textAlign: "center",
                    lineHeight: 1.25,
                  }}
                >
                  {label}
                </Typography>
              </Box>
            </Link>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function TopProductsPanel({
  products,
  loading,
  region,
}: {
  products: ProductDTO[];
  loading: boolean;
  region: string;
}) {
  const router = useRouter();
  const flag = REGION_FLAGS[region] ?? "";
  const regionLabel = region === "BR" ? "Brasil" : region;

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "#0C1018",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Whatshot sx={{ fontSize: 18, color: "secondary.main" }} />
          <Typography
            sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}
          >
            Top Produtos {flag} {regionLabel}
          </Typography>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.6,
              px: 1,
              py: 0.3,
              borderRadius: 10,
              background: "rgba(129,199,132,0.1)",
              border: "1px solid rgba(129,199,132,0.2)",
            }}
          >
            <Box
              sx={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                bgcolor: "#81C784",
                boxShadow: "0 0 6px #81C784",
              }}
            />
            <Typography
              sx={{
                fontSize: "0.6rem",
                fontWeight: 700,
                color: "#81C784",
                letterSpacing: "0.05em",
              }}
            >
              AO VIVO
            </Typography>
          </Box>
        </Box>
        <Link
          href="/dashboard/trends"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Typography
            sx={{ fontSize: "0.74rem", color: "primary.main", fontWeight: 600 }}
          >
            Ver ranking completo
          </Typography>
          <EastOutlined sx={{ fontSize: 13, color: "primary.main" }} />
        </Link>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "40px minmax(0,1fr) 80px",
          columnGap: 1.5,
          px: 3,
          py: 1,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {(["#", "PRODUTO & NICHO", "VENDAS"] as const).map((h, i) => (
          <Typography
            key={h}
            sx={{
              fontSize: "0.58rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.28)",
              textTransform: "uppercase",
              textAlign: i === 2 ? "right" : "left",
            }}
          >
            {h}
          </Typography>
        ))}
      </Box>

      {loading
        ? Array.from({ length: 8 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: "grid",
                gridTemplateColumns: "40px minmax(0,1fr) 80px",
                columnGap: 1.5,
                alignItems: "center",
                px: 3,
                py: 1.5,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <Skeleton
                width={18}
                height={14}
                sx={{ bgcolor: "rgba(255,255,255,0.06)" }}
              />
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                <Skeleton
                  variant="rounded"
                  width={38}
                  height={38}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.06)",
                    borderRadius: 1.5,
                    flexShrink: 0,
                  }}
                />
                <Box>
                  <Skeleton
                    width={160}
                    height={13}
                    sx={{ bgcolor: "rgba(255,255,255,0.06)" }}
                  />
                  <Skeleton
                    width={70}
                    height={11}
                    sx={{ bgcolor: "rgba(255,255,255,0.04)", mt: 0.5 }}
                  />
                </Box>
              </Box>
              <Skeleton
                width={36}
                height={13}
                sx={{ bgcolor: "rgba(255,255,255,0.06)", ml: "auto" }}
              />
            </Box>
          ))
        : products.slice(0, 8).map((p, i) => {
            const rank = i + 1;
            const rankColor =
              rank === 1
                ? "#FFD700"
                : rank === 2
                  ? "#C0C0C0"
                  : rank === 3
                    ? "#CD7F32"
                    : "rgba(255,255,255,0.28)";
            return (
              <Box
                key={p.id}
                onClick={() => router.push("/dashboard/trends")}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "40px minmax(0,1fr) 80px",
                  columnGap: 1.5,
                  alignItems: "center",
                  px: 3,
                  py: 1.5,
                  borderBottom: "1px solid rgba(255,255,255,0.035)",
                  cursor: "pointer",
                  transition: "background 120ms",
                  "&:hover": { background: "rgba(255,255,255,0.02)" },
                  "&:last-child": { borderBottom: "none" },
                }}
              >
                <Typography
                  sx={{
                    fontSize: rank <= 3 ? "0.85rem" : "0.72rem",
                    fontWeight: 800,
                    color: rankColor,
                  }}
                >
                  {rank <= 3 ? `#${rank}` : rank}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    minWidth: 0,
                  }}
                >
                  <Avatar
                    src={p.imageUrl}
                    variant="rounded"
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 1.5,
                      bgcolor: "rgba(255,255,255,0.06)",
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.92)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.68rem",
                        color: "rgba(255,255,255,0.38)",
                      }}
                    >
                      {p.category}
                    </Typography>
                  </Box>
                </Box>
                <Typography
                  sx={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.8)",
                    textAlign: "right",
                  }}
                >
                  {fmt(p.sales)}
                </Typography>
              </Box>
            );
          })}
    </Box>
  );
}

function TopVideosPanel({
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
        border: "1px solid rgba(255,255,255,0.07)",
        background: "#0C1018",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <VideoLibrary sx={{ fontSize: 18, color: "primary.main" }} />
          <Typography
            sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}
          >
            Vídeos em Alta
          </Typography>
        </Box>
        <Link
          href="/dashboard/videos"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Typography
            sx={{ fontSize: "0.74rem", color: "primary.main", fontWeight: 600 }}
          >
            Ver todos
          </Typography>
          <EastOutlined sx={{ fontSize: 13, color: "primary.main" }} />
        </Link>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 60px 70px",
          columnGap: 1,
          px: 3,
          py: 1,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {(["VÍDEO & CRIADOR", "VENDAS", "VIEWS"] as const).map((h, i) => (
          <Typography
            key={h}
            sx={{
              fontSize: "0.58rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.28)",
              textTransform: "uppercase",
              textAlign: i > 0 ? "right" : "left",
            }}
          >
            {h}
          </Typography>
        ))}
      </Box>

      {loading
        ? Array.from({ length: 6 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) 60px 70px",
                columnGap: 1,
                alignItems: "center",
                px: 3,
                py: 1.25,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                <Skeleton
                  variant="rounded"
                  width={34}
                  height={46}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.06)",
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
                <Box>
                  <Skeleton
                    width={130}
                    height={13}
                    sx={{ bgcolor: "rgba(255,255,255,0.06)" }}
                  />
                  <Skeleton
                    width={70}
                    height={11}
                    sx={{ bgcolor: "rgba(255,255,255,0.04)", mt: 0.5 }}
                  />
                </Box>
              </Box>
              <Skeleton
                width={34}
                height={13}
                sx={{ bgcolor: "rgba(255,255,255,0.06)", ml: "auto" }}
              />
              <Skeleton
                width={42}
                height={13}
                sx={{ bgcolor: "rgba(255,255,255,0.06)", ml: "auto" }}
              />
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
                gridTemplateColumns: "minmax(0,1fr) 60px 70px",
                columnGap: 1,
                alignItems: "center",
                px: 3,
                py: 1.25,
                borderBottom: "1px solid rgba(255,255,255,0.035)",
                textDecoration: "none",
                cursor: "pointer",
                transition: "background 120ms",
                "&:hover": { background: "rgba(255,255,255,0.02)" },
                "&:last-child": { borderBottom: "none" },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  minWidth: 0,
                }}
              >
                <Avatar
                  src={v.thumbnailUrl ?? undefined}
                  variant="rounded"
                  sx={{
                    width: 34,
                    height: 46,
                    borderRadius: 1,
                    bgcolor: "rgba(255,255,255,0.06)",
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.92)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {v.title || "—"}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.68rem",
                      color: "rgba(255,255,255,0.38)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    @{v.creatorHandle?.replace(/^@/, "")}
                  </Typography>
                </Box>
              </Box>
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.75)",
                  textAlign: "right",
                }}
              >
                {fmt(v.sales)}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.75)",
                  textAlign: "right",
                }}
              >
                {fmt(v.views)}
              </Typography>
            </Box>
          ))}
    </Box>
  );
}

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
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      <HeroBanner firstName={firstName} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" },
          gap: 3,
        }}
      >
        <TopProductsPanel
          products={products}
          loading={productsLoading}
          region={region}
        />
        <TopVideosPanel videos={videos} loading={videosLoading} />
      </Box>
    </Box>
  );
}
