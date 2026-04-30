"use client";

import { Box, Container, Grid, Stack, Typography, Button } from "@mui/material";
import { CheckCircleOutline, CancelOutlined } from "@mui/icons-material";
import { SectionShell } from "./SectionShell";
import { Reveal } from "./Reveal";

export function ForWhoSection() {
  return (
    <SectionShell id="para-quem-e" variant="who" tone="dark">
      <Container maxWidth="lg">
        <Reveal>
          <Box sx={{ textAlign: "center", mb: 8 }}>
            <Typography
              sx={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "primary.main",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 2,
              }}
            >
              PARA QUEM É
            </Typography>
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.75rem" },
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: "#fff",
                mb: 2,
              }}
            >
              Para criadores e afiliados que querem{" "}
              <Box component="span" sx={{ color: "primary.main" }}>
                resultados reais
              </Box>
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "1rem", md: "1.1rem" },
                color: "rgba(255,255,255,0.5)",
                maxWidth: 540,
                mx: "auto",
                lineHeight: 1.65,
              }}
            >
              Sem adivinhação, sem desperdício de tempo. Dados reais + IA para quem quer escalar no TikTok Shop.
            </Typography>
          </Box>
        </Reveal>

        <Reveal delay={100}>
          <Grid container spacing={3} sx={{ mb: 6 }}>
            {/* Ideal for */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: 4,
                  background: "rgba(45,212,255,0.04)",
                  border: "1px solid rgba(45,212,255,0.12)",
                  height: "100%",
                  transition: "border-color 200ms",
                  "&:hover": { borderColor: "rgba(45,212,255,0.28)" },
                }}
              >
                <Typography
                  component="h3"
                  sx={{ fontSize: "1.05rem", fontWeight: 700, color: "primary.main", mb: 3 }}
                >
                  Hyppado é para você se…
                </Typography>
                <Stack spacing={2}>
                  {[
                    "Quer descobrir produtos em alta antes de saturar",
                    "Precisa criar vídeos rápido sem começar do zero",
                    "Quer um avatar IA para gerar referências visuais",
                    "Busca um fluxo completo: dado → imagem → vídeo",
                    "Quer escalar no TikTok Shop com mais eficiência",
                  ].map((item) => (
                    <Stack key={item} direction="row" spacing={1.5} alignItems="flex-start">
                      <CheckCircleOutline sx={{ fontSize: 18, color: "primary.main", mt: 0.2, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>
                        {item}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>

            {/* Not for */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  height: "100%",
                  transition: "border-color 200ms",
                  "&:hover": { borderColor: "rgba(255,255,255,0.14)" },
                }}
              >
                <Typography
                  component="h3"
                  sx={{ fontSize: "1.05rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", mb: 3 }}
                >
                  Não é para você se…
                </Typography>
                <Stack spacing={2}>
                  {[
                    "Quer uma fórmula mágica sem esforço",
                    "Não está disposto a testar e iterar",
                    "Busca resultado sem produzir conteúdo",
                    "Quer apenas salvar vídeos sem analisar",
                    "Prefere criar no improviso sem dados",
                  ].map((item) => (
                    <Stack key={item} direction="row" spacing={1.5} alignItems="flex-start">
                      <CancelOutlined sx={{ fontSize: 18, color: "rgba(255,255,255,0.2)", mt: 0.2, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.55 }}>
                        {item}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Reveal>

        <Reveal delay={150}>
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.35)", mb: 3 }}>
              Processo inteligente. Resultados reais.
            </Typography>
            <Button
              variant="contained"
              size="large"
              href="#planos"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("planos")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              sx={{
                px: 5,
                py: 1.5,
                fontSize: "0.95rem",
                fontWeight: 700,
                borderRadius: "999px",
                bgcolor: "primary.main",
                color: "#070B12",
                textTransform: "none",
                boxShadow: "0 0 28px rgba(45,212,255,0.35), 0 4px 16px rgba(0,0,0,0.3)",
                transition: "all 0.22s ease",
                "&:hover": {
                  bgcolor: "primary.light",
                  boxShadow: "0 0 40px rgba(45,212,255,0.5), 0 6px 20px rgba(0,0,0,0.35)",
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
