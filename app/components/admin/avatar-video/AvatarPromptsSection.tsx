"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Button,
  TextField,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Stack,
  Box,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Check as CheckIcon,
  Restore as RestoreIcon,
  Save as SaveIcon,
  CodeOutlined,
} from "@mui/icons-material";
import type { PromptConfig } from "@/lib/types/admin";
import {
  getDefaultAvatarVideoPrompts,
  AVATAR_IMAGE_VARIABLES,
  VEO_SYSTEM_VARIABLES,
  VEO_USER_VARIABLES,
  type AvatarPromptVariable,
} from "@/lib/admin/config-defaults";
import { getPromptConfig, updatePromptConfig } from "@/lib/admin/admin-client";

type AvatarPromptKey = "image" | "veoSystem" | "veoUser";

interface PromptDef {
  key: AvatarPromptKey;
  label: string;
  description: string;
  variables: readonly AvatarPromptVariable[];
}

const PROMPT_DEFS: readonly PromptDef[] = [
  {
    key: "image",
    label: "Imagem (Gemini)",
    description:
      "Prompt enviado ao Google Gemini para gerar a imagem do influenciador com o produto.",
    variables: AVATAR_IMAGE_VARIABLES,
  },
  {
    key: "veoSystem",
    label: "VEO 3.1 — System",
    description:
      "Mensagem de sistema enviada ao OpenAI para gerar os prompts VEO 3.1 (define o papel/contrato).",
    variables: VEO_SYSTEM_VARIABLES,
  },
  {
    key: "veoUser",
    label: "VEO 3.1 — User",
    description:
      "Mensagem de usuário enviada ao OpenAI com produto, estilo e estrutura das partes do vídeo.",
    variables: VEO_USER_VARIABLES,
  },
] as const;

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

export function AvatarPromptsSection() {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPromptConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const def = PROMPT_DEFS[activeTab];
  const currentValue = config?.avatarVideo[def.key] ?? "";

  // Detect which required variables are missing from the current draft.
  const missingRequired = useMemo(() => {
    return def.variables
      .filter((v) => v.required && !currentValue.includes(v.variable))
      .map((v) => v.variable);
  }, [def, currentValue]);

  const handleChange = useCallback(
    (key: AvatarPromptKey, value: string) => {
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              avatarVideo: { ...prev.avatarVideo, [key]: value },
            }
          : prev,
      );
      setSaved(false);
    },
    [],
  );

  const handleRestore = useCallback((key: AvatarPromptKey) => {
    const defaults = getDefaultAvatarVideoPrompts();
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            avatarVideo: { ...prev.avatarVideo, [key]: defaults[key] },
          }
        : prev,
    );
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      await updatePromptConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [config]);

  const insertVariable = useCallback(
    (variable: string) => {
      if (!config) return;
      handleChange(def.key, currentValue + variable);
    },
    [config, def.key, currentValue, handleChange],
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  if (!config) {
    return (
      <Alert severity="error">
        {error ?? "Erro ao carregar configuração de prompts."}
      </Alert>
    );
  }

  return (
    <Card sx={cardStyle}>
      <CardHeader
        avatar={<CodeOutlined sx={{ color: "primary.main" }} />}
        title="Prompts de IA — Vídeo com Avatar"
        subheader="Edite os prompts enviados ao Gemini e à OpenAI. As variáveis obrigatórias devem permanecer no texto."
        titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
        subheaderTypographyProps={{ fontSize: "0.8rem" }}
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Restaurar padrão deste prompt">
              <IconButton
                onClick={() => handleRestore(def.key)}
                size="small"
                sx={{ color: "rgba(255,255,255,0.5)" }}
              >
                <RestoreIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              startIcon={
                saving ? (
                  <CircularProgress size={14} sx={{ color: "#fff" }} />
                ) : saved ? (
                  <CheckIcon />
                ) : (
                  <SaveIcon />
                )
              }
              onClick={handleSave}
              disabled={saving || missingRequired.length > 0}
              sx={{
                background: saved
                  ? "rgba(76, 175, 80, 0.2)"
                  : "linear-gradient(135deg, #2DD4FF, #7B61FF)",
                color: saved ? "#81C784" : "#fff",
                fontWeight: 600,
              }}
            >
              {saved ? "Salvo!" : "Salvar"}
            </Button>
          </Stack>
        }
      />
      <CardContent>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            mb: 2,
            "& .MuiTab-root": {
              color: "rgba(255,255,255,0.5)",
              "&.Mui-selected": { color: "primary.main" },
            },
            "& .MuiTabs-indicator": { background: "primary.main" },
          }}
        >
          {PROMPT_DEFS.map((p) => (
            <Tab key={p.key} label={p.label} />
          ))}
        </Tabs>

        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.5)",
            display: "block",
            mb: 1.5,
          }}
        >
          {def.description}
        </Typography>

        {/* Variables reference & insert */}
        {def.variables.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.5)", display: "block", mb: 0.5 }}
            >
              Variáveis disponíveis (clique para inserir no fim do texto):
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              sx={{ rowGap: 0.75 }}
            >
              {def.variables.map((v) => {
                const present = currentValue.includes(v.variable);
                return (
                  <Tooltip
                    key={v.variable}
                    title={`${v.description}${v.required ? " — obrigatória" : ""}`}
                  >
                    <Chip
                      label={v.variable}
                      size="small"
                      onClick={() => insertVariable(v.variable)}
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                        background: v.required
                          ? present
                            ? "rgba(46,204,113,0.15)"
                            : "rgba(244,67,54,0.18)"
                          : "rgba(255,255,255,0.06)",
                        color: v.required
                          ? present
                            ? "#2ecc71"
                            : "#ff7043"
                          : "rgba(255,255,255,0.7)",
                        border: `1px solid ${
                          v.required
                            ? present
                              ? "rgba(46,204,113,0.35)"
                              : "rgba(244,67,54,0.35)"
                            : "rgba(255,255,255,0.1)"
                        }`,
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Required-variable warning */}
        {missingRequired.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Variáveis obrigatórias ausentes: {missingRequired.join(", ")} —
            adicione-as ao prompt para habilitar o salvamento.
          </Alert>
        )}

        {/* API errors */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Editor */}
        <TextField
          multiline
          minRows={14}
          maxRows={40}
          fullWidth
          value={currentValue}
          onChange={(e) => handleChange(def.key, e.target.value)}
          sx={{
            "& .MuiOutlinedInput-root": {
              fontFamily: "monospace",
              fontSize: "0.78rem",
              background: "rgba(0,0,0,0.3)",
              "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
              "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
              "&.Mui-focused fieldset": { borderColor: "#2DD4FF" },
            },
            "& .MuiOutlinedInput-input": {
              color: "rgba(255,255,255,0.85)",
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
