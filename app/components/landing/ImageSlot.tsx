"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Box, Typography } from "@mui/material";
import { ImageOutlined, AutoAwesome } from "@mui/icons-material";

/* ============================================
   IMAGE SLOT — Premium placeholder with glass + shimmer
============================================ */
interface ImageSlotProps {
  src?: string;
  alt?: string;
  height?: number | { xs: number; md: number };
  width?: string | number;
  radius?: number;
  variant?: "rounded" | "card" | "banner" | "badge" | "hero" | "icon";
  icon?: ReactNode;
  label?: string;
}

export function ImageSlot({
  src,
  alt = "Ilustração",
  height = 280,
  width = "100%",
  radius = 16,
  variant = "rounded",
  icon,
  label,
}: ImageSlotProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const radiusMap: Record<string, number> = {
    rounded: 12,
    card: 16,
    banner: 8,
    badge: 99,
    hero: 20,
    icon: 999,
  };

  const variantStyles = {
    rounded: {
      border: "1px solid rgba(var(--section-accent-rgb, 57, 213, 255), 0.10)",
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
      backdropFilter: "blur(8px)",
      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.04),
        0 4px 24px -4px rgba(0,0,0,0.3),
        0 0 0 1px rgba(0,0,0,0.1)
      `,
    },
    card: {
      border: "1px solid rgba(var(--section-accent-rgb, 57, 213, 255), 0.12)",
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
      backdropFilter: "blur(12px)",
      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.05),
        0 8px 32px rgba(0,0,0,0.25),
        0 0 0 1px rgba(0,0,0,0.1)
      `,
    },
    banner: {
      border: "1px solid rgba(var(--section-accent-rgb, 57, 213, 255), 0.08)",
      background:
        "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.02) 100%)",
      backdropFilter: "blur(8px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.1)",
    },
    badge: {
      border: "1px solid rgba(var(--section-accent-rgb, 57, 213, 255), 0.15)",
      background: "rgba(255,255,255,0.03)",
      backdropFilter: "blur(4px)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    },
    hero: {
      border: "1px solid rgba(var(--section-accent-rgb, 57, 213, 255), 0.12)",
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
      backdropFilter: "blur(16px)",
      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.06),
        0 12px 40px rgba(0,0,0,0.3),
        0 0 60px rgba(var(--section-accent-rgb, 57, 213, 255), 0.08)
      `,
    },
    icon: {
      border: "1px solid rgba(var(--section-accent-rgb, 57, 213, 255), 0.20)",
      background: "rgba(var(--section-accent-rgb, 57, 213, 255), 0.08)",
      backdropFilter: "blur(4px)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    },
  };

  const styles = variantStyles[variant] || variantStyles.rounded;
  const finalRadius = radiusMap[variant] || radius;

  if (src && !hasError) {
    return (
      <Box
        sx={{
          position: "relative",
          width,
          height,
          borderRadius: `${finalRadius}px`,
          overflow: "hidden",
          border:
            "1px solid rgba(var(--section-accent-rgb, 57, 213, 255), 0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
          transition: "all 0.3s ease",
          "&:hover": {
            borderColor: "rgba(var(--section-accent-rgb, 57, 213, 255), 0.18)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.25), 0 0 30px rgba(var(--section-accent-rgb, 57, 213, 255), 0.10)",
            transform: "translateY(-2px)",
          },
        }}
      >
        {isLoading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(7, 11, 18, 0.8)",
              zIndex: 1,
            }}
          >
            <ImageOutlined
              sx={{
                fontSize: 32,
                color: "rgba(var(--section-accent-rgb, 57, 213, 255), 0.3)",
              }}
            />
          </Box>
        )}
        <Image
          src={src}
          alt={alt}
          fill
          style={{
            objectFit: "cover",
            opacity: isLoading ? 0 : 1,
            transition: "opacity 0.3s",
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        width,
        height,
        borderRadius: `${finalRadius}px`,
        overflow: "hidden",
        ...styles,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: `linear-gradient(
            90deg,
            transparent 0%,
            rgba(var(--section-accent-rgb, 57, 213, 255), 0.06) 40%,
            rgba(var(--section-accent-rgb, 57, 213, 255), 0.10) 50%,
            rgba(var(--section-accent-rgb, 57, 213, 255), 0.06) 60%,
            transparent 100%
          )`,
          backgroundSize: "200% 100%",
          animation: "shimmer 2.8s ease-in-out infinite",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: -1,
          borderRadius: "inherit",
          background: "transparent",
          boxShadow:
            "0 0 20px 0 rgba(var(--section-accent-rgb, 57, 213, 255), 0.08)",
          animation: "glow-pulse 4s ease-in-out infinite",
          pointerEvents: "none",
        },
        "@keyframes shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "@keyframes glow-pulse": {
          "0%, 100%": { opacity: 0.5 },
          "50%": { opacity: 1 },
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          color: "rgba(var(--section-accent-rgb, 57, 213, 255), 0.35)",
        }}
      >
        {icon || (
          <ImageOutlined
            sx={{
              fontSize: variant === "badge" || variant === "icon" ? 24 : 40,
              color: "rgba(var(--section-accent-rgb, 57, 213, 255), 0.3)",
            }}
          />
        )}
        {label && variant !== "badge" && variant !== "icon" && (
          <Typography
            variant="caption"
            sx={{
              color: "rgba(var(--section-accent-rgb, 57, 213, 255), 0.4)",
              fontSize: "0.7rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {label}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/* ============================================
   MEDIA SLOT — Simplified version
============================================ */
interface MediaSlotProps {
  src?: string;
  alt?: string;
  height?: number | { xs: number; md: number };
  radius?: number;
  variant?: "skeleton" | "icon";
  icon?: ReactNode;
}

export function MediaSlot({
  src,
  alt = "Preview",
  height = 180,
  radius = 12,
  variant = "skeleton",
  icon,
}: MediaSlotProps) {
  if (src) {
    return (
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height,
          borderRadius: `${radius}px`,
          overflow: "hidden",
        }}
      >
        <Image src={src} alt={alt} fill style={{ objectFit: "cover" }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: `${radius}px`,
        overflow: "hidden",
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s ease-in-out infinite",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(255,255,255,0.04)",
        "@keyframes shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      }}
    >
      {variant === "icon" && (
        <Box sx={{ opacity: 0.2 }}>
          {icon || <AutoAwesome sx={{ fontSize: 40, color: "#39D5FF" }} />}
        </Box>
      )}
      {variant === "skeleton" && (
        <ImageOutlined
          sx={{ fontSize: 36, color: "rgba(57, 213, 255, 0.15)" }}
        />
      )}
    </Box>
  );
}
