"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  CircularProgress,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { Email, ArrowBack } from "@mui/icons-material";
import { Logo } from "@/app/components/ui/Logo";
import { appTheme } from "@/app/theme";

const DEFAULT_EMAIL = "suporte@hyppado.com";

export default function SuportePage() {
  const [supportEmail, setSupportEmail] = useState(DEFAULT_EMAIL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/support-email")
      .then((r) => r.json())
      .then((d) => {
        if (d.email) setSupportEmail(d.email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <ThemeProvider theme={appTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0A0F18 0%, #121A2B 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
          px: 2,
        }}
      >
        <Container maxWidth="sm">
          {/* Logo */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: 4,
            }}
          >
            <Logo responsiveHeight={{ xs: 80, sm: 100 }} />
          </Box>

          {/* Support Card */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 3,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(45, 212, 255, 0.1)",
              textAlign: "center",
            }}
          >
            <Email
              sx={{
                fontSize: 48,
                color: "#2DD4FF",
                mb: 2,
              }}
            />

            <Typography
              variant="h5"
              sx={{
                color: "#fff",
                fontWeight: 600,
                mb: 1,
              }}
            >
              Precisa de ajuda?
            </Typography>

            <Typography
              sx={{
                color: "rgba(255,255,255,0.6)",
                mb: 3,
                fontSize: "0.95rem",
              }}
            >
              Entre em contato com nosso suporte e responderemos o mais rápido
              possível.
            </Typography>

            {loading ? (
              <CircularProgress size={24} sx={{ color: "#2DD4FF" }} />
            ) : (
              <>
                <Typography
                  sx={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "0.85rem",
                    mb: 1,
                  }}
                >
                  E-mail de suporte:
                </Typography>

                <Typography
                  sx={{
                    color: "#2DD4FF",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    mb: 3,
                    wordBreak: "break-all",
                  }}
                >
                  {supportEmail}
                </Typography>

                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Email />}
                  href={`mailto:${supportEmail}`}
                  sx={{
                    background:
                      "linear-gradient(135deg, #2DD4FF 0%, #00B8E6 100%)",
                    color: "#0A0F18",
                    fontWeight: 600,
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: "none",
                    fontSize: "1rem",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #6BE0FF 0%, #2DD4FF 100%)",
                    },
                  }}
                >
                  Enviar e-mail
                </Button>
              </>
            )}
          </Paper>

          {/* Back to login */}
          <Box sx={{ textAlign: "center", mt: 3 }}>
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "rgba(255,255,255,0.6)",
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              <ArrowBack sx={{ fontSize: 18 }} />
              Voltar para o login
            </Link>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
