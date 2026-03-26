"use client";

import { useState, useEffect } from "react";
import { Box, ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./theme";
import { type PlanDisplay, fetchPlans } from "./data/plans";
import {
  LandingNavbar,
  HeroSection,
  HowItWorksSection,
  ForWhoSection,
  PricingSection,
  FaqSection,
  LandingFooter,
  ScrollArrows,
} from "./components/landing";

/* ============================================
   PLANS FALLBACK + HOOK
============================================ */
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

/* ============================================
   HOME PAGE — Thin composition shell
============================================ */
export default function HomePage() {
  const plans = usePlans();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "#070B12",
          position: "relative",
        }}
      >
        <LandingNavbar />
        <HeroSection />
        <HowItWorksSection />
        <ForWhoSection />
        <PricingSection plans={plans} />
        <FaqSection />
        <LandingFooter />
        <ScrollArrows />
      </Box>
    </ThemeProvider>
  );
}
