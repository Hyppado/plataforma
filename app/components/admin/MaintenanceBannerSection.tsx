"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Switch,
  CircularProgress,
  Grid,
  Chip,
} from "@mui/material";
import { Check, WarningAmberRounded } from "@mui/icons-material";

/**
 * Liga/desliga a faixa de aviso do topo da plataforma e edita o texto.
 *
 * A mensagem fica salva mesmo com o aviso desligado, para o admin poder
 * deixá-la pronta e só acionar quando a instabilidade acontecer — que é
 * justamente quando não há tempo de escrever.
 */
export function MaintenanceBannerSection() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");
  const [maxLength, setMaxLength] = useState(280);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/maintenance-banner");
      if (res.ok) {
        const d = await res.json();
        setEnabled(!!d.enabled);
        setMessage(d.message ?? "");
        setDefaultMessage(d.defaultMessage ?? "");
        setMaxLength(d.maxLength ?? 280);
      }
    } catch {
      // silencioso: a seção aparece vazia e o admin pode tentar de novo
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (proximoEnabled = enabled) => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/maintenance-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: proximoEnabled, message }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Erro ao salvar");
        return;
      }
      setEnabled(d.enabled);
      setMessage(d.message);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Erro inesperado ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const excedeu = message.length > maxLength;

  return (
    <Grid item xs={12}>
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${enabled ? "rgba(255,138,61,0.35)" : "rgba(255,255,255,0.07)"}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <WarningAmberRounded sx={{ color: "#FF8A3D", fontSize: 20 }} />
          <Typography sx={{ fontWeight: 600, color: "#fff", fontSize: "1rem" }}>
            Aviso de indisponibilidade
          </Typography>
          {enabled && (
            <Chip
              size="small"
              label="No ar"
              sx={{
                height: 20,
                fontSize: "0.65rem",
                fontWeight: 700,
                background: "rgba(255,138,61,0.18)",
                color: "#FF8A3D",
                border: "1px solid rgba(255,138,61,0.35)",
              }}
            />
          )}
        </Box>

        <Typography
          sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", mb: 2.5 }}
        >
          Exibe uma faixa no topo da plataforma para todos os usuários. Use
          quando algum recurso estiver instável — sem isso, a pessoa descobre
          sozinha pelo card que não carrega.
        </Typography>

        {loading ? (
          <CircularProgress size={20} sx={{ color: "primary.main" }} />
        ) : (
          <>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}
            >
              <Switch
                checked={enabled}
                disabled={saving}
                onChange={(e) => {
                  const proximo = e.target.checked;
                  setEnabled(proximo);
                  // Ligar/desligar salva na hora: numa queda, ninguém quer
                  // lembrar de clicar em "Salvar" depois de virar a chave.
                  void save(proximo);
                }}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": { color: "#FF8A3D" },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: "#FF8A3D",
                  },
                }}
              />
              <Typography
                sx={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.8)" }}
              >
                {enabled ? "Aviso visível para os usuários" : "Aviso desligado"}
              </Typography>
            </Box>

            <TextField
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSaved(false);
              }}
              multiline
              minRows={2}
              fullWidth
              size="small"
              placeholder={defaultMessage}
              error={excedeu}
              helperText={
                excedeu
                  ? `${message.length}/${maxLength} — a faixa é fina, mensagens longas ficam cortadas`
                  : `${message.length}/${maxLength} · vazio usa o texto padrão`
              }
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  background: "rgba(0,0,0,0.25)",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                  "&:hover fieldset": { borderColor: "rgba(255,138,61,0.3)" },
                  "&.Mui-focused fieldset": { borderColor: "#FF8A3D" },
                },
                "& textarea": { color: "#fff" },
                "& .MuiFormHelperText-root": {
                  color: "rgba(255,255,255,0.45)",
                },
              }}
            />

            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={saving || excedeu}
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
                background: saved ? "#22c55e" : "#FF8A3D",
                "&:hover": { background: saved ? "#22c55e" : "#E5762F" },
              }}
            >
              {saved ? "Salvo!" : "Salvar mensagem"}
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
