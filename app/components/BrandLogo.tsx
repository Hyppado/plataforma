"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import Image from "next/image";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

export type BrandLogoVariant = "full" | "mark";
export type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "header";

interface BrandLogoProps {
  /** "full" = full wordmark (icon + text), "mark" = icon only */
  variant?: BrandLogoVariant;
  /** Predefined sizes: "xs" | "sm" | "md" | "lg" */
  size?: BrandLogoSize;
  /** Wrap in link (default: "/") */
  href?: string;
  /** Disable link wrapper */
  disableLink?: boolean;
  /** Background mode: "dark" = dark UI, "light" = light UI */
  mode?: "dark" | "light";
  /** Pass true for LCP images (main header) */
  priority?: boolean;
  /** Additional container sx props */
  sx?: SxProps<Theme>;
}

// ============================================
// SIZE PRESETS (height in pixels per breakpoint)
// ============================================
// Adjust these values in ONE place to change logo sizing globally.
//
// xs (mobile < 600px), sm (600-899px), md (desktop ≥ 900px)
//
// Header público: size="header" → 36 / 44 / 52 (PREMIUM)
// Sidebar app:    size="lg"     → 34 / 38 / 44
// ============================================

const SIZE_PRESETS: Record<
  BrandLogoVariant,
  Record<BrandLogoSize, { xs: number; sm: number; md: number }>
> = {
  full: {
    xs: { xs: 20, sm: 22, md: 26 },
    sm: { xs: 24, sm: 28, md: 32 },
    md: { xs: 28, sm: 32, md: 40 },
    lg: { xs: 48, sm: 60, md: 76 }, // ← logo flutuante grande (fora do header)
    header: { xs: 36, sm: 44, md: 52 }, // ← header interno app
  },
  mark: {
    xs: { xs: 18, sm: 20, md: 24 },
    sm: { xs: 22, sm: 26, md: 30 },
    md: { xs: 26, sm: 30, md: 36 },
    lg: { xs: 32, sm: 36, md: 42 },
    header: { xs: 32, sm: 40, md: 48 },
  },
};

// Aspect ratios (width / height) for each variant
// These ensure width auto-scales correctly with next/image
const ASPECT_RATIOS: Record<BrandLogoVariant, number> = {
  full: 4.5, // wordmark is wide
  mark: 1, // square icon
};

// ============================================
// ASSET MAPPING
// ============================================

function getLogoSrc(variant: BrandLogoVariant, mode: "dark" | "light"): string {
  if (variant === "mark") return "/logo/logo-mark.png";
  // Dark background → white logo
  // Light background → dark logo
  return mode === "dark" ? "/logo/logo.png" : "/logo/logo-light.png";
}

// ============================================
// COMPONENT
// ============================================

/**
 * BrandLogo — Centralized, responsive brand logo component.
 *
 * Features:
 * - Uses next/image for optimized loading
 * - Responsive sizing (mobile/desktop breakpoints)
 * - Never distorts: maintains aspect ratio
 * - Constrained by maxHeight to prevent overflow
 * - Accessible with proper alt and aria-label
 *
 * Usage:
 * ```tsx
 * // Default header usage
 * <BrandLogo size="md" />
 *
 * // Icon only, no link
 * <BrandLogo variant="mark" disableLink />
 *
 * // Sidebar (larger)
 * <BrandLogo size="lg" href="/dashboard/videos" />
 *
 * // Light background
 * <BrandLogo mode="light" />
 * ```
 */
export function BrandLogo({
  variant = "full",
  size = "md",
  href = "/",
  disableLink = false,
  mode = "dark",
  priority = false,
  sx = {},
}: BrandLogoProps) {
  const src = getLogoSrc(variant, mode);
  const preset = SIZE_PRESETS[variant][size];
  const aspectRatio = ASPECT_RATIOS[variant];

  // Calculate dimensions for all breakpoints (xs, sm, md)
  const heights = { xs: preset.xs, sm: preset.sm, md: preset.md };
  const widths = {
    xs: Math.round(preset.xs * aspectRatio),
    sm: Math.round(preset.sm * aspectRatio),
    md: Math.round(preset.md * aspectRatio),
  };

  const imageElement = (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        lineHeight: 0, // prevent baseline gap
        maxHeight: "100%",
        // Responsive dimensions
        height: heights,
        width: widths,
        ...sx,
      }}
    >
      <Image
        src={src}
        alt="Hyppado"
        fill
        sizes={`(max-width: 599px) ${widths.xs}px, (max-width: 899px) ${widths.sm}px, ${widths.md}px`}
        priority={priority}
        style={{
          objectFit: "contain",
          objectPosition: "left center",
        }}
      />
    </Box>
  );

  if (disableLink) {
    return imageElement;
  }

  return (
    <Link
      href={href}
      aria-label="Ir para início"
      style={{
        display: "inline-flex",
        alignItems: "center",
        textDecoration: "none",
        flexShrink: 0,
        maxHeight: "100%",
        padding: "4px 8px", // área clicável maior
        margin: "-4px -8px", // compensa padding visualmente
        borderRadius: "8px",
      }}
    >
      {imageElement}
    </Link>
  );
}

export default BrandLogo;
