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
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from "@mui/material";
import { Check, Warning } from "@mui/icons-material";

interface OpenAIConfig {
  configured: boolean;
  model: string;
  language: string;
}

export function OpenAITab() {
  const [config, setConfig] = useState<OpenAIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [saved, setSaved] = useState(false);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("whisper-1");
  const [language, setLanguage] = useState("auto");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/openai");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setModel(data.model ?? "whisper-1");
        setLanguage(data.language ?? "auto");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const body: Record<string, string> = { model, language };
      if (apiKey.trim()) body.apiKey = apiKey.trim();

      const res = await fetch("/api/admin/settings/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSaved(true);
        setApiKey("");
        setTimeout(() => setSaved(false), 2000);
        await loadConfig();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings/openai/test", {
        method: "POST",
      });
      const data = await res.json();
      setTestResult({
        ok: data.ok,
        message: data.message ?? data.error ?? "Erro desconhecido",
      });
    } catch {
      setTestResult({ ok: false, message: "Erro de conexão" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} sx={{ color: "#2DD4FF" }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, color: "#fff", mb: 0.5 }}
      >
        OpenAI / Transcrição
      </Typography>
      <Typography
        sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem", mb: 3 }}
      >
        Configure a chave da API, modelo Whisper e idioma padrão para
        transcrições.
      </Typography>

      <Grid container spacing={3}>
        {/* Status */}
        <Grid item xs={12}>
          <Alert
            severity={config?.configured ? "success" : "warning"}
            icon={config?.configured ? <Check /> : <Warning />}
            sx={{
              background: config?.configured
                ? "rgba(76,175,80,0.12)"
                : "rgba(255,152,0,0.12)",
              color: "rgba(255,255,255,0.85)",
              "& .MuiAlert-icon": {
                color: config?.configured
                  ? "rgba(76,175,80,0.85)"
                  : "rgba(255,152,0,0.85)",
              },
            }}
          >
            {config?.configured
              ? "Chave da API OpenAI configurada e criptografada."
              : "Chave da API OpenAI não configurada. As transcrições não funcionarão sem ela."}
          </Alert>
        </Grid>

        {/* API Key */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="API Key (sk-...)"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              config?.configured
                ? "••••••••  (deixe vazio para manter a atual)"
                : "sk-..."
            }
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
              },
              "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.5)" },
            }}
          />
        </Grid>

        {/* Model */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: "rgba(255,255,255,0.5)" }}>
              Modelo Whisper
            </InputLabel>
            <Select
              value={model}
              label="Modelo Whisper"
              onChange={(e) => setModel(e.target.value)}
              sx={{
                color: "#fff",
                "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
              }}
            >
              <MenuItem value="whisper-1">whisper-1</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Language */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: "rgba(255,255,255,0.5)" }}>
              Idioma
            </InputLabel>
            <Select
              value={language}
              label="Idioma"
              onChange={(e) => setLanguage(e.target.value)}
              sx={{
                color: "#fff",
                "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
              }}
            >
              <MenuItem value="auto">Auto-detectar</MenuItem>
              <MenuItem value="pt">Português</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="es">Español</MenuItem>
              <MenuItem value="ja">日本語</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Actions */}
        <Grid item xs={12}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{
                background:
                  "linear-gradient(135deg, #2DD4FF 0%, #2DD4FFDD 100%)",
                color: "#06080F",
                textTransform: "none",
                fontWeight: 600,
                "&:disabled": { opacity: 0.5 },
              }}
            >
              {saving ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
            </Button>

            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={testing || !config?.configured}
              sx={{
                color: "#2DD4FF",
                borderColor: "rgba(45,212,255,0.3)",
                textTransform: "none",
                fontWeight: 500,
                "&:hover": {
                  borderColor: "#2DD4FF",
                  background: "rgba(45,212,255,0.05)",
                },
                "&:disabled": { opacity: 0.4 },
              }}
            >
              {testing ? "Testando..." : "Testar Conexão"}
            </Button>
          </Box>
        </Grid>

        {/* Test result */}
        {testResult && (
          <Grid item xs={12}>
            <Alert
              severity={testResult.ok ? "success" : "error"}
              sx={{
                background: testResult.ok
                  ? "rgba(76,175,80,0.12)"
                  : "rgba(244,67,54,0.12)",
                color: "rgba(255,255,255,0.85)",
                "& .MuiAlert-icon": {
                  color: testResult.ok
                    ? "rgba(76,175,80,0.85)"
                    : "rgba(244,67,54,0.85)",
                },
              }}
            >
              {testResult.message}
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
