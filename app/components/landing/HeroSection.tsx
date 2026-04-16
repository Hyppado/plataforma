"use client";

import { useState } from "react";
import Image from "next/image";
import { Box, Container, Grid, Stack, Typography, Button } from "@mui/material";
import { CheckCircleOutline, PersonOutline } from "@mui/icons-material";
import { SectionShell } from "./SectionShell";

/* ============================================
   HERO MEDIA — Image with error fallback
============================================ */
function HeroMedia({
  hasError,
  onError,
}: {
  hasError: boolean;
  onError: () => void;
}) {
  if (hasError) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          py: 8,
        }}
      >
        <PersonOutline
          sx={{ fontSize: 72, color: "rgba(57, 213, 255, 0.25)" }}
        />
        <Typography
          sx={{
            color: "rgba(255, 255, 255, 0.35)",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Imagem do hero
        </Typography>
      </Box>
    );
  }

  return (
    <Image
      src="/hero/influencer-hero.png"
      alt="Influenciadora usando a plataforma Hyppado"
      width={4109}
      height={2311}
      unoptimized
      priority
      onError={onError}
      style={{
        display: "block",
        height: "100%",
        width: "auto",
        maxWidth: "none",
        objectFit: "contain",
        objectPosition: "center bottom",
        filter: "none",
        boxShadow: "none",
      }}
    />
  );
}

/* ============================================
   HERO VISUAL — Floating influencer with glow
============================================ */
function HeroVisual() {
  const [imageError, setImageError] = useState(false);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        minHeight: { xs: 400, sm: 480, md: 520, lg: 580 },
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* Glow background */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse 70% 60% at 50% 40%, rgba(57, 213, 255, 0.10) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 70% 30%, rgba(57, 213, 255, 0.06) 0%, transparent 50%)
          `,
        }}
      />

      {/* Decorative rings */}
      <Box
        sx={{
          position: "absolute",
          width: { xs: 300, sm: 360, md: 420, lg: 480 },
          height: { xs: 300, sm: 360, md: 420, lg: 480 },
          borderRadius: "50%",
          border: "1px solid rgba(57, 213, 255, 0.06)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: { xs: 400, sm: 480, md: 560, lg: 640 },
          height: { xs: 400, sm: 480, md: 560, lg: 640 },
          borderRadius: "50%",
          border: "1px solid rgba(57, 213, 255, 0.03)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Image with fade mask */}
      <Box
        sx={{
          position: "relative",
          zIndex: 5,
          height: { xs: 380, sm: 460, md: 500, lg: 560 },
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          overflow: "hidden",
          isolation: "isolate",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 72%, rgba(0,0,0,0) 100%)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 72%, rgba(0,0,0,0) 100%)",
          maskRepeat: "no-repeat",
          maskSize: "100% 100%",
        }}
      >
        <HeroMedia hasError={imageError} onError={() => setImageError(true)} />
      </Box>
    </Box>
  );
}

/* ============================================
   HERO BACKGROUND VIDEO
============================================ */
function HeroBackgroundVideo() {
  return (
    <Box
      component="video"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        pointerEvents: "none",
      }}
    >
      <source src="/hero/hero-bg.webm" type="video/webm" />
      <source src="/hero/hero-bg.mp4" type="video/mp4" />
    </Box>
  );
}

/* ============================================
   HERO SECTION — Exported composition
============================================ */
export function HeroSection() {
  return (
    <SectionShell id="inicio" variant="hero" tone="dark" backgroundSlot={<HeroBackgroundVideo />}>

      {/* Overlay 1 — Contrast */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(6,8,15,0.55) 0%, rgba(6,8,15,0.80) 55%, rgba(6,8,15,0.95) 80%, #06080F 100%)",
        }}
      />

      {/* Overlay 2 — Accent left */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 18% 35%, rgba(56,189,248,0.12) 0%, rgba(56,189,248,0.05) 25%, transparent 60%)",
          mixBlendMode: "normal",
        }}
      />

      {/* Overlay 3 — Vignette */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.20) 85%)",
          opacity: 0.85,
        }}
      />

      {/* Hero content */}
      <Container
        maxWidth="lg"
        sx={{
          position: "relative",
          zIndex: 4,
          pt: { xs: "80px", md: "96px" },
          pb: { xs: 4, md: 6 },
        }}
      >
        <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
          {/* Left Column */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                maxWidth: { xs: "100%", md: 480 },
                textAlign: { xs: "center", md: "left" },
                mx: { xs: "auto", md: 0 },
              }}
            >
              <Typography
                component="h1"
                sx={{
                  fontSize: {
                    xs: "2rem",
                    sm: "2.5rem",
                    md: "2.75rem",
                    lg: "3rem",
                  },
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.03em",
                  color: "#fff",
                  mb: 2.5,
                }}
              >
                Hyppado — Encontre produtos em alta.
              </Typography>

              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.125rem" },
                  lineHeight: 1.6,
                  color: "#A8B8C8",
                  mb: 4,
                }}
              >
                Veja tendências antes do mercado e decida com dados.
              </Typography>

              <Stack spacing={2} sx={{ mb: 4 }}>
                {[
                  "Métricas em tempo real para validar oportunidades.",
                  "Insights claros para criadores e afiliados.",
                  "Descoberta rápida de vídeos e produtos em alta.",
                ].map((text, i) => (
                  <Stack
                    key={i}
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{
                      justifyContent: { xs: "center", md: "flex-start" },
                    }}
                  >
                    <CheckCircleOutline
                      sx={{
                        fontSize: 20,
                        color: "#39D5FF",
                        mt: 0.25,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: { xs: "0.9rem", md: "0.95rem" },
                        color: "#C0CDD8",
                        lineHeight: 1.5,
                        textAlign: { xs: "left", md: "left" },
                      }}
                    >
                      {text}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: { xs: "center", md: "flex-start" },
                  gap: 1.5,
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  href="/login"
                  sx={{
                    px: 4.5,
                    py: 1.5,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    borderRadius: "999px",
                    background: "#39D5FF",
                    color: "#070B12",
                    textTransform: "none",
                    boxShadow:
                      "0 0 24px rgba(57, 213, 255, 0.4), 0 4px 16px rgba(0,0,0,0.25)",
                    transition: "all 0.25s ease",
                    "&:hover": {
                      background: "#5BE0FF",
                      boxShadow:
                        "0 0 32px rgba(57, 213, 255, 0.55), 0 6px 20px rgba(0,0,0,0.3)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  Quero acesso agora
                </Button>
              </Box>
            </Box>
          </Grid>

          {/* Right Column */}
          <Grid item xs={12} md={6}>
            <HeroVisual />
          </Grid>
        </Grid>
      </Container>
    </SectionShell>
  );
}
