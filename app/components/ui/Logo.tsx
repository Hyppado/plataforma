"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import Link from "next/link";

export type LogoVariant = "full" | "mark";
export type LogoSize = "sm" | "md" | "lg" | "nav" | "hero";

/** Responsive height per breakpoint (xs, sm, md, lg) */
export interface ResponsiveHeight {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
}

interface LogoProps {
  /** "full" = full wordmark, "mark" = icon only */
  variant?: LogoVariant;
  /** Predefined sizes: "sm" | "md" | "lg" | "nav" | "hero" */
  size?: LogoSize;
  /** Responsive height per breakpoint - overrides size prop */
  responsiveHeight?: ResponsiveHeight;
  /** Background mode: "dark" = dark UI (use white logo), "light" = light UI (use dark logo) */
  mode?: "dark" | "light";
  /** Optional link wrapper */
  href?: string;
  /** Pass true for LCP images (landing hero) */
  priority?: boolean;
  /** Additional sx props */
  sx?: SxProps<Theme>;
}

/**
 * Size presets (height in pixels)
 * Width auto-scales to preserve aspect ratio
 *
 * - sm: compact/mobile
 * - md: default (sidebar, small headers)
 * - lg: app shell sidebar
 * - nav: site header / landing navbar (desktop)
 * - hero: prominent hero sections
 */
const SIZE_PRESETS = {
  full: { sm: 18, md: 24, lg: 32, nav: 34, hero: 42 },
  mark: { sm: 16, md: 20, lg: 26, nav: 28, hero: 34 },
};

/**
 * Asset mapping:
 * - logo.png: white wordmark (for dark backgrounds)
 * - logo-light.png: dark wordmark (for light backgrounds)
 * - logo-mark.png: icon only
 */
function getLogoSrc(variant: LogoVariant, mode: "dark" | "light"): string {
  if (variant === "mark") return "/logo/logo-mark.png";
  // Dark background → use white logo (logo.png)
  // Light background → use dark logo (logo-light.png)
  return mode === "dark" ? "/logo/logo.png" : "/logo/logo-light.png";
}

/**
 * Hyppado Brand Logo — centralized logo rendering.
 *
 * Usage:
 * - Dark UI (sidebar, app shell): <Logo mode="dark" />
 * - Light UI (if any): <Logo mode="light" />
 * - Icon only: <Logo variant="mark" />
 * - With link: <Logo href="/dashboard/videos" />
 * - Responsive: <Logo responsiveHeight={{ xs: 24, sm: 28, md: 32, lg: 36 }} />
 */
export function Logo({
  variant = "full",
  size = "md",
  responsiveHeight,
  mode = "dark",
  href,
  priority = false,
  sx = {},
}: LogoProps) {
  const src = getLogoSrc(variant, mode);

  // Build height styles: responsive breakpoints or fixed preset
  const heightSx = responsiveHeight
    ? {
        height: {
          xs: responsiveHeight.xs ?? SIZE_PRESETS[variant][size],
          sm:
            responsiveHeight.sm ??
            responsiveHeight.xs ??
            SIZE_PRESETS[variant][size],
          md:
            responsiveHeight.md ??
            responsiveHeight.sm ??
            responsiveHeight.xs ??
            SIZE_PRESETS[variant][size],
          lg:
            responsiveHeight.lg ??
            responsiveHeight.md ??
            responsiveHeight.sm ??
            responsiveHeight.xs ??
            SIZE_PRESETS[variant][size],
        },
      }
    : { height: SIZE_PRESETS[variant][size] };

  const imgElement = (
    <Box
      component="img"
      src={src}
      alt="Hyppado"
      loading={priority ? "eager" : "lazy"}
      sx={{
        ...heightSx,
        width: "auto",
        display: "block",
        objectFit: "contain",
        ...sx,
      }}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        {imgElement}
      </Link>
    );
  }

  return imgElement;
}

export default Logo;
