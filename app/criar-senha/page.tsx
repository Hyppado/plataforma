"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import {
  Visibility,
  VisibilityOff,
  CheckCircleOutline,
} from "@mui/icons-material";
import { Logo } from "@/app/components/ui/Logo";
import { appTheme } from "@/app/theme";

type PageState = "loading" | "form" | "success" | "error";

export default function CriarSenhaPage() {
  return (
    <Suspense
      fallback={
        <ThemeProvider theme={appTheme}>
          <Box
            sx={{
              minHeight: "100vh",
              background: "linear-gradient(180deg, #06080F 0%, #0A0F18 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={40} sx={{ color: "#2DD4FF" }} />
          </Box>
        </ThemeProvider>
      }
    >
      <CriarSenhaContent />
    </Suspense>
  );
}

function CriarSenhaContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<PageState>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setErrorMessage("Link inválido. Solicite um novo acesso pelo suporte.");
      setState("error");
      return;
    }

    fetch(`/api/auth/setup-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setEmail(data.email ?? "");
          setState("form");
        } else {
          const msg =
            data.reason === "expired"
              ? "Este link expirou. Solicite um novo acesso pelo suporte."
              : "Link inválido ou já utilizado. Solicite um novo acesso pelo suporte.";
          setErrorMessage(msg);
          setState("error");
        }
      })
      .catch(() => {
        setErrorMessage(
          "Erro ao verificar o link. Tente novamente ou entre em contato com o suporte.",
        );
        setState("error");
      });
  }, [token]);

  const handleSubmit = useCallback(async () => {
    if (!token) return;

    if (password.length < 8) {
      setErrorMessage("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setState("success");
      } else {
        setErrorMessage(
          data.error === "Invalid or expired token"
            ? "Link inválido ou expirado. Solicite um novo acesso pelo suporte."
            : (data.error ?? "Erro ao criar senha. Tente novamente."),
        );
      }
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }, [token, password, confirmPassword]);

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

            {/* Loading state */}
            {state === "loading" && (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <CircularProgress size={40} sx={{ color: "#2DD4FF", mb: 2 }} />
                <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>
                  Verificando link de acesso...
                </Typography>
              </Box>
            )}

            {/* Error state */}
            {state === "error" && (
              <Box sx={{ textAlign: "center", py: 2 }}>
                <Alert
                  severity="warning"
                  sx={{
                    mb: 3,
                    background: "rgba(255,152,0,0.08)",
                    color: "#ffb74d",
                    "& .MuiAlert-icon": { color: "#ffb74d" },
                  }}
                >
                  {errorMessage}
                </Alert>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 2 }}
                >
                  Precisa de ajuda? Entre em contato com nosso suporte.
                </Typography>
                <Button
                  component={Link}
                  href="/login"
                  variant="outlined"
                  sx={{
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.7)",
                    textTransform: "none",
                    "&:hover": { borderColor: "#2DD4FF", color: "#2DD4FF" },
                  }}
                >
                  Voltar ao login
                </Button>
              </Box>
            )}

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
                  Senha criada com sucesso!
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 3 }}
                >
                  Agora você pode acessar sua conta com seu email e a senha que
                  acabou de criar.
                </Typography>
                <Button
                  component={Link}
                  href="/login"
                  variant="contained"
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: "#2DD4FF",
                    color: "#0a0a0f",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    textTransform: "none",
                    borderRadius: 2,
                    "&:hover": { background: "#5BE0FF" },
                  }}
                >
                  Acessar minha conta
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
                  Crie sua senha
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "rgba(255,255,255,0.5)",
                    textAlign: "center",
                    mb: 3,
                  }}
                >
                  {email
                    ? `Defina uma senha para ${email}`
                    : "Defina uma senha para acessar sua conta"}
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
                    label="Nova senha"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    fullWidth
                    autoFocus
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ color: "rgba(255,255,255,0.3)" }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
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
                          borderColor: "#2DD4FF",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "rgba(255,255,255,0.4)",
                        "&.Mui-focused": { color: "#2DD4FF" },
                      },
                    }}
                  />

                  <TextField
                    label="Confirme a senha"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    fullWidth
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
                          borderColor: "#2DD4FF",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "rgba(255,255,255,0.4)",
                        "&.Mui-focused": { color: "#2DD4FF" },
                      },
                    }}
                  />

                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    Mínimo de 8 caracteres
                  </Typography>

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
                      "Criar senha"
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
                      "&:hover": { color: "#2DD4FF" },
                    }}
                  >
                    Já tem senha? Acessar conta
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
