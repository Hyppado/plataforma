"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  Button,
  Grid,
  Stack,
} from "@mui/material";
import { WhatsApp, EmailOutlined } from "@mui/icons-material";

const DEFAULT_SUPPORT_EMAIL = "suporte@hyppado.com";

// ============================================
// Design Tokens
// ============================================

const UI = {
  card: {
    bg: "rgba(10,15,24,0.6)",
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(45,212,255,0.12)",
    radius: 3,
  },
  text: {
    primary: "rgba(255,255,255,0.90)",
    secondary: "rgba(255,255,255,0.65)",
    hint: "rgba(255,255,255,0.45)",
  },
  accent: "#2DD4FF",
  success: "#4CAF50",
};

// ============================================
// Main Component
// ============================================

export default function SuportePage() {
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/support-email")
      .then((r) => r.json())
      .then((d) => {
        if (d.email) setSupportEmail(d.email);
        if (d.whatsapp) setWhatsapp(d.whatsapp);
        if (d.whatsappUrl) setWhatsappUrl(d.whatsappUrl);
      })
      .catch(() => {
        // keep default
      });
  }, []);

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: "1.5rem", md: "1.75rem" },
            fontWeight: 700,
            color: UI.text.primary,
            mb: 0.5,
          }}
        >
          Suporte
        </Typography>
        <Typography
          sx={{
            fontSize: "0.875rem",
            color: UI.text.secondary,
          }}
        >
          Entre em contato com nossa equipe.
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              borderRadius: UI.card.radius,
              background: UI.card.bg,
              border: `1px solid ${UI.card.border}`,
              p: { xs: 2, md: 3 },
              height: "100%",
            }}
          >
            <Typography
              sx={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: UI.text.primary,
                mb: 2,
              }}
            >
              Canais de Contato
            </Typography>

            <Stack spacing={2}>
              {/* Email */}
              <Button
                component="a"
                href={`mailto:${supportEmail}`}
                variant="outlined"
                fullWidth
                startIcon={<EmailOutlined />}
                sx={{
                  justifyContent: "flex-start",
                  textTransform: "none",
                  borderColor: UI.card.border,
                  color: UI.text.primary,
                  py: 1.5,
                  "&:hover": {
                    borderColor: UI.accent,
                    backgroundColor: "rgba(45,212,255,0.05)",
                  },
                }}
              >
                <Box sx={{ textAlign: "left", flex: 1 }}>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Email
                  </Typography>
                  <Typography
                    sx={{ fontSize: "0.75rem", color: UI.text.secondary }}
                  >
                    {supportEmail}
                  </Typography>
                </Box>
              </Button>

              {/* WhatsApp — só quando há número configurado. Botão que leva a
                  uma conversa inexistente é pior do que botão ausente. */}
              {whatsappUrl && (
                <Button
                  component="a"
                  href={`${whatsappUrl}?text=${encodeURIComponent("Olá! Preciso de ajuda com a Hyppado.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  fullWidth
                  startIcon={<WhatsApp />}
                  sx={{
                    justifyContent: "flex-start",
                    textTransform: "none",
                    borderColor: "rgba(37,211,102,0.35)",
                    color: UI.text.primary,
                    py: 1.5,
                    "&:hover": {
                      borderColor: "#25D366",
                      backgroundColor: "rgba(37,211,102,0.06)",
                    },
                  }}
                >
                  <Box sx={{ textAlign: "left", flex: 1 }}>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      WhatsApp
                    </Typography>
                    <Typography
                      sx={{ fontSize: "0.75rem", color: UI.text.secondary }}
                    >
                      {whatsapp}
                    </Typography>
                  </Box>
                </Button>
              )}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

