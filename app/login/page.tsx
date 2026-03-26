"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Logo } from "@/app/components/ui/Logo";
import { appTheme } from "@/app/theme";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Email ou senha incorretos.");
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

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
          {/* Login Card */}
          <Box
            sx={{
              p: { xs: 4, sm: 5 },
              borderRadius: 3,
              background: "rgba(10, 15, 24, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(16px)",
            }}
          >
            {/* 1) Logo centralizado */}
            <Box
              sx={{
                textAlign: "center",
                pt: 0,
                mb: 2.5,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Logo
                href="/"
                mode="dark"
                size="lg"
                sx={{ height: 48 }}
                priority
              />
            </Box>

            {/* 2) Texto auxiliar */}
            <Typography
              sx={{
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.55)",
                textAlign: "center",
                mb: 4,
              }}
            >
              Acesse sua conta para continuar.
            </Typography>

            {/* 3) Campo Email */}
            <Box sx={{ mb: 2.5 }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Email
              </label>
              <TextField
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    height: 48,
                  },
                }}
              />
            </Box>

            {/* 4) Campo Senha */}
            <Box sx={{ mb: 1.5 }}>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Senha
              </label>
              <TextField
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        onClick={togglePasswordVisibility}
                        edge="end"
                        tabIndex={0}
                        sx={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    height: 48,
                  },
                }}
              />
            </Box>

            {/* 5) Link Esqueceu sua senha? alinhado à direita */}
            {error && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#ef4444",
                  fontSize: "0.8rem",
                  textAlign: "center",
                }}
              >
                {error}
              </Box>
            )}
            <Box sx={{ textAlign: "right", mb: 3 }}>
              <Link
                href="/recuperar"
                style={{
                  fontSize: "0.8rem",
                  color: "#2DD4FF",
                  textDecoration: "none",
                }}
              >
                Esqueceu sua senha?
              </Link>
            </Box>

            {/* 6) Botão primário Entrar */}
            <Button
              type="button"
              onClick={handleSubmit}
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                height: 48,
                fontSize: "0.95rem",
                fontWeight: 600,
                background: "#2DD4FF",
                color: "#06080F",
                boxShadow: "0 0 20px rgba(45, 212, 255, 0.25)",
                "&:hover": {
                  background: "#5BE0FF",
                  boxShadow: "0 0 28px rgba(45, 212, 255, 0.4)",
                },
                "&:disabled": {
                  background: "rgba(45, 212, 255, 0.35)",
                  color: "rgba(6, 8, 15, 0.7)",
                },
                "&:focus-visible": {
                  outline: "2px solid #2DD4FF",
                  outlineOffset: 2,
                },
              }}
            >
              {loading ? (
                <CircularProgress size={22} sx={{ color: "#06080F" }} />
              ) : (
                "Entrar"
              )}
            </Button>

            {/* 7) Não tem assinatura? Assinar */}
            <Typography
              sx={{
                mt: 4,
                textAlign: "center",
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              Não tem uma assinatura?{" "}
              <Link
                href="/cadastro"
                style={{
                  color: "#2DD4FF",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Assinar
              </Link>
            </Typography>

            {/* 8) Precisa de ajuda? Fale com nosso suporte */}
            <Typography
              sx={{
                mt: 2,
                textAlign: "center",
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              Precisa de ajuda?{" "}
              <Link
                href="/suporte"
                style={{
                  color: "#2DD4FF",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Fale com nosso suporte
              </Link>
            </Typography>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
