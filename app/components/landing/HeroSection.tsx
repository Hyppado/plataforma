"use client";

import { useEffect, useRef } from "react";
import { Box, Container, Typography, Button, Stack, Chip } from "@mui/material";
import { AutoAwesome, EastOutlined } from "@mui/icons-material";
import { SectionShell } from "./SectionShell";

/* ============================================
   CANVAS PARTICLE BACKGROUND
============================================ */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = 0;
    let h = 0;

    const CYAN = { r: 45, g: 212, b: 255 };
    const PINK = { r: 255, g: 45, b: 120 };

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      color: typeof CYAN;
      phase: number;
    }

    let particles: Particle[] = [];

    function resize() {
      w = canvas!.width = canvas!.offsetWidth;
      h = canvas!.height = canvas!.offsetHeight;
    }

    function spawn(): Particle {
      const color = Math.random() < 0.72 ? CYAN : PINK;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        size: Math.random() * 1.4 + 0.4,
        opacity: Math.random() * 0.5 + 0.08,
        color,
        phase: Math.random() * Math.PI * 2,
      };
    }

    function init() {
      resize();
      particles = Array.from({ length: 90 }, spawn);
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);

      // Subtle radial glow blobs
      const g1 = ctx!.createRadialGradient(
        w * 0.25,
        h * 0.4,
        0,
        w * 0.25,
        h * 0.4,
        w * 0.38,
      );
      g1.addColorStop(0, "rgba(45,212,255,0.055)");
      g1.addColorStop(1, "transparent");
      ctx!.fillStyle = g1;
      ctx!.fillRect(0, 0, w, h);

      const g2 = ctx!.createRadialGradient(
        w * 0.78,
        h * 0.6,
        0,
        w * 0.78,
        h * 0.6,
        w * 0.28,
      );
      g2.addColorStop(0, "rgba(255,45,120,0.04)");
      g2.addColorStop(1, "transparent");
      ctx!.fillStyle = g2;
      ctx!.fillRect(0, 0, w, h);

      // Particles
      for (const p of particles) {
        const pulse = Math.sin(t * 0.001 + p.phase) * 0.3 + 0.7;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${p.opacity * pulse})`;
        ctx!.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        if (p.y < -4) p.y = h + 4;
        if (p.y > h + 4) p.y = -4;
      }

      // Draw faint connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            const alpha = (1 - dist / 100) * 0.06;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(45,212,255,${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }
    }

    function loop(t: number) {
      draw(t);
      animId = requestAnimationFrame(loop);
    }

    init();
    animId = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

/* ============================================
   FEATURE PILLS
============================================ */
const FEATURES = [
  "Produtos em Alta",
  "Vídeos Virais",
  "Avatar com IA",
  "Imagem com Produto",
  "Prompt de Vídeo",
  "Criadores TikTok",
] as const;

/* ============================================
   HERO SECTION
============================================ */
export function HeroSection() {
  const scrollToPlanos = (e: React.MouseEvent) => {
    e.preventDefault();
    document
      .getElementById("planos")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <SectionShell
      id="inicio"
      variant="hero"
      tone="dark"
      backgroundSlot={
        <>
          <ParticleCanvas />
          {/* Bottom fade to page bg */}
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "30%",
              background: "linear-gradient(to bottom, transparent, #070B12)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        </>
      }
    >
      <Container
        maxWidth="md"
        sx={{
          position: "relative",
          zIndex: 4,
          pt: { xs: "110px", md: "130px" },
          pb: { xs: 10, md: 14 },
          textAlign: "center",
        }}
      >
        {/* Badge */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.75,
            py: 0.6,
            mb: 4,
            borderRadius: 99,
            background: "rgba(45,212,255,0.07)",
            border: "1px solid rgba(45,212,255,0.22)",
          }}
        >
          <AutoAwesome sx={{ fontSize: 13, color: "primary.main" }} />
          <Typography
            sx={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "primary.main",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Inteligência TikTok Shop com IA
          </Typography>
        </Box>

        {/* Headline */}
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: "2.4rem", sm: "3.2rem", md: "4rem" },
            fontWeight: 900,
            lineHeight: 1.07,
            letterSpacing: "-0.04em",
            color: "#fff",
            mb: 3,
          }}
        >
          Do produto viral{" "}
          <Box
            component="span"
            sx={(theme) => ({
              background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            })}
          >
            ao vídeo pronto
          </Box>{" "}
          com IA
        </Typography>

        {/* Subtext */}
        <Typography
          sx={{
            fontSize: { xs: "1rem", md: "1.2rem" },
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.65,
            maxWidth: 580,
            mx: "auto",
            mb: 5,
          }}
        >
          Descubra produtos em alta, crie prompts de vídeo com um avatar
          influenciador IA e gere imagens realistas do seu produto com
          referência visual — tudo numa plataforma.
        </Typography>

        {/* CTA buttons */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="center"
          alignItems="center"
          sx={{ mb: 6 }}
        >
          <Button
            variant="contained"
            size="large"
            href="#planos"
            onClick={scrollToPlanos}
            endIcon={<EastOutlined />}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "999px",
              background: "primary.main",
              bgcolor: "primary.main",
              color: "#070B12",
              textTransform: "none",
              boxShadow:
                "0 0 28px rgba(45,212,255,0.35), 0 4px 16px rgba(0,0,0,0.3)",
              transition: "all 0.22s ease",
              "&:hover": {
                bgcolor: "primary.light",
                boxShadow:
                  "0 0 40px rgba(45,212,255,0.5), 0 6px 20px rgba(0,0,0,0.35)",
                transform: "translateY(-2px)",
              },
            }}
          >
            Quero acesso agora
          </Button>
          <Button
            variant="outlined"
            size="large"
            href="#como-funciona"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("como-funciona")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: "0.95rem",
              fontWeight: 600,
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "rgba(255,255,255,0.75)",
              textTransform: "none",
              "&:hover": {
                border: "1px solid rgba(45,212,255,0.4)",
                color: "primary.main",
                background: "rgba(45,212,255,0.05)",
              },
            }}
          >
            Ver como funciona
          </Button>
        </Stack>

        {/* Feature pills */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            justifyContent: "center",
          }}
        >
          {FEATURES.map((f) => (
            <Chip
              key={f}
              label={f}
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.45)",
                fontSize: "0.72rem",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            />
          ))}
        </Box>
      </Container>
    </SectionShell>
  );
}
