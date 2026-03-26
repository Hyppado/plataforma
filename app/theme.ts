"use client";

import { createTheme, type ThemeOptions } from "@mui/material/styles";

// ============================================================
// Hyppado Unified Theme
// ============================================================
// Single source of truth for all visual tokens.
// Two variants exported:
//   • landingTheme — marketing/landing page (larger type, rich overrides)
//   • appTheme    — authenticated app + login (compact, dense)
//
// DO NOT create additional createTheme() calls elsewhere.
// ============================================================

// ── Shared palette & base tokens ──────────────────────────────
const palette = {
  mode: "dark" as const,
  background: {
    default: "#06080F",
    paper: "#0A0F18",
  },
  primary: {
    main: "#2DD4FF",
    light: "#6BE0FF",
    dark: "#00B8E6",
    contrastText: "#070B12",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "rgba(255,255,255,0.7)",
  },
};

const sharedComponents: ThemeOptions["components"] = {
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: "none" as const,
        fontWeight: 600,
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.04)",
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(45,212,255,0.4)",
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: "#2DD4FF",
          borderWidth: 2,
        },
        "&.Mui-error .MuiOutlinedInput-notchedOutline": {
          borderColor: "#ef4444",
        },
      },
      notchedOutline: {
        borderColor: "rgba(255,255,255,0.12)",
      },
      input: {
        padding: "14px 16px",
      },
    },
  },
};

// ── Section theme CSS variables (landing page only) ───────────
const sectionThemeStyles = `
  :root {
    --hyp-base: #070B12;
    --hyp-surface: #0D1520;
    --hyp-accent: #39D5FF;
    --hyp-accent-rgb: 57, 213, 255;
  }
  [data-theme="hero"] {
    --section-bg1: #0c1420; --section-bg2: #070B12;
    --section-accent: rgba(57, 213, 255, 0.12);
    --section-glow: rgba(57, 213, 255, 0.25);
    --section-hue: 195;
  }
  [data-theme="how"] {
    --section-bg1: #0a1118; --section-bg2: #0b1320;
    --section-accent: rgba(45, 212, 255, 0.10);
    --section-glow: rgba(45, 212, 255, 0.20);
    --section-hue: 188;
  }
  [data-theme="receive"] {
    --section-bg1: #090e18; --section-bg2: #0c1424;
    --section-accent: rgba(80, 140, 255, 0.08);
    --section-glow: rgba(80, 140, 255, 0.18);
    --section-hue: 220;
  }
  [data-theme="flow"] {
    --section-bg1: #0a0f1a; --section-bg2: #0d1428;
    --section-accent: rgba(130, 100, 255, 0.07);
    --section-glow: rgba(130, 100, 255, 0.16);
    --section-hue: 255;
  }
  [data-theme="audience"] {
    --section-bg1: #080d15; --section-bg2: #0b1322;
    --section-accent: rgba(57, 213, 255, 0.08);
    --section-glow: rgba(120, 90, 255, 0.14);
    --section-hue: 265;
  }
  [data-theme="pricing"] {
    --section-bg1: #070b12; --section-bg2: #0a1220;
    --section-accent: rgba(50, 180, 255, 0.10);
    --section-glow: rgba(50, 180, 255, 0.22);
    --section-hue: 200;
  }
  [data-theme="faq"] {
    --section-bg1: #060910; --section-bg2: #080c14;
    --section-accent: rgba(57, 213, 255, 0.05);
    --section-glow: rgba(57, 213, 255, 0.12);
    --section-hue: 195;
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes glow-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`;

// ── Landing theme (marketing pages) ──────────────────────────
export const landingTheme = createTheme({
  palette: {
    ...palette,
    background: {
      default: "#070B12",
      paper: "#0D1520",
    },
    primary: {
      ...palette.primary,
      main: "#39D5FF",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontSize: "3.25rem",
      fontWeight: 800,
      lineHeight: 1.08,
      letterSpacing: "-0.025em",
    },
    body1: { fontSize: "1.0625rem", lineHeight: 1.7 },
    body2: { fontSize: "0.9375rem", lineHeight: 1.65 },
  },
  shape: { borderRadius: 8 },
  components: {
    ...sharedComponents,
    MuiCssBaseline: {
      styleOverrides: `
        *, *::before, *::after { box-sizing: border-box; }
        html { margin: 0; padding: 0; background-color: #070B12; }
        body { margin: 0; padding: 0; background-color: #070B12; }
        ${sectionThemeStyles}
      `,
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(7, 11, 18, 0.85)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none" as const,
          fontWeight: 600,
          borderRadius: "999px",
        },
        containedPrimary: {
          backgroundColor: "#39D5FF",
          color: "#070B12",
          boxShadow: "0 0 24px rgba(57, 213, 255, 0.4)",
          "&:hover": {
            backgroundColor: "#5CE0FF",
            boxShadow: "0 0 32px rgba(57, 213, 255, 0.55)",
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: "#8595A5",
          textDecoration: "none",
          transition: "color 0.2s ease",
          "&:hover": { color: "#FFFFFF" },
        },
      },
    },
  },
});

// ── App theme (authenticated area + login) ───────────────────
export const appTheme = createTheme({
  palette,
  typography: {
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    h1: { fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.3 },
    h2: { fontSize: "1.1rem", fontWeight: 600, lineHeight: 1.3 },
    body1: { fontSize: "0.8125rem", lineHeight: 1.4 },
    body2: { fontSize: "0.75rem", lineHeight: 1.35 },
  },
  components: {
    ...sharedComponents,
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: "0.8125rem" },
        input: { padding: "6px 8px" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none" as const, fontSize: "0.8125rem" },
        sizeSmall: { padding: "4px 10px", fontSize: "0.75rem" },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { padding: "6px" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontSize: "0.6875rem", height: "22px" },
      },
    },
  },
});

// Default export = landing theme (preserves existing import in app/page.tsx)
export default landingTheme;
