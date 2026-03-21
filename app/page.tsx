"use client";

import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  Button,
  AppBar,
  Toolbar,
  Link,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  ThemeProvider,
  CssBaseline,
  Tooltip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  PersonOutline,
  CheckCircleOutline,
  ExpandMore as ExpandMoreIcon,
  Instagram as InstagramIcon,
  HomeOutlined,
  AutoAwesomeOutlined,
  GroupOutlined,
  WorkspacePremiumOutlined,
  HelpOutlineOutlined,
  LoginOutlined,
  KeyboardArrowDownRounded,
  KeyboardArrowUpRounded,
  ImageOutlined,
  AutoAwesome,
} from "@mui/icons-material";
import theme from "./theme";
import { type PlanDisplay, fetchPlans } from "./data/plans";

// Fallback estático caso a API não responda
const PLANS_FALLBACK: PlanDisplay[] = [
  {
    id: "pro",
    code: "pro_mensal",
    name: "Pro",
    displayPrice: "R$ 59,90",
    period: "mês",
    description: "Todas funcionalidades",
    features: [
      "40 transcripts / mês",
      "70 insights / mês",
      "Descoberta de vídeos e produtos em alta",
      "Prompts avançados (gancho, roteiro e CTA)",
      "Organização por categorias",
    ],
    highlight: false,
  },
  {
    id: "premium",
    code: "premium_anual",
    name: "Premium",
    displayPrice: "R$ 647,00",
    period: "ano",
    description: "Todas funcionalidades do PRO",
    features: [
      "Tudo do Pro incluso",
      "Economia de 10% vs mensal",
      "Acesso prioritário a novidades",
      "Suporte prioritário",
    ],
    highlight: true,
    badge: "Mais escolhido",
  },
];

function usePlans(): PlanDisplay[] {
  const [plans, setPlans] = useState<PlanDisplay[]>(PLANS_FALLBACK);
  useEffect(() => {
    fetchPlans().then((p) => {
      if (p.length > 0) setPlans(p);
    });
  }, []);
  return plans;
}
import { BrandLogo } from "@/app/components/BrandLogo";

/* ============================================
   NAV LINKS CONFIG
============================================ */
const NAV_LINKS = [
  { label: "Início", href: "#inicio", icon: HomeOutlined },
  { label: "Como funciona", href: "#como-funciona", icon: AutoAwesomeOutlined },
  { label: "Para quem é", href: "#para-quem-e", icon: GroupOutlined },
  { label: "Planos", href: "#planos", icon: WorkspacePremiumOutlined },
  { label: "FAQ", href: "#faq", icon: HelpOutlineOutlined },
];

const NAVBAR_OFFSET = 80;

/* ============================================
   SCROLL STATE HOOK
============================================ */
function useScrollState() {
  const [scrollY, setScrollY] = useState(0);
  const [isNearTop, setIsNearTop] = useState(true);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrollY(y);
        setIsNearTop(y < 120);
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { scrollY, isNearTop };
}

/* ============================================
   SCROLL HELPERS
============================================ */
function scrollToId(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  const y =
    element.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;
  window.scrollTo({ top: y, behavior: "smooth" });
}

function getNextSectionId(): string {
  const sections = document.querySelectorAll("section[id]");
  const ids = Array.from(sections).map((s) => s.id);
  const inicioIndex = ids.indexOf("inicio");
  if (inicioIndex !== -1 && inicioIndex < ids.length - 1) {
    return ids[inicioIndex + 1];
  }
  return "como-funciona";
}

/* ============================================
   REVEAL COMPONENT (IntersectionObserver)
============================================ */
function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : "translateY(14px)",
        transition: `opacity 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Box>
  );
}

/* ============================================
   SCROLL ARROWS COMPONENT (↑ top + ↓ bottom)
============================================ */
const SECTION_IDS = ["inicio", "como-funciona", "para-quem-e", "planos", "faq"];
const HEADER_OFFSET = 88;

function ScrollArrows() {
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setMounted(true);
    setScrollY(window.scrollY);
  }, []);

  // Listener de scroll simples
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Mostrar seta ↑ quando rolar mais de 300px
  const showUpArrow = scrollY > 300;

  // Scroll para a próxima seção
  const handleDownClick = () => {
    const currentY = window.scrollY;
    let targetEl: HTMLElement | null = null;

    for (let i = 0; i < SECTION_IDS.length; i++) {
      const el = document.getElementById(SECTION_IDS[i]);
      if (el && el.offsetTop > currentY + HEADER_OFFSET + 1) {
        targetEl = el;
        break;
      }
    }

    if (targetEl) {
      window.scrollTo({
        top: targetEl.offsetTop - HEADER_OFFSET,
        behavior: "smooth",
      });
    } else {
      // Scroll para o final da página
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Scroll para o topo
  const handleUpClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!mounted) return null;

  // Estilos base do botão
  const arrowButtonSx = {
    position: "fixed" as const,
    left: "50%",
    zIndex: 1400,
    width: 48,
    height: 48,
    minWidth: 44,
    minHeight: 44,
    borderRadius: "50%",
    border: "1px solid rgba(255, 255, 255, 0.10)",
    background: "rgba(13, 21, 32, 0.78)",
    backdropFilter: "blur(14px)",
    boxShadow: "0 8px 28px rgba(0, 0, 0, 0.38)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.22s ease",
    "&:hover": {
      borderColor: "rgba(57, 213, 255, 0.30)",
      boxShadow:
        "0 12px 32px rgba(0, 0, 0, 0.45), 0 0 20px rgba(57, 213, 255, 0.15)",
    },
  };

  return (
    <>
      {/* Seta ↑ no topo (só aparece a partir da 2ª seção) */}
      {showUpArrow && (
        <Tooltip title="Voltar ao topo" placement="bottom" arrow>
          <Box
            component="button"
            onClick={handleUpClick}
            aria-label="Voltar ao topo"
            sx={{
              ...arrowButtonSx,
              top: { xs: 78, md: 86 },
              transform: "translateX(-50%)",
              "&:hover": {
                ...arrowButtonSx["&:hover"],
                transform: "translateX(-50%) translateY(2px)",
              },
              "&:active": {
                transform: "translateX(-50%) translateY(0)",
              },
            }}
          >
            <KeyboardArrowUpRounded sx={{ fontSize: 26, color: "#39D5FF" }} />
          </Box>
        </Tooltip>
      )}

      {/* Seta ↓ no rodapé (sempre visível) */}
      <Tooltip title="Próxima seção" placement="top" arrow>
        <Box
          component="button"
          onClick={handleDownClick}
          aria-label="Rolar para próxima seção"
          sx={{
            ...arrowButtonSx,
            bottom: { xs: 18, md: 24 },
            transform: "translateX(-50%)",
            "&:hover": {
              ...arrowButtonSx["&:hover"],
              transform: "translateX(-50%) translateY(-2px)",
            },
            "&:active": {
              transform: "translateX(-50%) translateY(0)",
            },
          }}
        >
          <KeyboardArrowDownRounded sx={{ fontSize: 26, color: "#39D5FF" }} />
        </Box>
      </Tooltip>
    </>
  );
}

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
  variant: SectionVariant;
  theme?: SectionTheme;
  tone?: SectionTone;
  noDivider?: boolean;
  noGlowLine?: boolean;
  allowOverflow?: boolean;
}

/*
 * SECTION ACCENT COLORS
 * Cada seção possui um accent hue diferente para criar
 * variação visual integrada (premium SaaS look)
 */
const SECTION_ACCENTS: Record<
  SectionVariant,
  {
    primary: string;
    glow: string;
    rgb: string;
  }
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
  // HERO: fundo escuro uniforme #06080F + glows sutis (sem faixa clara)
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
  // COMO FUNCIONA: teal/cyan com neon haze
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
  // O QUE VOCÊ RECEBE: indigo/blue sutil
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
  // DO DADO À AÇÃO: purple sutil
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
  // PARA QUEM É: roxo/azulado sutil + cyan discreto
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
  // PLANOS: electric blue, vitrine premium
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
  // FAQ: clean, calmo, linhas sutis
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

function SectionShell({
  id,
  children,
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

  // Tone-based backgrounds (DARK ↔ LIGHT alternation)
  // Only navy, blue, cyan, sky - ZERO green
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
        // CSS custom properties for this section
        "--section-accent": accent.primary,
        "--section-glow": accent.glow,
        "--section-accent-rgb": accent.rgb,
        // Tone-based text color tokens
        ...(activeTone && {
          "--section-text": activeTone.text,
          "--section-muted": activeTone.muted,
        }),
      }}
    >
      {/* A) Base background layer */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: activeTone ? activeTone.base : styles.base,
        }}
      />

      {/* B) Decorative glows layer (only show for dark tone or no tone) */}
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

      {/* C) Top glow line divider (integrates with previous section) */}
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

      {/* D) Top fade (blend from previous section - only for dark sections without tone) */}
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

      {/* E) Content wrapper */}
      <Box
        sx={{
          position: "relative",
          zIndex: 3,
          width: "100%",
        }}
      >
        {children}
      </Box>

      {/* F) Bottom divider gradient (blends into next section - only for dark sections without tone) */}
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

/* ============================================
   MEDIA SLOT - PLACEHOLDER/SKELETON COMPONENT
============================================ */
/*
 * === SUGESTÕES DE ASSETS PARA GERAR ===
 *
 * public/sections/how-it-works-dashboard.png
 *   → Mock premium de dashboard dark, cards, gráficos, métricas
 *   → Estilo: glassmorphism, tons de azul/cyan, sem marcas
 *   → Dimensões sugeridas: 1200x600px
 *
 * public/sections/for-who-banner.png
 *   → Banner abstrato horizontal: linhas fluidas, partículas, glow cyan
 *   → Estilo: tech/SaaS, formas geométricas suaves
 *   → Dimensões sugeridas: 1400x400px
 *
 * public/sections/plans-trust-badge.png
 *   → Mini ilustração: escudo com check, "secure payment" vibe
 *   → Estilo: ícone/badge premium, sem texto
 *   → Dimensões sugeridas: 200x60px
 *
 * public/sections/faq-abstract.png
 *   → Ilustração vertical abstrata com formas suaves
 *   → Estilo: ondas, gradientes, partículas sutis
 *   → Dimensões sugeridas: 400x600px
 */

interface ImageSlotProps {
  src?: string;
  alt?: string;
  height?: number | { xs: number; md: number };
  width?: string | number;
  radius?: number;
  variant?: "rounded" | "card" | "banner" | "badge" | "hero" | "icon";
  icon?: ReactNode;
  label?: string;
  className?: string;
}

/*
 * ImageSlot - Placeholder premium com glass morphism e shimmer
 * Usa CSS variables do tema da seção (--section-accent-rgb)
 *
 * Variants:
 * - rounded: cantos arredondados médios (12px)
 * - card: visual de card com bordas suaves (16px)
 * - banner: wide/panorâmico com cantos leves (8px)
 * - badge: pequeno/compacto (full rounded)
 * - hero: grande destaque (20px)
 * - icon: circular com ícone central
 */
function ImageSlot({
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

  // Se tem src e não deu erro, renderiza imagem
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

  // Fallback: Skeleton premium com glass + shimmer
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
        // Shimmer animation usando cor do tema
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
        // Subtle glow pulse
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

// Versão simplificada para uso rápido (compatível com código existente)
interface MediaSlotProps {
  src?: string;
  alt?: string;
  height?: number | { xs: number; md: number };
  radius?: number;
  variant?: "skeleton" | "icon";
  icon?: ReactNode;
}

function MediaSlot({
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

/* ============================================
   HERO IMAGE COMPONENT WITH FALLBACK
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
      width={560}
      height={700}
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
   HERO VISUAL - FLOATING INFLUENCER WITH GLOW
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
      {/* ===== GLOW DE FUNDO ===== */}
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

      {/* Anéis decorativos */}
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

      {/* ===== IMAGEM COM MÁSCARA DE FADE ===== */}
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
          // Máscara que dissolve a parte inferior da imagem
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
   HERO BACKGROUND VIDEO COMPONENT
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
   MAIN PAGE COMPONENT
============================================ */
export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const plans = usePlans();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Full page wrapper */}
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "#070B12",
          position: "relative",
        }}
      >
        {/* ==================== LOGO FLUTUANTE (FORA DO HEADER) ==================== */}
        <Box
          sx={{
            position: "fixed",
            top: { xs: 12, sm: 16, md: 20 },
            left: { xs: 16, sm: 24, md: 32 },
            zIndex: 1200,
            height: { xs: 48, sm: 60, md: 76 },
            minWidth: { xs: 130, sm: 160, md: 200 },
            display: "flex",
            alignItems: "center",
            pointerEvents: "auto",
          }}
        >
          <BrandLogo variant="full" size="lg" href="/" mode="dark" priority />
        </Box>

        {/* ==================== NAVBAR (CÁPSULA CENTRALIZADA) ==================== */}
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            display: "flex",
            justifyContent: "center",
            pt: { xs: 1.5, md: 2 },
            px: { xs: 1.5, sm: 2, md: 3 },
            pointerEvents: "none",
          }}
        >
          {/* Container central - cápsula com largura limitada */}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              maxWidth: { xs: "100%", sm: "calc(100% - 32px)", md: 1100 },
              pointerEvents: "auto",
            }}
          >
            {/* HEADER CÁPSULA */}
            <AppBar
              position="static"
              elevation={0}
              sx={{
                background: "rgba(7, 11, 18, 0.88)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: { xs: "16px", md: "24px" },
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
              }}
            >
              <Toolbar
                disableGutters
                sx={{
                  minHeight: { xs: 52, md: 56 },
                  px: { xs: 2, sm: 2.5, md: 3 },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* CENTRO: Nav links (desktop) */}
                <Stack
                  component="nav"
                  direction="row"
                  spacing={0.5}
                  sx={{
                    display: { xs: "none", md: "flex" },
                    justifyContent: "center",
                    flex: 1,
                  }}
                >
                  {NAV_LINKS.map(({ label, href, icon: Icon }) => (
                    <Link
                      key={label}
                      href={href}
                      underline="none"
                      onClick={(e) => {
                        if (href.startsWith("#")) {
                          e.preventDefault();
                          document
                            .getElementById(href.slice(1))
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        }
                      }}
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.6,
                        px: 1.5,
                        py: 0.6,
                        fontSize: "0.84rem",
                        fontWeight: 500,
                        color: "#9AA8B8",
                        whiteSpace: "nowrap",
                        borderRadius: "999px",
                        border: "1px solid transparent",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                        "&:hover": {
                          color: "#fff",
                          background: "rgba(255, 255, 255, 0.04)",
                          borderColor: "rgba(255, 255, 255, 0.08)",
                        },
                        "& .nav-icon": {
                          fontSize: 16,
                          opacity: 0.7,
                          transition: "opacity 0.2s ease",
                        },
                        "&:hover .nav-icon": {
                          opacity: 1,
                        },
                      }}
                    >
                      <Icon className="nav-icon" />
                      {label}
                    </Link>
                  ))}
                </Stack>

                {/* Desktop right section - Entrar */}
                <Box
                  sx={{
                    display: { xs: "none", md: "flex" },
                    position: "absolute",
                    right: { md: 20 },
                  }}
                >
                  <Link
                    href="/login"
                    underline="none"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.6,
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "#fff",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        color: "#39D5FF",
                      },
                      "& .login-icon": {
                        fontSize: 17,
                        transition: "color 0.2s ease",
                      },
                    }}
                  >
                    <LoginOutlined className="login-icon" />
                    Entrar
                  </Link>
                </Box>

                {/* Mobile menu icon */}
                <IconButton
                  aria-label="abrir menu"
                  onClick={handleDrawerToggle}
                  sx={{
                    display: { xs: "flex", md: "none" },
                    color: "#fff",
                    ml: "auto",
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </Toolbar>
            </AppBar>
          </Box>
        </Box>

        {/* Mobile Drawer */}
        <Drawer
          anchor="right"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          PaperProps={{
            sx: {
              width: 280,
              background: "#0D1520",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="flex-end">
              <IconButton onClick={handleDrawerToggle} sx={{ color: "#fff" }}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <List sx={{ mt: 2 }}>
              {NAV_LINKS.map(({ label, href, icon: Icon }) => (
                <ListItem key={label} disablePadding>
                  <ListItemButton
                    component="a"
                    href={href}
                    onClick={(e: React.MouseEvent) => {
                      handleDrawerToggle();
                      if (href.startsWith("#")) {
                        e.preventDefault();
                        setTimeout(() => {
                          document
                            .getElementById(href.slice(1))
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        }, 300);
                      }
                    }}
                    sx={{
                      py: 1.5,
                      "&:hover": { background: "rgba(57,213,255,0.08)" },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Icon sx={{ fontSize: 20, color: "#9AA8B8" }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{
                        fontSize: "0.95rem",
                        fontWeight: 500,
                        color: "#C0D0E0",
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              <ListItem disablePadding>
                <ListItemButton
                  component="a"
                  href="/login"
                  onClick={handleDrawerToggle}
                  sx={{
                    py: 1.5,
                    "&:hover": { background: "rgba(57,213,255,0.08)" },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <LoginOutlined sx={{ fontSize: 20, color: "#39D5FF" }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Entrar"
                    primaryTypographyProps={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "#39D5FF",
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>

        {/* ==================== HERO SECTION ==================== */}
        <SectionShell id="inicio" variant="hero" tone="dark">
          {/* Video Background - zIndex 0 */}
          <HeroBackgroundVideo />

          {/* Overlay 1 — Contraste/legibilidade */}
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

          {/* Overlay 2 — Accent sutil lado esquerdo */}
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

          {/* Overlay 3 — Vinheta suave */}
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

          {/* Conteúdo do hero */}
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
              {/* ===== LEFT COLUMN - Content ===== */}
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    maxWidth: { xs: "100%", md: 480 },
                    textAlign: { xs: "center", md: "left" },
                    mx: { xs: "auto", md: 0 },
                  }}
                >
                  {/* H1 */}
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

                  {/* Subtitle */}
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

                  {/* Bullet points */}
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

                  {/* CTA - THE ONLY ONE */}
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

              {/* ===== RIGHT COLUMN - Glass Card Visual ===== */}
              <Grid item xs={12} md={6}>
                <HeroVisual />
              </Grid>
            </Grid>
          </Container>
        </SectionShell>

        {/* ==================== COMO FUNCIONA SECTION ==================== */}
        <SectionShell id="como-funciona" variant="how" tone="light">
          <Container maxWidth="lg">
            <Reveal>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: "1.75rem", sm: "2rem", md: "2.5rem" },
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                  color: "var(--section-text, #fff)",
                  textAlign: "center",
                  mb: 2,
                }}
              >
                Como funciona
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.125rem" },
                  color: "var(--section-muted, #A0B0C0)",
                  textAlign: "center",
                  maxWidth: 560,
                  mx: "auto",
                  mb: 6,
                }}
              >
                Da conexão à ação: veja como a Hyppado transforma dados em
                oportunidades para criadores e afiliados.
              </Typography>
            </Reveal>

            <Reveal delay={100}>
              {/* ===== PASSO A PASSO ===== */}
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#39D5FF",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                  mb: 4,
                }}
              >
                PASSO A PASSO
              </Typography>

              <Grid container spacing={4} justifyContent="center">
                {[
                  {
                    step: "1",
                    title: "Conecte sua conta",
                    description:
                      "Crie sua conta em segundos e acesse o painel. Sem burocracia.",
                  },
                  {
                    step: "2",
                    title: "Descubra produtos em alta",
                    description:
                      "Explore milhares de produtos com métricas de desempenho.",
                  },
                  {
                    step: "3",
                    title: "Analise vídeos e métricas",
                    description:
                      "Veja quais vídeos estão bombando e entenda os padrões.",
                  },
                  {
                    step: "4",
                    title: "Aja com confiança",
                    description:
                      "Tome decisões baseadas em dados reais. Promova os produtos certos.",
                  },
                ].map((item, index) => (
                  <Grid item xs={12} sm={6} md={3} key={item.step}>
                    <Box
                      sx={{
                        textAlign: "center",
                        p: 3,
                        borderRadius: 3,
                        position: "relative",
                        background: "rgba(255, 255, 255, 0.85)",
                        border: "1px solid rgba(148, 163, 184, 0.25)",
                        backdropFilter: "blur(8px)",
                        boxShadow: "0 8px 32px rgba(2, 6, 23, 0.06)",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                          transform: "translateY(-4px)",
                          border: "1px solid rgba(34, 211, 238, 0.45)",
                          boxShadow:
                            "0 12px 40px rgba(2, 6, 23, 0.10), 0 0 24px rgba(34, 211, 238, 0.12)",
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, rgba(34, 211, 238, 0.20) 0%, rgba(56, 189, 248, 0.10) 100%)",
                          border: "1px solid rgba(34, 211, 238, 0.40)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          mx: "auto",
                          mb: 2.5,
                          boxShadow: "0 0 20px rgba(34, 211, 238, 0.15)",
                          transition: "all 0.3s ease",
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: "1.25rem",
                            fontWeight: 700,
                            color: "#0891B2",
                          }}
                        >
                          {item.step}
                        </Typography>
                      </Box>
                      <Typography
                        component="h3"
                        sx={{
                          fontSize: "1.05rem",
                          fontWeight: 600,
                          color: "#0F172A",
                          mb: 1,
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          color: "#475569",
                          lineHeight: 1.6,
                        }}
                      >
                        {item.description}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Reveal>

            {/* Visual Preview Card - Placeholder for future dashboard screenshot */}
            {/* src="/sections/how-it-works-dashboard.png" quando disponível */}
            <Reveal delay={150}>
              <Box
                sx={{
                  mt: { xs: 6, md: 8 },
                  mx: "auto",
                  maxWidth: 900,
                }}
              >
                <ImageSlot
                  // src="/sections/how-it-works-dashboard.png"
                  alt="Preview do dashboard Hyppado"
                  height={{ xs: 200, md: 320 }}
                  radius={16}
                  variant="card"
                  icon={<AutoAwesome sx={{ fontSize: 48, color: "#39D5FF" }} />}
                />
              </Box>
            </Reveal>

            {/* ===== A) O QUE VOCÊ RECEBE ===== */}
            <Reveal delay={50}>
              <Box sx={{ mt: { xs: 12, md: 16 } }}>
                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: "1.5rem", md: "1.75rem" },
                    fontWeight: 700,
                    color: "#0F172A",
                    textAlign: "center",
                    mb: 1.5,
                  }}
                >
                  O que você recebe
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: "0.95rem", md: "1rem" },
                    color: "#475569",
                    textAlign: "center",
                    maxWidth: 480,
                    mx: "auto",
                    mb: 5,
                  }}
                >
                  Ferramentas práticas para quem quer resultados reais.
                </Typography>

                <Grid container spacing={3}>
                  {[
                    {
                      title: "Radar de produtos",
                      description: "Veja o que está subindo antes de saturar.",
                    },
                    {
                      title: "Biblioteca de vídeos",
                      description: "Encontre referências por formato e estilo.",
                    },
                    {
                      title: "Filtros por nicho",
                      description:
                        "Isole oportunidades por categoria e público.",
                    },
                    {
                      title: "Métricas essenciais",
                      description: "Valide sinais com números claros.",
                    },
                    {
                      title: "Transcrição de vídeos",
                      description:
                        "Transforme vídeo em texto para analisar rápido.",
                    },
                    {
                      title: "Prompts para criativos",
                      description:
                        "Gere prompts para modelar variações do criativo.",
                    },
                  ].map((card, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Box
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          background: "rgba(255, 255, 255, 0.85)",
                          border: "1px solid rgba(148, 163, 184, 0.25)",
                          height: "100%",
                          boxShadow: "0 8px 32px rgba(2, 6, 23, 0.06)",
                          transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": {
                            background: "rgba(255, 255, 255, 0.95)",
                            borderColor: "rgba(34, 211, 238, 0.45)",
                            transform: "translateY(-4px)",
                            boxShadow:
                              "0 12px 40px rgba(2, 6, 23, 0.10), 0 0 24px rgba(34, 211, 238, 0.12)",
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            background:
                              "linear-gradient(135deg, rgba(34, 211, 238, 0.20) 0%, rgba(56, 189, 248, 0.10) 100%)",
                            border: "1px solid rgba(34, 211, 238, 0.40)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mb: 2,
                            transition: "all 0.35s ease",
                            ".MuiBox-root:hover > &": {
                              boxShadow: "0 0 16px rgba(34, 211, 238, 0.35)",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: "#0891B2",
                              boxShadow: "0 0 12px rgba(34, 211, 238, 0.5)",
                            }}
                          />
                        </Box>
                        <Typography
                          component="h4"
                          sx={{
                            fontSize: "1rem",
                            fontWeight: 600,
                            color: "#0F172A",
                            mb: 0.75,
                          }}
                        >
                          {card.title}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "0.875rem",
                            color: "#475569",
                            lineHeight: 1.55,
                          }}
                        >
                          {card.description}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Reveal>

            {/* ===== B) DO DADO À AÇÃO ===== */}
            <Reveal delay={50}>
              <Box sx={{ mt: { xs: 12, md: 16 } }}>
                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: "1.5rem", md: "1.75rem" },
                    fontWeight: 700,
                    color: "#0F172A",
                    textAlign: "center",
                    mb: 1.5,
                  }}
                >
                  Do dado à ação
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: "0.95rem", md: "1rem" },
                    color: "#475569",
                    textAlign: "center",
                    maxWidth: 480,
                    mx: "auto",
                    mb: 6,
                  }}
                >
                  Um fluxo simples para transformar informação em resultado.
                </Typography>

                <Grid container spacing={2} justifyContent="center">
                  {[
                    {
                      step: "1",
                      title: "Descubra",
                      description:
                        "Encontre produtos e vídeos em alta com filtros inteligentes.",
                    },
                    {
                      step: "2",
                      title: "Valide",
                      description:
                        "Analise métricas reais antes de investir tempo ou dinheiro.",
                    },
                    {
                      step: "3",
                      title: "Compare",
                      description:
                        "Coloque opções lado a lado e identifique a melhor escolha.",
                    },
                    {
                      step: "4",
                      title: "Aja",
                      description:
                        "Promova com confiança sabendo que os dados sustentam sua decisão.",
                    },
                  ].map((item, index, arr) => (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                      key={item.step}
                      sx={{ position: "relative" }}
                    >
                      <Box
                        sx={{
                          textAlign: "center",
                          p: 3,
                          position: "relative",
                        }}
                      >
                        {/* Connector line */}
                        {index < arr.length - 1 && (
                          <Box
                            sx={{
                              display: { xs: "none", md: "block" },
                              position: "absolute",
                              top: 32,
                              right: -16,
                              width: 32,
                              height: 2,
                              background:
                                "linear-gradient(90deg, rgba(34, 211, 238, 0.5) 0%, rgba(56, 189, 248, 0.2) 100%)",
                              boxShadow: "0 0 8px rgba(34, 211, 238, 0.2)",
                            }}
                          />
                        )}
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg, rgba(34, 211, 238, 0.25) 0%, rgba(56, 189, 248, 0.12) 100%)",
                            border: "2px solid rgba(34, 211, 238, 0.50)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mx: "auto",
                            mb: 2,
                            boxShadow: "0 0 20px rgba(34, 211, 238, 0.20)",
                            transition: "all 0.35s ease",
                            "&:hover": {
                              boxShadow: "0 0 28px rgba(34, 211, 238, 0.40)",
                              transform: "scale(1.08)",
                            },
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: "1.25rem",
                              fontWeight: 800,
                              color: "#0891B2",
                            }}
                          >
                            {item.step}
                          </Typography>
                        </Box>
                        <Typography
                          component="h4"
                          sx={{
                            fontSize: "1.125rem",
                            fontWeight: 700,
                            color: "#0F172A",
                            mb: 1,
                          }}
                        >
                          {item.title}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "0.875rem",
                            color: "#475569",
                            lineHeight: 1.6,
                            maxWidth: 200,
                            mx: "auto",
                          }}
                        >
                          {item.description}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Reveal>

            {/* ===== C) MODELAGEM DE CRIATIVO ===== */}
            <Reveal delay={50}>
              <Box sx={{ mt: { xs: 12, md: 16 } }}>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#0891B2",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    textAlign: "center",
                    mb: 2,
                  }}
                >
                  MODELAGEM DE CRIATIVO
                </Typography>

                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: "1.5rem", md: "1.75rem" },
                    fontWeight: 700,
                    color: "#0F172A",
                    textAlign: "center",
                    mb: 2,
                  }}
                >
                  Transforme um vídeo em variações prontas para testar
                </Typography>

                <Typography
                  sx={{
                    fontSize: { xs: "0.95rem", md: "1rem" },
                    color: "#475569",
                    textAlign: "center",
                    maxWidth: 640,
                    mx: "auto",
                    mb: 6,
                  }}
                >
                  Você sai do &quot;não sei o que gravar&quot; para um roteiro
                  claro, com opções de ganchos e chamadas, em minutos.
                </Typography>

                {/* Timeline - Desktop (horizontal) */}
                <Box
                  sx={{
                    display: { xs: "none", md: "block" },
                    position: "relative",
                  }}
                >
                  {/* Connecting line with glow effect */}
                  <Box
                    sx={{
                      position: "absolute",
                      top: 24,
                      left: "12.5%",
                      right: "12.5%",
                      height: 2,
                      background:
                        "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.5) 20%, rgba(34, 211, 238, 0.5) 80%, transparent)",
                      zIndex: 0,
                      boxShadow:
                        "0 0 12px rgba(34, 211, 238, 0.25), 0 0 24px rgba(34, 211, 238, 0.15)",
                      "&::after": {
                        content: '""',
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6) 40%, rgba(34, 211, 238, 0.6) 60%, transparent)",
                        filter: "blur(4px)",
                        opacity: 0.5,
                      },
                    }}
                  />

                  <Grid container spacing={3}>
                    {[
                      {
                        step: 1,
                        title: "Escolha o que testar",
                        text: "Encontre um produto com sinais de oportunidade para começar com mais direção.",
                      },
                      {
                        step: 2,
                        title: "Transcreva o vídeo",
                        text: "Entenda a estrutura: gancho, prova, ritmo e chamada para ação.",
                      },
                      {
                        step: 3,
                        title: "Gere variações",
                        text: "Receba ideias de ângulos, ganchos e roteiros para modelar o criativo.",
                        chips: ["Gancho", "Prova", "Roteiro", "CTA"],
                      },
                      {
                        step: 4,
                        title: "Teste e aprenda",
                        text: "Publique versões, compare respostas e refine o que funciona.",
                      },
                    ].map((item) => (
                      <Grid item xs={12} md={3} key={item.step}>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          {/* Step dot */}
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, #22D3EE 0%, #0891B2 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: 3,
                              boxShadow:
                                "0 0 24px rgba(34, 211, 238, 0.45), 0 0 48px rgba(34, 211, 238, 0.25)",
                              transition: "all 0.35s ease",
                              "&:hover": {
                                transform: "scale(1.1)",
                                boxShadow:
                                  "0 0 32px rgba(34, 211, 238, 0.6), 0 0 64px rgba(34, 211, 238, 0.35)",
                              },
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: "1.125rem",
                                fontWeight: 800,
                                color: "#fff",
                              }}
                            >
                              {item.step}
                            </Typography>
                          </Box>

                          {/* Card */}
                          <Box
                            sx={{
                              p: 3,
                              borderRadius: 3,
                              background: "rgba(255, 255, 255, 0.85)",
                              border: "1px solid rgba(148, 163, 184, 0.25)",
                              height: "100%",
                              width: "100%",
                              boxShadow: "0 8px 32px rgba(2, 6, 23, 0.06)",
                              transition:
                                "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                              "&:hover": {
                                background: "rgba(255, 255, 255, 0.95)",
                                borderColor: "rgba(34, 211, 238, 0.45)",
                                transform: "translateY(-4px)",
                                boxShadow:
                                  "0 12px 40px rgba(2, 6, 23, 0.10), 0 0 24px rgba(34, 211, 238, 0.15)",
                              },
                            }}
                          >
                            <Typography
                              component="h4"
                              sx={{
                                fontSize: "1rem",
                                fontWeight: 700,
                                color: "#0F172A",
                                mb: 1.5,
                              }}
                            >
                              {item.title}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: "0.875rem",
                                color: "#475569",
                                lineHeight: 1.6,
                                mb: item.chips ? 2 : 0,
                              }}
                            >
                              {item.text}
                            </Typography>

                            {/* Chips for step 3 */}
                            {item.chips && (
                              <Stack
                                direction="row"
                                spacing={0.75}
                                flexWrap="wrap"
                                justifyContent="center"
                                sx={{ gap: 0.75 }}
                              >
                                {item.chips.map((chip) => (
                                  <Box
                                    key={chip}
                                    sx={{
                                      px: 1.5,
                                      py: 0.5,
                                      borderRadius: "999px",
                                      background: "rgba(34, 211, 238, 0.15)",
                                      border:
                                        "1px solid rgba(34, 211, 238, 0.40)",
                                      fontSize: "0.7rem",
                                      fontWeight: 600,
                                      color: "#0891B2",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.02em",
                                    }}
                                  >
                                    {chip}
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </Box>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                {/* Timeline - Mobile (vertical) */}
                <Box
                  sx={{
                    display: { xs: "block", md: "none" },
                    position: "relative",
                    pl: 4,
                  }}
                >
                  {/* Vertical connecting line with glow */}
                  <Box
                    sx={{
                      position: "absolute",
                      top: 24,
                      bottom: 24,
                      left: 11,
                      width: 2,
                      background:
                        "linear-gradient(180deg, rgba(34, 211, 238, 0.5), rgba(34, 211, 238, 0.2))",
                      zIndex: 0,
                      boxShadow: "0 0 8px rgba(34, 211, 238, 0.25)",
                    }}
                  />

                  <Stack spacing={3}>
                    {[
                      {
                        step: 1,
                        title: "Escolha o que testar",
                        text: "Encontre um produto com sinais de oportunidade para começar com mais direção.",
                      },
                      {
                        step: 2,
                        title: "Transcreva o vídeo",
                        text: "Entenda a estrutura: gancho, prova, ritmo e chamada para ação.",
                      },
                      {
                        step: 3,
                        title: "Gere variações",
                        text: "Receba ideias de ângulos, ganchos e roteiros para modelar o criativo.",
                        chips: ["Gancho", "Prova", "Roteiro", "CTA"],
                      },
                      {
                        step: 4,
                        title: "Teste e aprenda",
                        text: "Publique versões, compare respostas e refine o que funciona.",
                      },
                    ].map((item) => (
                      <Box
                        key={item.step}
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        {/* Step dot */}
                        <Box
                          sx={{
                            position: "absolute",
                            left: -28,
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg, #22D3EE 0%, #0891B2 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 0 16px rgba(34, 211, 238, 0.45)",
                            flexShrink: 0,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              color: "#fff",
                            }}
                          >
                            {item.step}
                          </Typography>
                        </Box>

                        {/* Card */}
                        <Box
                          sx={{
                            p: 2.5,
                            borderRadius: 2.5,
                            background: "rgba(255, 255, 255, 0.85)",
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            width: "100%",
                            boxShadow: "0 4px 16px rgba(2, 6, 23, 0.06)",
                          }}
                        >
                          <Typography
                            component="h4"
                            sx={{
                              fontSize: "0.95rem",
                              fontWeight: 700,
                              color: "#0F172A",
                              mb: 1,
                            }}
                          >
                            {item.title}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "0.85rem",
                              color: "#475569",
                              lineHeight: 1.6,
                              mb: item.chips ? 2 : 0,
                            }}
                          >
                            {item.text}
                          </Typography>

                          {/* Chips for step 3 */}
                          {item.chips && (
                            <Stack
                              direction="row"
                              spacing={0.75}
                              flexWrap="wrap"
                              sx={{ gap: 0.75 }}
                            >
                              {item.chips.map((chip) => (
                                <Box
                                  key={chip}
                                  sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: "999px",
                                    background: "rgba(34, 211, 238, 0.15)",
                                    border:
                                      "1px solid rgba(34, 211, 238, 0.40)",
                                    fontSize: "0.65rem",
                                    fontWeight: 600,
                                    color: "#0891B2",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.02em",
                                  }}
                                >
                                  {chip}
                                </Box>
                              ))}
                            </Stack>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Reveal>

            {/* ===== E) CTA FINAL ===== */}
            <Reveal delay={50}>
              <Box
                sx={{
                  mt: { xs: 12, md: 16 },
                  p: { xs: 4, md: 6 },
                  borderRadius: 4,
                  background: `
                    radial-gradient(ellipse 420px 320px at 8% 50%, rgba(45, 212, 255, 0.12) 0%, transparent 70%),
                    linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(247, 251, 255, 0.92) 100%)
                  `,
                  border: "1px solid rgba(45, 212, 255, 0.22)",
                  boxShadow:
                    "0 4px 24px rgba(6, 8, 15, 0.06), 0 1px 3px rgba(6, 8, 15, 0.04)",
                  textAlign: "center",
                }}
              >
                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: "1.5rem", md: "1.75rem" },
                    fontWeight: 700,
                    color: "#06080F",
                    mb: 1.5,
                  }}
                >
                  Pronto para encontrar oportunidades antes do mercado?
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: "0.95rem", md: "1rem" },
                    color: "rgba(6, 8, 15, 0.62)",
                    maxWidth: 480,
                    mx: "auto",
                    mb: 4,
                  }}
                >
                  Acesse a Hyppado e comece a validar tendências com dados.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  sx={{
                    px: 5,
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
            </Reveal>
          </Container>
        </SectionShell>

        {/* ==================== PARA QUEM É SECTION ==================== */}
        <SectionShell id="para-quem-e" variant="who" tone="dark">
          <Container maxWidth="lg">
            <Reveal>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: "1.75rem", sm: "2rem", md: "2.5rem" },
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                  color: "#fff",
                  textAlign: "center",
                  mb: 2,
                }}
              >
                Para quem é a Hyppado
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.125rem" },
                  color: "#A0B0C0",
                  textAlign: "center",
                  maxWidth: 640,
                  mx: "auto",
                  mb: 6,
                }}
              >
                Para criadores e afiliados que querem decidir o que testar e
                acelerar a criação de criativos com clareza.
              </Typography>
            </Reveal>

            {/* Two Column Cards */}
            <Reveal delay={100}>
              <Grid container spacing={3} sx={{ mb: 5 }}>
                {/* Left Card - Ideal para você se... */}
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      p: { xs: 3, md: 4 },
                      borderRadius: 4,
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(120, 90, 255, 0.10)",
                      height: "100%",
                      transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow:
                        "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        borderColor: "rgba(120, 90, 255, 0.25)",
                        boxShadow:
                          "0 12px 36px rgba(0,0,0,0.25), 0 0 24px rgba(120, 90, 255, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                      },
                    }}
                  >
                    <Typography
                      component="h3"
                      sx={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "#9B7AFF",
                        mb: 3,
                      }}
                    >
                      Ideal para você se...
                    </Typography>
                    <Stack spacing={2}>
                      {[
                        "Você quer escolher produtos com mais chance de performar",
                        "Você precisa de um processo simples para testar ideias com consistência",
                        "Você quer transformar vídeos em insights práticos (sem adivinhação)",
                        "Você quer produzir criativos mais rápido, sem perder qualidade",
                      ].map((item, index) => (
                        <Stack
                          key={index}
                          direction="row"
                          spacing={1.5}
                          alignItems="flex-start"
                        >
                          <CheckCircleOutline
                            sx={{
                              fontSize: 18,
                              color: "#9B7AFF",
                              mt: 0.25,
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            sx={{
                              fontSize: "0.95rem",
                              color: "#C0D0E0",
                              lineHeight: 1.6,
                            }}
                          >
                            {item}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Grid>

                {/* Right Card - Você ganha com... */}
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      p: { xs: 3, md: 4 },
                      borderRadius: 4,
                      background:
                        "linear-gradient(135deg, rgba(120, 90, 255, 0.10) 0%, rgba(57, 213, 255, 0.04) 50%, rgba(13, 21, 32, 0.65) 100%)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(120, 90, 255, 0.20)",
                      height: "100%",
                      transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow:
                        "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(120, 90, 255, 0.08)",
                      position: "relative",
                      overflow: "hidden",
                      // Top glow line
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        top: 0,
                        left: "15%",
                        right: "15%",
                        height: "1px",
                        background:
                          "linear-gradient(90deg, transparent 0%, rgba(120, 90, 255, 0.4) 50%, transparent 100%)",
                        boxShadow: "0 0 8px 1px rgba(120, 90, 255, 0.2)",
                      },
                      "&:hover": {
                        transform: "translateY(-4px)",
                        borderColor: "rgba(120, 90, 255, 0.35)",
                        boxShadow:
                          "0 12px 36px rgba(0,0,0,0.25), 0 0 40px rgba(120, 90, 255, 0.12), inset 0 1px 0 rgba(120, 90, 255, 0.12)",
                      },
                    }}
                  >
                    <Typography
                      component="h3"
                      sx={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "#fff",
                        mb: 3,
                      }}
                    >
                      Você ganha com...
                    </Typography>
                    <Stack spacing={2}>
                      {[
                        "Transcrição do vídeo para entender o que prende atenção",
                        "Sugestões de ângulos e roteiros para modelar o criativo",
                        "Estrutura pronta para testar variações (gancho, prova, CTA)",
                        "Mais velocidade para publicar e aprender com os testes",
                      ].map((item, index) => (
                        <Stack
                          key={index}
                          direction="row"
                          spacing={1.5}
                          alignItems="flex-start"
                        >
                          <CheckCircleOutline
                            sx={{
                              fontSize: 18,
                              color: "#39D5FF",
                              mt: 0.25,
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            sx={{
                              fontSize: "0.95rem",
                              color: "#C0D0E0",
                              lineHeight: 1.6,
                            }}
                          >
                            {item}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </Reveal>

            {/* Banner ilustrativo - Placeholder para futura ilustração */}
            {/* src="/sections/for-who-banner.png" quando disponível */}
            <Reveal delay={150}>
              <Box sx={{ my: { xs: 6, md: 8 } }}>
                <ImageSlot
                  // src="/sections/for-who-banner.png"
                  alt="Ilustração abstrata para criadores"
                  height={{ xs: 120, md: 160 }}
                  radius={20}
                  variant="banner"
                  icon={
                    <AutoAwesomeOutlined
                      sx={{ fontSize: 36, color: "#39D5FF" }}
                    />
                  }
                />
              </Box>
            </Reveal>

            {/* CTA Row */}
            <Reveal delay={200}>
              <Box sx={{ textAlign: "center" }}>
                <Typography
                  sx={{
                    fontSize: "0.9rem",
                    color: "#8595A5",
                    mb: 3,
                  }}
                >
                  Sem promessas mágicas. Só um processo mais inteligente para
                  testar.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  href="#planos"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("planos")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  sx={{
                    px: 4,
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
            </Reveal>
          </Container>
        </SectionShell>

        {/* ==================== PLANOS SECTION ==================== */}
        <SectionShell id="planos" variant="pricing" allowOverflow tone="light">
          <Container maxWidth="lg">
            <Reveal>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: "1.75rem", sm: "2rem", md: "2.5rem" },
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                  color: "var(--section-text, #fff)",
                  textAlign: "center",
                  mb: 2,
                }}
              >
                Planos
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.125rem" },
                  color: "var(--section-muted, #A0B0C0)",
                  textAlign: "center",
                  maxWidth: 600,
                  mx: "auto",
                  mb: 8,
                }}
              >
                Escolha o plano ideal para organizar ideias, transcrever vídeos
                e modelar criativos com mais direção.
              </Typography>
            </Reveal>

            {/* Trust badge - Placeholder para ícone de segurança */}
            {/* src="/sections/plans-trust-badge.png" quando disponível */}
            <Reveal delay={80}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  mb: { xs: 4, md: 6 },
                }}
              >
                <ImageSlot
                  // src="/sections/plans-trust-badge.png"
                  alt="Pagamento seguro"
                  height={48}
                  width={180}
                  radius={8}
                  variant="badge"
                  icon={
                    <CheckCircleOutline
                      sx={{ fontSize: 24, color: "#39D5FF" }}
                    />
                  }
                />
              </Box>
            </Reveal>

            <Reveal delay={100}>
              <Grid
                container
                spacing={3}
                justifyContent="center"
                sx={{ overflow: "visible" }}
              >
                {plans.map((plan) => (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={5}
                    key={plan.id}
                    sx={{ overflow: "visible" }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        overflow: "visible",
                        p: { xs: 3, md: 4 },
                        pt: plan.badge ? { xs: 5, md: 6 } : { xs: 3, md: 4 },
                        borderRadius: 4,
                        background: plan.highlight
                          ? "linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)"
                          : "rgba(255, 255, 255, 0.85)",
                        backdropFilter: "blur(12px)",
                        border: plan.highlight
                          ? "2px solid rgba(34, 211, 238, 0.45)"
                          : "1px solid rgba(148, 163, 184, 0.25)",
                        boxShadow: plan.highlight
                          ? `
                            0 0 60px rgba(34, 211, 238, 0.15),
                            0 12px 40px rgba(2, 6, 23, 0.12),
                            inset 0 1px 0 rgba(255, 255, 255, 0.8)
                          `
                          : "0 12px 40px rgba(2, 6, 23, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                        // Top glow line for highlighted
                        "&::before": plan.highlight
                          ? {
                              content: '""',
                              position: "absolute",
                              top: 0,
                              left: "10%",
                              right: "10%",
                              height: "2px",
                              background:
                                "linear-gradient(90deg, transparent 0%, rgba(34, 211, 238, 0.8) 50%, transparent 100%)",
                              boxShadow: "0 0 16px 2px rgba(34, 211, 238, 0.4)",
                            }
                          : {},
                        // Bottom subtle glow
                        "&::after": plan.highlight
                          ? {
                              content: '""',
                              position: "absolute",
                              bottom: 0,
                              left: "20%",
                              right: "20%",
                              height: "1px",
                              background:
                                "linear-gradient(90deg, transparent 0%, rgba(34, 211, 238, 0.35) 50%, transparent 100%)",
                            }
                          : {},
                        "&:hover": {
                          transform: "translateY(-6px)",
                          borderColor: plan.highlight
                            ? "rgba(34, 211, 238, 0.65)"
                            : "rgba(34, 211, 238, 0.35)",
                          boxShadow: plan.highlight
                            ? `
                              0 0 80px rgba(34, 211, 238, 0.25),
                              0 16px 48px rgba(2, 6, 23, 0.15),
                              inset 0 1px 0 rgba(255, 255, 255, 0.9)
                            `
                            : "0 16px 48px rgba(2, 6, 23, 0.12), 0 0 24px rgba(34, 211, 238, 0.10)",
                        },
                      }}
                    >
                      {/* Badge */}
                      {plan.badge && (
                        <Chip
                          label={plan.badge}
                          size="small"
                          sx={{
                            position: "absolute",
                            top: -16,
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 30,
                            background:
                              "linear-gradient(135deg, #22D3EE 0%, #38BDF8 100%)",
                            color: "#0F172A",
                            fontWeight: 700,
                            fontSize: "0.7rem",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            px: 2,
                            height: 26,
                            borderRadius: "9999px",
                            boxShadow: "0 10px 30px rgba(34, 211, 238, 0.35)",
                          }}
                        />
                      )}

                      {/* Plan name */}
                      <Typography
                        component="h3"
                        sx={{
                          fontSize: "1.25rem",
                          fontWeight: 700,
                          color: "#0F172A",
                          mb: 1,
                          mt: plan.badge ? 1 : 0,
                        }}
                      >
                        {plan.name}
                      </Typography>

                      {/* Price */}
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          component="span"
                          sx={{
                            fontSize: { xs: "2rem", md: "2.5rem" },
                            fontWeight: 800,
                            color: plan.highlight ? "#0891B2" : "#0F172A",
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {plan.displayPrice}
                        </Typography>
                        <Typography
                          component="span"
                          sx={{
                            fontSize: "0.95rem",
                            color: "#64748B",
                            ml: 0.5,
                          }}
                        >
                          /{plan.period}
                        </Typography>
                      </Box>

                      {/* Description */}
                      <Typography
                        sx={{
                          fontSize: "0.9rem",
                          color: "#475569",
                          mb: 3,
                          lineHeight: 1.5,
                        }}
                      >
                        {plan.description}
                      </Typography>

                      {/* Features */}
                      <Stack spacing={1.5} sx={{ mb: 4, flexGrow: 1 }}>
                        {plan.features.map((feature, index) => (
                          <Stack
                            key={index}
                            direction="row"
                            spacing={1.5}
                            alignItems="flex-start"
                          >
                            <CheckCircleOutline
                              sx={{
                                fontSize: 18,
                                color: plan.highlight ? "#0891B2" : "#22D3EE",
                                mt: 0.25,
                                flexShrink: 0,
                              }}
                            />
                            <Typography
                              sx={{
                                fontSize: "0.875rem",
                                color: "#334155",
                                lineHeight: 1.5,
                              }}
                            >
                              {feature}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>

                      {/* CTA Button */}
                      <Button
                        variant={plan.highlight ? "contained" : "outlined"}
                        fullWidth
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          // Placeholder for checkout or signup flow
                        }}
                        sx={{
                          py: 1.5,
                          fontSize: "0.95rem",
                          fontWeight: 600,
                          borderRadius: "999px",
                          textTransform: "none",
                          ...(plan.highlight
                            ? {
                                background: "#39D5FF",
                                color: "#070B12",
                                boxShadow:
                                  "0 0 20px rgba(57, 213, 255, 0.35), 0 4px 12px rgba(0,0,0,0.2)",
                                "&:hover": {
                                  background: "#5BE0FF",
                                  boxShadow:
                                    "0 0 28px rgba(57, 213, 255, 0.5), 0 6px 16px rgba(0,0,0,0.25)",
                                },
                              }
                            : {
                                borderColor: "rgba(57, 213, 255, 0.3)",
                                color: "#39D5FF",
                                "&:hover": {
                                  borderColor: "rgba(57, 213, 255, 0.6)",
                                  background: "rgba(57, 213, 255, 0.08)",
                                },
                              }),
                        }}
                      >
                        Quero acesso agora
                      </Button>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Reveal>
          </Container>
        </SectionShell>

        {/* ==================== FAQ SECTION ==================== */}
        <SectionShell id="faq" variant="faq" noDivider tone="dark">
          <Container maxWidth="lg">
            <Reveal>
              <Grid
                container
                spacing={{ xs: 4, md: 8 }}
                alignItems="flex-start"
              >
                {/* Left Column - Title and supporting text */}
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      position: { md: "sticky" },
                      top: { md: 120 },
                    }}
                  >
                    <Typography
                      component="h2"
                      sx={{
                        fontSize: { xs: "1.75rem", sm: "2rem", md: "2.25rem" },
                        fontWeight: 800,
                        lineHeight: 1.15,
                        letterSpacing: "-0.02em",
                        color: "#fff",
                        mb: 2,
                      }}
                    >
                      Perguntas frequentes
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: "1rem", md: "1.05rem" },
                        color: "#A0B0C0",
                        lineHeight: 1.6,
                        mb: 3,
                      }}
                    >
                      Respostas diretas para você entender a Hyppado e decidir
                      com segurança.
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        color: "#6A7A8A",
                        mb: 3,
                      }}
                    >
                      Ainda com dúvidas? Fale com a gente.
                    </Typography>
                    <Button
                      variant="contained"
                      size="medium"
                      href="#planos"
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById("planos")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      sx={{
                        px: 3,
                        py: 1.25,
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        borderRadius: "999px",
                        background: "#39D5FF",
                        color: "#070B12",
                        textTransform: "none",
                        boxShadow:
                          "0 0 20px rgba(57, 213, 255, 0.35), 0 4px 12px rgba(0,0,0,0.2)",
                        transition: "all 0.25s ease",
                        "&:hover": {
                          background: "#5BE0FF",
                          boxShadow:
                            "0 0 28px rgba(57, 213, 255, 0.5), 0 6px 16px rgba(0,0,0,0.25)",
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      Fale com nosso suporte
                    </Button>

                    {/* Ilustração abstrata - visível apenas em md+ */}
                    {/* src="/sections/faq-abstract.png" quando disponível */}
                    <Box
                      sx={{
                        display: { xs: "none", md: "block" },
                        mt: 4,
                      }}
                    >
                      <ImageSlot
                        // src="/sections/faq-abstract.png"
                        alt="Ilustração abstrata"
                        height={200}
                        radius={16}
                        variant="rounded"
                        icon={
                          <AutoAwesome
                            sx={{ fontSize: 32, color: "#39D5FF" }}
                          />
                        }
                      />
                    </Box>
                  </Box>
                </Grid>

                {/* Right Column - Accordions */}
                <Grid item xs={12} md={8}>
                  <Stack spacing={2}>
                    {[
                      {
                        question: "O que é a Hyppado?",
                        answer:
                          "Uma plataforma para descobrir oportunidades e acelerar a criação de criativos. Você pode transcrever vídeos e gerar prompts para modelar variações do criativo com mais direção.",
                      },
                      {
                        question: "Para quem é?",
                        answer:
                          "Para criadores e afiliados que querem decidir o que testar e produzir com consistência, sem depender de 'achismo'.",
                      },
                      {
                        question: "A Hyppado serve para quem está começando?",
                        answer:
                          "Sim. Você consegue partir de exemplos, entender a estrutura do vídeo e usar prompts para guiar seu primeiro roteiro e suas variações.",
                      },
                      {
                        question: "O que eu recebo no plano?",
                        answer:
                          "Acesso aos recursos do seu plano, incluindo descoberta de produtos e vídeos, transcrição de vídeo e prompts para modelagem do criativo. Os detalhes exatos ficam descritos em cada plano.",
                      },
                      {
                        question: "Eu preciso instalar alguma coisa?",
                        answer:
                          "Não. É uma plataforma web: você acessa pelo navegador e organiza seu processo por lá.",
                      },
                      {
                        question: "Posso cancelar quando quiser?",
                        answer:
                          "Sim. Você pode cancelar quando quiser. Assim que o cancelamento for confirmado, você mantém acesso até o fim do período contratado.",
                      },
                    ].map((faq, index) => (
                      <Accordion
                        key={index}
                        disableGutters
                        elevation={0}
                        sx={{
                          background: "rgba(13, 21, 32, 0.5)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                          borderRadius: "12px !important",
                          overflow: "hidden",
                          "&:before": {
                            display: "none",
                          },
                          "&.Mui-expanded": {
                            borderColor: "rgba(57, 213, 255, 0.2)",
                            margin: 0,
                          },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={
                            <ExpandMoreIcon sx={{ color: "#39D5FF" }} />
                          }
                          sx={{
                            px: 3,
                            py: 1,
                            minHeight: 64,
                            "& .MuiAccordionSummary-content": {
                              my: 1.5,
                            },
                            "&:hover": {
                              background: "rgba(57, 213, 255, 0.04)",
                            },
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: "0.95rem",
                              fontWeight: 600,
                              color: "#fff",
                            }}
                          >
                            {faq.question}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails
                          sx={{
                            px: 3,
                            pb: 3,
                            pt: 0,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: "0.9rem",
                              color: "#A0B0C0",
                              lineHeight: 1.7,
                            }}
                          >
                            {faq.answer}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Reveal>
          </Container>
        </SectionShell>

        {/* ==================== FOOTER ==================== */}
        <Box
          component="footer"
          sx={{
            mt: "auto",
            pt: { xs: 6, md: 8 },
            pb: { xs: 4, md: 5 },
            background:
              "linear-gradient(180deg, rgba(7, 11, 18, 0) 0%, rgba(13, 21, 32, 0.5) 100%)",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <Container maxWidth="lg">
            {/* Footer Main Content - 3 Columns */}
            <Grid
              container
              spacing={{ xs: 4, md: 6 }}
              sx={{ mb: { xs: 4, md: 6 } }}
            >
              {/* Column 1 - Brand */}
              <Grid item xs={12} md={5}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{ mb: 2.5 }}
                >
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      background:
                        "linear-gradient(135deg, #39D5FF 0%, #0099CC 100%)",
                      borderRadius: "4px",
                      transform: "rotate(45deg)",
                      boxShadow: "0 0 10px rgba(57, 213, 255, 0.4)",
                    }}
                  />
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: "1.15rem",
                      color: "#fff",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Hyppado
                  </Typography>
                </Stack>
                <Typography
                  sx={{
                    fontSize: "0.875rem",
                    color: "#8595A5",
                    lineHeight: 1.7,
                    maxWidth: 360,
                  }}
                >
                  A Hyppado ajuda criadores e afiliados a escolher produtos e
                  entender criativos com mais clareza, usando transcrição e
                  sugestões de prompt para modelagem.
                </Typography>
              </Grid>

              {/* Column 2 - Quick Access */}
              <Grid item xs={6} md={3}>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#fff",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    mb: 2.5,
                  }}
                >
                  Acesso Rápido
                </Typography>
                <Stack spacing={1.5}>
                  {[
                    { label: "Início", href: "#inicio" },
                    { label: "Como funciona", href: "#como-funciona" },
                    { label: "Para quem é", href: "#para-quem-e" },
                    { label: "Planos", href: "#planos" },
                    { label: "FAQ", href: "#faq" },
                    { label: "Suporte", href: "mailto:suporte@hyppado.com" },
                  ].map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      underline="none"
                      onClick={(e) => {
                        if (link.href.startsWith("#")) {
                          e.preventDefault();
                          const id = link.href.slice(1);
                          document.getElementById(id)?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }
                      }}
                      sx={{
                        fontSize: "0.875rem",
                        color: "#9AA8B8",
                        transition: "color 0.2s ease",
                        "&:hover": {
                          color: "#39D5FF",
                        },
                      }}
                    >
                      {link.label}
                    </Link>
                  ))}
                </Stack>
              </Grid>

              {/* Column 3 - Legal */}
              <Grid item xs={6} md={4}>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#fff",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    mb: 2.5,
                  }}
                >
                  Legal
                </Typography>
                <Stack spacing={1.5}>
                  <Link
                    href="#"
                    underline="none"
                    sx={{
                      fontSize: "0.875rem",
                      color: "#9AA8B8",
                      transition: "color 0.2s ease",
                      "&:hover": {
                        color: "#39D5FF",
                      },
                    }}
                  >
                    Termos de Uso
                  </Link>
                  <Link
                    href="#"
                    underline="none"
                    sx={{
                      fontSize: "0.875rem",
                      color: "#9AA8B8",
                      transition: "color 0.2s ease",
                      "&:hover": {
                        color: "#39D5FF",
                      },
                    }}
                  >
                    Política de Privacidade
                  </Link>
                </Stack>
              </Grid>
            </Grid>

            {/* Divider */}
            <Divider
              sx={{
                borderColor: "rgba(255, 255, 255, 0.06)",
                mb: { xs: 3, md: 4 },
              }}
            />

            {/* Bottom Row - Copyright & Social */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "center", sm: "center" }}
              spacing={2}
            >
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  color: "#6A7A8A",
                }}
              >
                © Hyppado 2026. Todos os direitos reservados.
              </Typography>

              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    color: "#6A7A8A",
                    display: { xs: "none", sm: "block" },
                  }}
                >
                  Siga-nos nas redes sociais:
                </Typography>
                <IconButton
                  aria-label="Instagram da Hyppado"
                  href="https://instagram.com/hyppado"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: "#9AA8B8",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      color: "#39D5FF",
                      background: "rgba(57, 213, 255, 0.1)",
                    },
                  }}
                >
                  <InstagramIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Container>
        </Box>

        {/* Scroll Arrows */}
        <ScrollArrows />
      </Box>
    </ThemeProvider>
  );
}
