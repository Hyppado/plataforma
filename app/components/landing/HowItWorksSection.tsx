import { Box, Container, Grid, Typography, Button, Chip } from "@mui/material";
import {
  TrendingUp,
  FaceRetouchingNatural,
  AutoFixHigh,
  ImageSearch,
} from "@mui/icons-material";
import { SectionShell } from "./SectionShell";
import { Reveal } from "./Reveal";

const FEATURES = [
  {
    icon: TrendingUp,
    color: "#2DD4FF",
    colorAlpha: "rgba(45,212,255,0.12)",
    colorBorder: "rgba(45,212,255,0.25)",
    label: "Inteligência de Mercado",
    title: "Encontre o produto antes do mercado saturar",
    description:
      "Monitore produtos e vídeos em alta no TikTok Shop em tempo real. Filtre por região, categoria e período para descobrir oportunidades antes dos concorrentes.",
    chips: [
      "Ranking de produtos",
      "Vídeos virais",
      "Creators em alta",
      "Filtros avançados",
    ],
  },
  {
    icon: FaceRetouchingNatural,
    color: "#C7A3FF",
    colorAlpha: "rgba(199,163,255,0.1)",
    colorBorder: "rgba(199,163,255,0.22)",
    label: "Avatar Influenciador IA",
    title: "Crie vídeos com um avatar influenciador digital",
    description:
      "Selecione um avatar, escolha um cenário e gere prompts de vídeo completos com gancho, roteiro e chamada para ação — prontos para produção no Veo.",
    chips: [
      "Avatar digital",
      "Cenários customizados",
      "Prompt Veo",
      "Roteiro completo",
    ],
  },
  {
    icon: ImageSearch,
    color: "#FF2D78",
    colorAlpha: "rgba(255,45,120,0.1)",
    colorBorder: "rgba(255,45,120,0.22)",
    label: "Referência Visual com IA",
    title: "Gere imagens realistas do seu produto com o avatar",
    description:
      "Envie uma foto do produto e deixe a IA compor imagens com o avatar segurando ou usando o item — referência visual pronta para briefing ou criativo.",
    chips: [
      "Upload do produto",
      "Composição IA",
      "Referência visual",
      "Múltiplas variações",
    ],
  },
  {
    icon: AutoFixHigh,
    color: "#81C784",
    colorAlpha: "rgba(129,199,132,0.1)",
    colorBorder: "rgba(129,199,132,0.22)",
    label: "Criativo em Minutos",
    title: "Do dado ao vídeo sem sair da plataforma",
    description:
      "Valide o produto, transcreva vídeos de referência, gere o prompt, componha as imagens. Um fluxo completo de inteligência à criação sem trocar de ferramenta.",
    chips: [
      "Transcrição Whisper",
      "Análise de gancho",
      "Prompt gerado",
      "Fluxo completo",
    ],
  },
];

export function HowItWorksSection() {
  return (
    <SectionShell id="como-funciona" variant="how" tone="dark">
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
              O QUE VOCÊ FAZ AQUI
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
              Tudo que você precisa para{" "}
              <Box component="span" sx={{ color: "primary.main" }}>
                dominar o TikTok Shop
              </Box>
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "1rem", md: "1.1rem" },
                color: "rgba(255,255,255,0.5)",
                maxWidth: 520,
                mx: "auto",
                lineHeight: 1.65,
              }}
            >
              Da mineração de tendências à criação de criativos com IA — num
              único lugar.
            </Typography>
          </Box>
        </Reveal>

        <Grid container spacing={3}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <Grid item xs={12} md={6} key={f.label}>
                <Reveal delay={i * 80}>
                  <Box
                    sx={{
                      p: { xs: 3, md: 4 },
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      height: "100%",
                      transition: "border-color 200ms, background 200ms",
                      "&:hover": {
                        background: f.colorAlpha,
                        borderColor: f.colorBorder,
                      },
                    }}
                  >
                    {/* Icon + label */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        mb: 2.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2.5,
                          background: f.colorAlpha,
                          border: `1px solid ${f.colorBorder}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon sx={{ fontSize: 20, color: f.color }} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          color: f.color,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {f.label}
                      </Typography>
                    </Box>

                    <Typography
                      component="h3"
                      sx={{
                        fontSize: { xs: "1.05rem", md: "1.15rem" },
                        fontWeight: 700,
                        color: "#fff",
                        lineHeight: 1.3,
                        mb: 1.5,
                      }}
                    >
                      {f.title}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.9rem",
                        color: "rgba(255,255,255,0.5)",
                        lineHeight: 1.65,
                        mb: 2.5,
                      }}
                    >
                      {f.description}
                    </Typography>

                    {/* Chips */}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                      {f.chips.map((chip) => (
                        <Chip
                          key={chip}
                          label={chip}
                          size="small"
                          sx={{
                            bgcolor: f.colorAlpha,
                            border: `1px solid ${f.colorBorder}`,
                            color: f.color,
                            fontSize: "0.68rem",
                            fontWeight: 600,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Reveal>
              </Grid>
            );
          })}
        </Grid>

        {/* CTA */}
        <Reveal delay={100}>
          <Box sx={{ mt: { xs: 8, md: 10 }, textAlign: "center" }}>
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
                px: 5,
                py: 1.5,
                fontSize: "0.95rem",
                fontWeight: 700,
                borderRadius: "999px",
                bgcolor: "primary.main",
                color: "#070B12",
                textTransform: "none",
                boxShadow:
                  "0 0 28px rgba(45,212,255,0.35), 0 4px 16px rgba(0,0,0,0.3)",
                transition: "all 0.22s ease",
                "&:hover": {
                  bgcolor: "primary.light",
                  boxShadow:
                    "0 0 40px rgba(45,212,255,0.5), 0 6px 20px rgba(0,0,0,0.35)",
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
