"use client";

import { Box, Container, Grid, Stack, Typography, Button } from "@mui/material";
import { CheckCircleOutline } from "@mui/icons-material";
import { SectionShell } from "./SectionShell";
import { Reveal } from "./Reveal";

export function ForWhoSection() {
  return (
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

        {/* Two column cards */}
        <Reveal delay={100}>
          <Grid container spacing={3} sx={{ mb: 5 }}>
            {/* Left - Ideal for */}
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

            {/* Right - You gain */}
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

        {/* CTA */}
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
  );
}
