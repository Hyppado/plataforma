"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Box, Container, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/* ============================================
   BROWSER CHROME — fake window frame
============================================ */
function BrowserChrome() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1.25,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.03)",
        flexShrink: 0,
      }}
    >
      {/* Traffic lights */}
      <Box sx={{ display: "flex", gap: 0.625 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((color, i) => (
          <Box
            key={i}
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: color,
              opacity: 0.85,
            }}
          />
        ))}
      </Box>

      {/* Address bar */}
      <Box
        sx={{
          flex: 1,
          mx: 2,
          px: 1.5,
          py: 0.5,
          borderRadius: "6px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          maxWidth: 320,
        }}
      >
        {/* Lock icon */}
        <Box
          component="svg"
          viewBox="0 0 12 12"
          sx={{ width: 10, height: 10, flexShrink: 0, opacity: 0.4 }}
        >
          <path
            d="M9 5H3V4a3 3 0 016 0v1zm-6 1h6a1 1 0 011 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1z"
            fill="currentColor"
          />
        </Box>
        <Typography
          sx={{
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.3)",
            fontFamily: "monospace",
            letterSpacing: 0,
          }}
        >
          app.hyppado.com/dashboard
        </Typography>
      </Box>
    </Box>
  );
}

/* ============================================
   PRODUCT PREVIEW SECTION
============================================ */
export function ProductPreviewSection() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        pt: { xs: 6, md: 10 },
        pb: { xs: 10, md: 14 },
        overflow: "hidden",
      }}
    >
      {/* Subtle radial glow from the center */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 70% 50% at 50% 80%, rgba(45,212,255,0.07) 0%, transparent 70%)",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative" }}>
        {/* Label + headline */}
        <Box
          sx={{
            textAlign: "center",
            mb: { xs: 5, md: 7 },
            opacity: revealed ? 1 : 0,
            transform: revealed ? "none" : "translateY(16px)",
            transition: "opacity 0.55s ease, transform 0.55s ease",
          }}
        >
          <Typography
            component="span"
            sx={(theme) => ({
              display: "inline-block",
              mb: 2,
              px: 2,
              py: 0.5,
              borderRadius: "999px",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: theme.palette.primary.main,
              background: alpha(theme.palette.primary.main, 0.1),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            })}
          >
            Plataforma
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.75rem" },
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: "#fff",
              mb: 1.5,
            }}
          >
            Tudo o que você precisa,{" "}
            <Box
              component="span"
              sx={(theme) => ({
                background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              })}
            >
              em um só lugar
            </Box>
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: "0.95rem", md: "1.05rem" },
              color: "rgba(160,176,192,0.85)",
              maxWidth: 480,
              mx: "auto",
            }}
          >
            Descubra produtos virais, vídeos em alta e criadores de TikTok —
            filtrados por região, período e categoria.
          </Typography>
        </Box>

        {/* Screenshot frame */}
        <Box
          ref={frameRef}
          sx={{
            perspective: "1400px",
          }}
        >
          <Box
            sx={(theme) => ({
              borderRadius: "14px",
              overflow: "hidden",
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
              background: "#0D1117",
              boxShadow: revealed
                ? `0 0 0 1px rgba(255,255,255,0.06),
                   0 32px 80px rgba(0,0,0,0.6),
                   0 0 120px ${alpha(theme.palette.primary.main, 0.12)}`
                : "none",
              transform: revealed
                ? "rotateX(0deg) translateY(0px) scale(1)"
                : "rotateX(14deg) translateY(56px) scale(0.97)",
              opacity: revealed ? 1 : 0,
              transition:
                "opacity 0.85s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.85s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.85s ease",
              transformOrigin: "top center",
              willChange: "transform, opacity",
            })}
          >
            <BrowserChrome />

            {/* Screenshot */}
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                overflow: "hidden",
                bgcolor: "#0A0E17",
              }}
            >
              <Image
                src="/screenshots/image.png"
                alt="Dashboard Hyppado — produtos, vídeos e criadores em alta no TikTok"
                fill
                style={{ objectFit: "cover", objectPosition: "top left" }}
                priority={false}
                quality={90}
              />

              {/* Bottom fade to blend into section bg */}
              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "28%",
                  background:
                    "linear-gradient(to bottom, transparent 0%, rgba(7,11,18,0.85) 100%)",
                  pointerEvents: "none",
                }}
              />
            </Box>
          </Box>

          {/* Ground glow reflection */}
          <Box
            sx={(theme) => ({
              mx: "auto",
              mt: "-2px",
              height: 80,
              width: "75%",
              borderRadius: "0 0 50% 50%",
              background: `radial-gradient(ellipse at center, ${alpha(theme.palette.primary.main, 0.18)} 0%, transparent 70%)`,
              filter: "blur(16px)",
              opacity: revealed ? 1 : 0,
              transition: "opacity 1.1s ease 0.3s",
              pointerEvents: "none",
            })}
          />
        </Box>
      </Container>
    </Box>
  );
}
