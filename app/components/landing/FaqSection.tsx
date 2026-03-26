"use client";

import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon, AutoAwesome } from "@mui/icons-material";
import { SectionShell } from "./SectionShell";
import { Reveal } from "./Reveal";
import { ImageSlot } from "./ImageSlot";

const FAQ_ITEMS = [
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
];

export function FaqSection() {
  return (
    <SectionShell id="faq" variant="faq" noDivider tone="dark">
      <Container maxWidth="lg">
        <Reveal>
          <Grid container spacing={{ xs: 4, md: 8 }} alignItems="flex-start">
            {/* Left — Title and supporting text */}
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
                  Respostas diretas para você entender a Hyppado e decidir com
                  segurança.
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

                {/* Abstract illustration — md+ only */}
                <Box
                  sx={{
                    display: { xs: "none", md: "block" },
                    mt: 4,
                  }}
                >
                  <ImageSlot
                    alt="Ilustração abstrata"
                    height={200}
                    radius={16}
                    variant="rounded"
                    icon={
                      <AutoAwesome sx={{ fontSize: 32, color: "#39D5FF" }} />
                    }
                  />
                </Box>
              </Box>
            </Grid>

            {/* Right — Accordions */}
            <Grid item xs={12} md={8}>
              <Stack spacing={2}>
                {FAQ_ITEMS.map((faq, index) => (
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
                      expandIcon={<ExpandMoreIcon sx={{ color: "#39D5FF" }} />}
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
  );
}
