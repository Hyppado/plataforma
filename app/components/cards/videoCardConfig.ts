import type { SxProps, Theme } from "@mui/material";

/* ============================================
   DESIGN TOKENS — VideoCard palette
============================================ */
export const UI = {
  card: {
    bg: "rgba(255,255,255,0.03)",
    bgHover: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(45,212,255,0.15)",
    radius: 4,
    shadow: "0 1px 2px rgba(0,0,0,0.05)",
    shadowHover: "0 4px 16px rgba(0,0,0,0.15), 0 0 6px rgba(45,212,255,0.04)",
  },
  text: {
    primary: "rgba(255,255,255,0.92)",
    secondary: "rgba(255,255,255,0.60)",
    muted: "rgba(255,255,255,0.40)",
  },
  accent: "#2DD4FF",
  accentSecondary: "#AE87FF",
  purple: {
    bg: "rgba(174, 135, 255, 0.18)",
    bgHover: "rgba(174, 135, 255, 0.24)",
  },
  adChip: {
    bg: "rgba(255, 193, 7, 0.08)",
    border: "rgba(255, 193, 7, 0.15)",
    text: "rgba(255, 193, 7, 0.85)",
  },
} as const;

/* ============================================
   RANK BADGE STYLES — medal tiers
============================================ */
export const RANK_STYLES = {
  1: {
    gradient:
      "linear-gradient(145deg, #D4A847 0%, #B8941F 35%, #E6C35A 65%, #C9A227 100%)",
    border: "rgba(230, 195, 90, 0.6)",
    glow: "0 0 18px rgba(212, 168, 71, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4)",
    textShadow:
      "0 1px 2px rgba(0, 0, 0, 0.35), 0 0 8px rgba(255, 225, 150, 0.3)",
    textColor: "#FFFFFF",
  },
  2: {
    gradient:
      "linear-gradient(145deg, #C8CDD5 0%, #9BA5B5 35%, #D5DBE5 65%, #A8B3C2 100%)",
    border: "rgba(200, 210, 225, 0.55)",
    glow: "0 0 14px rgba(180, 195, 215, 0.4), 0 4px 12px rgba(0, 0, 0, 0.35)",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
    textColor: "#FFFFFF",
  },
  3: {
    gradient:
      "linear-gradient(145deg, #CD8847 0%, #A86A35 35%, #D9A070 65%, #B87545 100%)",
    border: "rgba(205, 136, 71, 0.55)",
    glow: "0 0 14px rgba(205, 136, 71, 0.4), 0 4px 12px rgba(0, 0, 0, 0.35)",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
    textColor: "#FFFFFF",
  },
  default: {
    gradient:
      "linear-gradient(145deg, #1A3040 0%, #0F2030 35%, #254050 65%, #1A3545 100%)",
    border: "rgba(45, 212, 255, 0.35)",
    glow: "0 0 10px rgba(45, 212, 255, 0.2), 0 4px 10px rgba(0, 0, 0, 0.3)",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
    textColor: "#2DD4FF",
  },
} as const;
