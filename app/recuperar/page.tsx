"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { CheckCircleOutline } from "@mui/icons-material";
import { Logo } from "@/app/components/ui/Logo";
import { appTheme } from "@/app/theme";

type PageState = "form" | "success";

export default function RecuperarPage() {
  const [state, setState] = useState<PageState>("form");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !trimmed.includes("@")) {
      setErrorMessage("Digite um email válido.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMessage(body.error ?? "Erro ao processar. Tente novamente.");
        return;
      }

      // Always show success — no user enumeration
      setState("success");
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }, [email]);

  return (
    <ThemeProvider theme={appTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          background: `
            radial-gradient(ellipse 600px 400px at 20% 20%, rgba(45, 212, 255, 0.08), transparent 60%),
            radial-gradient(ellipse 500px 350px at 80% 80%, rgba(45, 212, 255, 0.05), transparent 55%),
            linear-gradient(180deg, #06080F 0%, #0A0F18 100%)
          `,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
          px: 2,
        }}
      >
        <Container maxWidth="xs" sx={{ maxWidth: 420 }}>
          <Box
            sx={{
              p: { xs: 4, sm: 5 },
              borderRadius: 3,
              background:
                "linear-gradient(145deg, rgba(18,20,30,0.95) 0%, rgba(12,14,22,0.98) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {/* Logo */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
              <Logo size="md" />
            </Box>

            {/* Success state */}
            {state === "success" && (
              <Box sx={{ textAlign: "center", py: 2 }}>
                <CheckCircleOutline
                  sx={{ fontSize: 56, color: "#4caf50", mb: 2 }}
                />
                <Typography
                  variant="h6"
                  sx={{ color: "#fff", fontWeight: 600, mb: 1 }}
                >
                  Verifique seu email
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 1 }}
                >
                  Se o email informado estiver cadastrado, você receberá um link
                  para redefinir sua senha.
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "rgba(255,255,255,0.4)",
                    mb: 3,
                    fontSize: "0.8rem",
                  }}
                >
                  Verifique também a caixa de spam. O link expira em 1 hora.
                </Typography>
                <Button
                  component={Link}
                  href="/login"
                  variant="contained"
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: "primary.main",
                    color: "#0a0a0f",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    textTransform: "none",
                    borderRadius: 2,
                    "&:hover": { background: "primary.light" },
                  }}
                >
                  Voltar ao login
                </Button>
              </Box>
            )}

            {/* Form state */}
            {state === "form" && (
              <>
                <Typography
                  variant="h5"
                  sx={{
                    color: "#fff",
                    fontWeight: 700,
                    textAlign: "center",
                    mb: 1,
                  }}
                >
                  Recuperar senha
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "rgba(255,255,255,0.5)",
                    textAlign: "center",
                    mb: 3,
                  }}
                >
                  Informe seu email e enviaremos um link para redefinir sua
                  senha.
                </Typography>

                {errorMessage && (
                  <Alert
                    severity="error"
                    sx={{
                      mb: 2,
                      background: "rgba(244,67,54,0.08)",
                      color: "#ef5350",
                      "& .MuiAlert-icon": { color: "#ef5350" },
                    }}
                  >
                    {errorMessage}
                  </Alert>
                )}

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    fullWidth
                    autoFocus
                    autoComplete="email"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        color: "#fff",
                        "& fieldset": {
                          borderColor: "rgba(255,255,255,0.12)",
                        },
                        "&:hover fieldset": {
                          borderColor: "rgba(255,255,255,0.25)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "primary.main",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "rgba(255,255,255,0.4)",
                        "&.Mui-focused": { color: "primary.main" },
                      },
                    }}
                  />

                  <Button
                    onClick={handleSubmit}
                    variant="contained"
                    fullWidth
                    disabled={submitting}
                    sx={{
                      py: 1.5,
                      mt: 1,
                      background: "#2DD4FF",
                      color: "#0a0a0f",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      textTransform: "none",
                      borderRadius: 2,
                      "&:hover": { background: "#5BE0FF" },
                      "&.Mui-disabled": {
                        background: "rgba(45,212,255,0.3)",
                        color: "rgba(10,10,15,0.5)",
                      },
                    }}
                  >
                    {submitting ? (
                      <CircularProgress size={22} sx={{ color: "#0a0a0f" }} />
                    ) : (
                      "Enviar link de recuperação"
                    )}
                  </Button>
                </Box>

                <Box sx={{ mt: 3, textAlign: "center" }}>
                  <Typography
                    variant="body2"
                    component={Link}
                    href="/login"
                    sx={{
                      color: "rgba(255,255,255,0.4)",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    Voltar ao login
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
