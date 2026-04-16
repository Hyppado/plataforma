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
   PLANS HOOK — dynamic from DB, no hardcoded fallback
============================================ */
function usePlans(): PlanDisplay[] | null {
  const [plans, setPlans] = useState<PlanDisplay[] | null>(null);
  useEffect(() => {
    fetchPlans().then((p) => setPlans(p));
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
        <PricingSection plans={plans ?? []} />
        <FaqSection />
        <LandingFooter />
        <ScrollArrows />
      </Box>
    </ThemeProvider>
  );
}
