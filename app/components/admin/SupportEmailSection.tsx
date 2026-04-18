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
import { Check, EmailOutlined } from "@mui/icons-material";

export function SupportEmailSection() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/support");
      if (res.ok) {
        const data = await res.json();
        setEmail(data.email ?? "");
      }
    } catch {
      // ignore
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
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao salvar");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Erro inesperado ao salvar");
    } finally {
      setSaving(false);
    }
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
          <EmailOutlined sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography sx={{ fontWeight: 600, color: "#fff", fontSize: "1rem" }}>
            Email de Suporte
          </Typography>
        </Box>

        <Typography
          sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", mb: 2.5 }}
        >
          Endereço exibido na página de suporte e nos links de contato da
          plataforma.
        </Typography>

        {loading ? (
          <CircularProgress size={20} sx={{ color: "primary.main" }} />
        ) : (
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <TextField
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
              type="email"
              size="small"
              placeholder="suporte@hyppado.com"
              inputProps={{ style: { fontSize: "1rem" } }}
              sx={{
                flex: 1,
                minWidth: 240,
                "& .MuiOutlinedInput-root": {
                  background: "rgba(0,0,0,0.25)",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                  "&:hover fieldset": { borderColor: "rgba(45,212,255,0.3)" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
                "& input": { color: "#fff" },
              }}
            />
            <Button
              variant="contained"
              onClick={save}
              disabled={saving || !email}
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
          </Box>
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
