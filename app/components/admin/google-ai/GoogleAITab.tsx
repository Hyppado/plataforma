"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Check, Warning } from "@mui/icons-material";

interface GoogleAIConfig {
  configured: boolean;
  model: string;
}

export function GoogleAITab() {
  const [config, setConfig] = useState<GoogleAIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-3.1-flash-image-preview");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/google-ai");
      if (res.ok) {
        const data = (await res.json()) as GoogleAIConfig;
        setConfig(data);
        if (data.model) setModel(data.model);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!apiKey.trim() && !model.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = { model };
      if (apiKey.trim()) body.apiKey = apiKey.trim();

      const res = await fetch("/api/admin/settings/google-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setApiKey("");
        setTimeout(() => setSaved(false), 2000);
        await loadConfig();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erro ao salvar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#fff", mb: 0.5 }}>
        Google AI Studio
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3, fontSize: "0.875rem" }}>
        Chave de API do Google AI Studio usada pelo Influencer IA para gerar
        imagens. O modelo padrão é{" "}
        <code>gemini-3.1-flash-image-preview</code>.
      </Typography>

      {/* Status */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 3,
          p: 1.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: config?.configured ? "success.main" : "warning.main",
          bgcolor: config?.configured
            ? "rgba(46,125,50,0.08)"
            : "rgba(237,108,2,0.08)",
        }}
      >
        {config?.configured ? (
          <Check sx={{ fontSize: 18, color: "success.main" }} />
        ) : (
          <Warning sx={{ fontSize: 18, color: "warning.main" }} />
        )}
        <Typography
          variant="body2"
          sx={{
            color: config?.configured ? "success.main" : "warning.main",
            fontWeight: 600,
          }}
        >
          {config?.configured
            ? "API key configurada"
            : "API key não configurada — Influencer IA não conseguirá gerar imagens"}
        </Typography>
      </Box>

      {/* API Key + Model inputs */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Google AI Studio API Key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIza..."
          size="small"
          fullWidth
          helperText="Obtenha sua chave em aistudio.google.com/apikey. Será armazenada criptografada."
        />
        <TextField
          label="Model ID"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gemini-3.1-flash-image-preview"
          size="small"
          fullWidth
          helperText="ID exato do modelo. Deixe o padrão se não souber."
        />

        {error && <Alert severity="error">{error}</Alert>}
        {saved && <Alert severity="success">API key salva com sucesso!</Alert>}

        <Box>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={(!apiKey.trim() && !model.trim()) || saving}
            startIcon={
              saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {saving ? "Salvando…" : "Salvar API Key"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
