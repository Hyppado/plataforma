"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
} from "@mui/material";
import { Check, SupportAgent, EmailOutlined, WhatsApp } from "@mui/icons-material";
import { toWhatsAppNumber, formatWhatsApp } from "@/lib/support-contact";

/**
 * Contatos de suporte: e-mail e WhatsApp, em campos separados.
 *
 * Eram um campo só, preenchido como "email | whatsapp - (74) 99901-0441".
 * Exibia, mas o `mailto:` levava a string inteira — não abria nada — e não
 * havia como oferecer link de conversa.
 */
export function SupportEmailSection() {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/support");
      if (res.ok) {
        const d = await res.json();
        setEmail(d.email ?? "");
        setWhatsapp(d.whatsapp ?? "");
      }
    } catch {
      // silencioso: a seção carrega vazia e o admin pode tentar de novo
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, whatsapp }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Erro ao salvar");
        return;
      }
      setEmail(d.email);
      setWhatsapp(d.whatsapp);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Erro inesperado ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const emailInvalido = email.length > 0 && !email.includes("@");
  const zapInvalido = whatsapp.length > 0 && !toWhatsAppNumber(whatsapp);

  const campoSx = {
    "& .MuiOutlinedInput-root": {
      background: "rgba(0,0,0,0.25)",
      "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
      "&:hover fieldset": { borderColor: "rgba(45,212,255,0.3)" },
      "&.Mui-focused fieldset": { borderColor: "primary.main" },
    },
    "& input": { color: "#fff" },
    "& .MuiFormHelperText-root": { color: "rgba(255,255,255,0.45)" },
  };

  return (
    <Grid item xs={12}>
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <SupportAgent sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography sx={{ fontWeight: 600, color: "#fff", fontSize: "1rem" }}>
            Contatos de Suporte
          </Typography>
        </Box>

        <Typography
          sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", mb: 2.5 }}
        >
          Exibidos na página de suporte, no rodapé e na landing. O e-mail abre o
          aplicativo de e-mail; o número abre uma conversa no WhatsApp.
        </Typography>

        {loading ? (
          <CircularProgress size={20} sx={{ color: "primary.main" }} />
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="E-mail"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSaved(false);
                  }}
                  type="email"
                  size="small"
                  fullWidth
                  placeholder="suporte@hyppado.com"
                  error={emailInvalido}
                  helperText={
                    emailInvalido ? "Endereço inválido" : "Abre com mailto:"
                  }
                  InputProps={{
                    startAdornment: (
                      <EmailOutlined
                        sx={{
                          fontSize: 17,
                          mr: 1,
                          color: "rgba(255,255,255,0.35)",
                        }}
                      />
                    ),
                  }}
                  sx={campoSx}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="WhatsApp"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    setSaved(false);
                  }}
                  size="small"
                  fullWidth
                  placeholder="(74) 99901-0441"
                  error={zapInvalido}
                  helperText={
                    zapInvalido
                      ? "Informe com DDD"
                      : whatsapp
                        ? `Abrirá conversa com ${formatWhatsApp(whatsapp)}`
                        : "Vazio esconde o botão de WhatsApp"
                  }
                  InputProps={{
                    startAdornment: (
                      <WhatsApp
                        sx={{
                          fontSize: 17,
                          mr: 1,
                          color: "rgba(255,255,255,0.35)",
                        }}
                      />
                    ),
                  }}
                  sx={campoSx}
                />
              </Grid>
            </Grid>

            <Button
              variant="contained"
              onClick={save}
              disabled={saving || !email || emailInvalido || zapInvalido}
              startIcon={
                saving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : saved ? (
                  <Check />
                ) : undefined
              }
              sx={{
                textTransform: "none",
                fontWeight: 600,
                px: 3,
                background: saved ? "#22c55e" : "primary.main",
                "&:hover": { background: saved ? "#22c55e" : "primary.dark" },
              }}
            >
              {saved ? "Salvo!" : "Salvar"}
            </Button>
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>
    </Grid>
  );
}
