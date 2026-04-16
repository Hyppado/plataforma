import { type ReactNode } from "react";
import { Box } from "@mui/material";

/* ============================================
   SECTION SHELL - BACKGROUND SYSTEM + THEME
============================================ */
type SectionVariant =
  | "hero"
  | "how"
  | "receive"
  | "flow"
  | "who"
  | "pricing"
  | "faq";
type SectionTheme =
  | "hero"
  | "how"
  | "receive"
  | "flow"
  | "audience"
  | "pricing"
  | "faq";

type SectionTone = "dark" | "light";

interface SectionShellProps {
  id: string;
  children: ReactNode;
  backgroundSlot?: ReactNode;
  variant: SectionVariant;
  theme?: SectionTheme;
  tone?: SectionTone;
  noDivider?: boolean;
  noGlowLine?: boolean;
  allowOverflow?: boolean;
}

const SECTION_ACCENTS: Record<
  SectionVariant,
  { primary: string; glow: string; rgb: string }
> = {
  hero: {
    primary: "rgba(56, 189, 248, 0.15)",
    glow: "rgba(56, 189, 248, 0.30)",
    rgb: "56, 189, 248",
  },
  how: {
    primary: "rgba(45, 212, 255, 0.10)",
    glow: "rgba(45, 212, 255, 0.20)",
    rgb: "45, 212, 255",
  },
  receive: {
    primary: "rgba(80, 140, 255, 0.08)",
    glow: "rgba(80, 140, 255, 0.18)",
    rgb: "80, 140, 255",
  },
  flow: {
    primary: "rgba(130, 100, 255, 0.07)",
    glow: "rgba(130, 100, 255, 0.16)",
    rgb: "130, 100, 255",
  },
  who: {
    primary: "rgba(120, 90, 255, 0.06)",
    glow: "rgba(120, 90, 255, 0.14)",
    rgb: "120, 90, 255",
  },
  pricing: {
    primary: "rgba(50, 180, 255, 0.10)",
    glow: "rgba(50, 180, 255, 0.22)",
    rgb: "50, 180, 255",
  },
  faq: {
    primary: "rgba(57, 213, 255, 0.05)",
    glow: "rgba(57, 213, 255, 0.12)",
    rgb: "57, 213, 255",
  },
};

const SECTION_STYLES: Record<
  SectionVariant,
  {
    base: string;
    decorative: string;
    topFade: string;
    dividerColor: string;
    glowLineColor: string;
    py: { xs: number; md: number };
    pt?: { xs: number; md: number };
    pb?: { xs: number; md: number };
    minHeight?: { xs: string; md: string };
  }
> = {
  hero: {
    base: `#06080F`,
    decorative: `
      radial-gradient(900px 520px at 22% 40%, rgba(56, 189, 248, 0.30) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 70%),
      radial-gradient(800px 520px at 78% 35%, rgba(56, 189, 248, 0.18) 0%, rgba(56, 189, 248, 0.04) 45%, transparent 72%)
    `,
    topFade: "transparent",
    dividerColor: "transparent",
    glowLineColor: "transparent",
    py: { xs: 0, md: 0 },
    pb: { xs: 10, md: 10 },
    minHeight: { xs: "100vh", md: "100vh" },
  },
  how: {
    base: `linear-gradient(180deg, #0a1118 0%, #0b1320 35%, #0a1018 70%, #080d15 100%)`,
    decorative: `
      radial-gradient(ellipse 50% 35% at 8% 15%, rgba(45, 212, 255, 0.10) 0%, transparent 60%),
      radial-gradient(ellipse 45% 40% at 92% 85%, rgba(45, 212, 255, 0.08) 0%, transparent 55%),
      radial-gradient(ellipse 80% 25% at 50% 0%, rgba(45, 212, 255, 0.05) 0%, transparent 50%),
      linear-gradient(90deg, transparent 47px, rgba(45, 212, 255, 0.018) 48px, transparent 49px),
      linear-gradient(0deg, transparent 47px, rgba(45, 212, 255, 0.018) 48px, transparent 49px)
    `,
    topFade: "linear-gradient(to bottom, #0a1118 0%, transparent 100%)",
    dividerColor: "#090e18",
    glowLineColor: "rgba(45, 212, 255, 0.25)",
    py: { xs: 12, md: 16 },
  },
  receive: {
    base: `linear-gradient(180deg, #090e18 0%, #0b1220 30%, #0c1424 55%, #0a1118 100%)`,
    decorative: `
      radial-gradient(ellipse 55% 40% at 15% 20%, rgba(80, 140, 255, 0.08) 0%, transparent 55%),
      radial-gradient(ellipse 50% 45% at 85% 75%, rgba(80, 140, 255, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse 70% 30% at 50% 50%, rgba(80, 140, 255, 0.04) 0%, transparent 60%)
    `,
    topFade: "linear-gradient(to bottom, #090e18 0%, transparent 100%)",
    dividerColor: "#0a0f1a",
    glowLineColor: "rgba(80, 140, 255, 0.22)",
    py: { xs: 12, md: 16 },
  },
  flow: {
    base: `linear-gradient(180deg, #0a0f1a 0%, #0c1424 30%, #0d1428 55%, #0b1220 100%)`,
    decorative: `
      radial-gradient(ellipse 45% 35% at 10% 25%, rgba(130, 100, 255, 0.07) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 90% 70%, rgba(130, 100, 255, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse 60% 25% at 50% 85%, rgba(130, 100, 255, 0.04) 0%, transparent 55%)
    `,
    topFade: "linear-gradient(to bottom, #0a0f1a 0%, transparent 100%)",
    dividerColor: "#080d15",
    glowLineColor: "rgba(130, 100, 255, 0.20)",
    py: { xs: 12, md: 16 },
  },
  who: {
    base: `linear-gradient(180deg, #080d15 0%, #0a1220 25%, #0d1428 50%, #0b1322 75%, #0a1118 100%)`,
    decorative: `
      radial-gradient(ellipse 50% 40% at 5% 20%, rgba(120, 90, 255, 0.06) 0%, transparent 55%),
      radial-gradient(ellipse 45% 35% at 95% 80%, rgba(120, 90, 255, 0.05) 0%, transparent 50%),
      radial-gradient(ellipse 40% 30% at 50% 50%, rgba(57, 213, 255, 0.03) 0%, transparent 45%),
      radial-gradient(ellipse 60% 20% at 50% 95%, rgba(57, 213, 255, 0.025) 0%, transparent 45%)
    `,
    topFade: "linear-gradient(to bottom, #080d15 0%, transparent 100%)",
    dividerColor: "#070b12",
    glowLineColor: "rgba(120, 90, 255, 0.18)",
    py: { xs: 12, md: 16 },
  },
  pricing: {
    base: `linear-gradient(180deg, #070b12 0%, #080e18 20%, #0a1220 45%, #0b1424 55%, #080d15 80%, #070b12 100%)`,
    decorative: `
      radial-gradient(ellipse 75% 45% at 50% 45%, rgba(50, 180, 255, 0.08) 0%, transparent 65%),
      radial-gradient(ellipse 40% 30% at 15% 55%, rgba(50, 180, 255, 0.05) 0%, transparent 50%),
      radial-gradient(ellipse 40% 30% at 85% 55%, rgba(50, 180, 255, 0.05) 0%, transparent 50%),
      linear-gradient(180deg, transparent 15%, rgba(50, 180, 255, 0.025) 50%, transparent 85%)
    `,
    topFade: "linear-gradient(to bottom, #070b12 0%, transparent 100%)",
    dividerColor: "#060910",
    glowLineColor: "rgba(50, 180, 255, 0.25)",
    py: { xs: 12, md: 16 },
  },
  faq: {
    base: `linear-gradient(180deg, #060910 0%, #080c14 30%, #0a0f18 60%, #070b12 100%)`,
    decorative: `
      radial-gradient(circle at 15% 75%, rgba(57, 213, 255, 0.03) 0%, transparent 35%),
      radial-gradient(circle at 85% 25%, rgba(57, 213, 255, 0.025) 0%, transparent 30%),
      repeating-linear-gradient(0deg, transparent 0px, transparent 60px, rgba(255,255,255,0.006) 60px, rgba(255,255,255,0.006) 61px)
    `,
    topFade: "linear-gradient(to bottom, #060910 0%, transparent 100%)",
    dividerColor: "transparent",
    glowLineColor: "transparent",
    py: { xs: 12, md: 16 },
  },
};

const toneStyles = {
  dark: {
    base: `
      radial-gradient(900px 500px at 20% 20%, rgba(34, 211, 238, 0.10), transparent 60%),
      radial-gradient(700px 420px at 70% 25%, rgba(56, 189, 248, 0.10), transparent 55%),
      linear-gradient(180deg, var(--bg-dark, #06080F), var(--bg-dark-2, #0A0F18))
    `,
    text: "var(--text-dark, rgba(255, 255, 255, 0.92))",
    muted: "var(--muted-dark, rgba(226, 232, 240, 0.70))",
  },
  light: {
    base: `
      radial-gradient(900px 520px at 20% 10%, rgba(56, 189, 248, 0.18), transparent 55%),
      radial-gradient(800px 520px at 80% 0%, rgba(34, 211, 238, 0.14), transparent 52%),
      linear-gradient(180deg, var(--bg-light, #F7FBFF), var(--bg-light-2, #EEF6FF))
    `,
    text: "var(--text-light, #0F172A)",
    muted: "var(--muted-light, #475569)",
  },
};

export function SectionShell({
  id,
  children,
  backgroundSlot,
  variant,
  theme,
  tone,
  noDivider = false,
  noGlowLine = false,
  allowOverflow = false,
}: SectionShellProps) {
  const styles = SECTION_STYLES[variant];
  const accent = SECTION_ACCENTS[variant];
  const isHero = variant === "hero";
  const dataTheme = theme || (variant === "who" ? "audience" : variant);
  const activeTone = tone ? toneStyles[tone] : null;

  return (
    <Box
      id={id}
      component="section"
      data-theme={dataTheme}
      data-tone={tone || "dark"}
      sx={{
        position: "relative",
        overflow: allowOverflow ? "visible" : "hidden",
        scrollMarginTop: isHero ? 0 : "88px",
        ...(styles.minHeight && { minHeight: styles.minHeight }),
        ...(styles.pt ? { pt: styles.pt } : {}),
        ...(styles.pb ? { pb: styles.pb } : {}),
        ...(!styles.pt && !styles.pb ? { py: styles.py } : {}),
        display: isHero ? "flex" : "block",
        alignItems: isHero ? "center" : undefined,
        "--section-accent": accent.primary,
        "--section-glow": accent.glow,
        "--section-accent-rgb": accent.rgb,
        ...(activeTone && {
          "--section-text": activeTone.text,
          "--section-muted": activeTone.muted,
        }),
      }}
    >
      {/* A) Base background */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: activeTone ? activeTone.base : styles.base,
        }}
      />

      {/* B) Decorative glows (dark tone only) */}
      {(!tone || tone === "dark") && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background: styles.decorative,
            backgroundSize:
              variant === "how"
                ? "100% 100%, 100% 100%, 100% 100%, 48px 48px, 48px 48px"
                : "100% 100%",
          }}
        />
      )}

      {/* C) Top glow line */}
      {!isHero &&
        !noGlowLine &&
        styles.glowLineColor !== "transparent" &&
        !tone && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: "1px",
              zIndex: 5,
              pointerEvents: "none",
              background: `linear-gradient(90deg, transparent 0%, ${styles.glowLineColor} 30%, ${styles.glowLineColor} 70%, transparent 100%)`,
              boxShadow: `0 0 20px 2px ${styles.glowLineColor}, 0 0 40px 4px ${styles.glowLineColor.replace(/[\d.]+\)$/, "0.1)")}`,
              opacity: 0.8,
            }}
          />
        )}

      {/* D) Top fade */}
      {!isHero && styles.topFade !== "transparent" && !tone && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: { xs: 100, md: 140 },
            zIndex: 2,
            pointerEvents: "none",
            background: styles.topFade,
          }}
        />
      )}

      {/* B2) Background slot — full-bleed, positioned absolutely, below content */}
      {backgroundSlot && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {backgroundSlot}
        </Box>
      )}

      {/* E) Content wrapper */}
      <Box sx={{ position: "relative", zIndex: 3, width: "100%" }}>
        {children}
      </Box>

      {/* F) Bottom divider */}
      {!noDivider && styles.dividerColor !== "transparent" && !tone && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -1,
            height: { xs: 140, md: 200 },
            zIndex: 4,
            pointerEvents: "none",
            background: `linear-gradient(to bottom, transparent 0%, ${styles.dividerColor} 100%)`,
          }}
        />
      )}
    </Box>
  );
}
