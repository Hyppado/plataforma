import { Box, Container, Grid, Stack, Typography, Button } from "@mui/material";
import { AutoAwesome } from "@mui/icons-material";
import { SectionShell } from "./SectionShell";
import { Reveal } from "./Reveal";
import { ImageSlot } from "./ImageSlot";

export function HowItWorksSection() {
  return (
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

        {/* Step by step */}
        <Reveal delay={100}>
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
            ].map((item) => (
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

        {/* Dashboard preview placeholder */}
        <Reveal delay={150}>
          <Box sx={{ mt: { xs: 6, md: 8 }, mx: "auto", maxWidth: 900 }}>
            <ImageSlot
              alt="Preview do dashboard Hyppado"
              height={{ xs: 200, md: 320 }}
              radius={16}
              variant="card"
              icon={<AutoAwesome sx={{ fontSize: 48, color: "#39D5FF" }} />}
            />
          </Box>
        </Reveal>

        {/* What you receive */}
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
                  description: "Isole oportunidades por categoria e público.",
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

        {/* From data to action */}
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

        {/* Creative modeling */}
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

            {/* Desktop timeline */}
            <Box
              sx={{
                display: { xs: "none", md: "block" },
                position: "relative",
              }}
            >
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

                      <Box
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          background: "rgba(255, 255, 255, 0.85)",
                          border: "1px solid rgba(148, 163, 184, 0.25)",
                          height: "100%",
                          width: "100%",
                          boxShadow: "0 8px 32px rgba(2, 6, 23, 0.06)",
                          transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
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
                                  border: "1px solid rgba(34, 211, 238, 0.40)",
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

            {/* Mobile timeline */}
            <Box
              sx={{
                display: { xs: "block", md: "none" },
                position: "relative",
                pl: 4,
              }}
            >
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
                                border: "1px solid rgba(34, 211, 238, 0.40)",
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

        {/* Final CTA */}
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
  );
}
