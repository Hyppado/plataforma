"use client";

import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  Button,
  Chip,
} from "@mui/material";
import { CheckCircleOutline } from "@mui/icons-material";
import { type PlanDisplay } from "@/app/data/plans";
import { SectionShell } from "./SectionShell";
import { Reveal } from "./Reveal";
import { ImageSlot } from "./ImageSlot";

interface PricingSectionProps {
  plans: PlanDisplay[];
}

export function PricingSection({ plans }: PricingSectionProps) {
  return (
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
            Escolha o plano ideal para organizar ideias, transcrever vídeos e
            modelar criativos com mais direção.
          </Typography>
        </Reveal>

        {/* Trust badge */}
        <Reveal delay={80}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: { xs: 4, md: 6 },
            }}
          >
            <ImageSlot
              alt="Pagamento seguro"
              height={48}
              width={180}
              radius={8}
              variant="badge"
              icon={
                <CheckCircleOutline sx={{ fontSize: 24, color: "#39D5FF" }} />
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

                  {/* CTA */}
                  <Button
                    variant={plan.highlight ? "contained" : "outlined"}
                    fullWidth
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
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
  );
}
