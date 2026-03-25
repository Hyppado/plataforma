"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Grid,
  Divider,
  Button,
  TextField,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  IconButton,
  Stack,
} from "@mui/material";
import {
  Check as CheckIcon,
  Restore as RestoreIcon,
  Save as SaveIcon,
  SubtitlesOutlined,
  TerminalOutlined,
  CodeOutlined,
  SupportAgentOutlined,
  Email as EmailIcon,
  SettingsOutlined,
} from "@mui/icons-material";
import {
  getQuotaPolicy,
  getPromptConfig,
  updateQuotaPolicy,
  updatePromptConfig,
} from "@/lib/admin/admin-client";
import {
  PROMPT_VARIABLES,
  getDefaultPromptConfig,
} from "@/lib/admin/prompt-config";
import type { QuotaPolicy, QuotaUsage, PromptConfig } from "@/lib/types/admin";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

function formatUsage(used: number | null | undefined, max: number | null | undefined): string {
  const usedStr = used != null ? used.toLocaleString("pt-BR") : "—";
  const maxStr = max != null ? max.toLocaleString("pt-BR") : "—";
  return `${usedStr} / ${maxStr}`;
}

export default function ConfigPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "ADMIN") {
      router.replace("/app/videos");
    }
  }, [session, status, router]);

  if (status === "loading" || !session || session.user?.role !== "ADMIN") {
    return null;
  }

  // Data state
  const [quotaPolicy, setQuotaPolicyState] = useState<QuotaPolicy | null>(null);
  const [quotaUsage, setQuotaUsage] = useState<QuotaUsage>({});
  const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);
  const [promptTab, setPromptTab] = useState(0);
  const [savedPrompt, setSavedPrompt] = useState(false);
  const [limitsSaved, setLimitsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  // Editable limits
  const [transcriptsLimit, setTranscriptsLimit] = useState("40");
  const [scriptsLimit, setScriptsLimit] = useState("70");
  // Support config
  const supportEmail = "contato@hyppado.com";

  // Load data from API
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [policy, prompt, usageData] = await Promise.all([
        getQuotaPolicy(),
        getPromptConfig(),
        fetch("/api/admin/quota-usage").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      setQuotaPolicyState(policy);
      setTranscriptsLimit(policy.transcriptsPerMonth.toString());
      setScriptsLimit(policy.scriptsPerMonth.toString());
      setPromptConfig(prompt);
      if (usageData) setQuotaUsage(usageData);
    } catch (error) {
      console.error("Failed to load config data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save limits to API
  const saveLimits = useCallback(async () => {
    if (!quotaPolicy) return;
    const newPolicy: QuotaPolicy = {
      ...quotaPolicy,
      transcriptsPerMonth: parseInt(transcriptsLimit) || 40,
      scriptsPerMonth: parseInt(scriptsLimit) || 70,
    };
    await updateQuotaPolicy(newPolicy);
    setQuotaPolicyState(newPolicy);
    setLimitsSaved(true);
    setTimeout(() => setLimitsSaved(false), 2000);
    window.dispatchEvent(new Event("quota-policy-changed"));
  }, [quotaPolicy, transcriptsLimit, scriptsLimit]);

  // Update prompt template
  const updatePromptTemplate = useCallback(
    (type: "insight" | "script", template: string) => {
      setPromptConfig((prev) =>
        prev
          ? {
              ...prev,
              [type]: { ...prev[type], template },
            }
          : prev
      );
      setSavedPrompt(false);
    },
    [],
  );

  // Restore defaults
  const restoreDefaults = useCallback((type: "insight" | "script") => {
    const defaults = getDefaultPromptConfig();
    setPromptConfig((prev) =>
      prev
        ? {
            ...prev,
            [type]: defaults[type],
          }
        : prev
    );
    setSavedPrompt(false);
  }, []);

  // Save prompts to API
  const savePrompt = useCallback(async () => {
    if (!promptConfig) return;
    await updatePromptConfig(promptConfig);
    setSavedPrompt(true);
    setTimeout(() => setSavedPrompt(false), 2000);
  }, [promptConfig]);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 1 }}>
          Configuração
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.6)" }}>
          Limites, prompts, suporte e parâmetros internos
        </Typography>
      </Box>
      {loading && <LinearProgress sx={{ mb: 3 }} />}
      <Grid container spacing={3}>
        {/* Limites & Créditos */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={cardStyle}>
            <CardHeader
              avatar={<SettingsOutlined sx={{ color: "#2DD4FF" }} />}
              title="Limites & Créditos"
              subheader="Configuração de quotas mensais"
              titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
              subheaderTypographyProps={{ fontSize: "0.8rem" }}
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={limitsSaved ? <CheckIcon /> : <SaveIcon />}
                  onClick={saveLimits}
                  sx={{
                    background: limitsSaved
                      ? "rgba(76, 175, 80, 0.2)"
                      : "linear-gradient(135deg, #2DD4FF, #7B61FF)",
                    color: limitsSaved ? "#81C784" : "#fff",
                    fontWeight: 600,
                    minWidth: 80,
                  }}
                >
                  {limitsSaved ? "Salvo!" : "Salvar"}
                </Button>
              }
            />
            <CardContent>
              <Stack spacing={2.5}>
                {/* Transcripts limit */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <SubtitlesOutlined sx={{ fontSize: 18, color: "#2DD4FF" }} />
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
                      Transcrições / mês
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <TextField
                      value={transcriptsLimit}
                      onChange={(e) => setTranscriptsLimit(e.target.value)}
                      size="small"
                      type="number"
                      sx={{
                        width: 100,
                        "& .MuiOutlinedInput-root": { background: "rgba(0,0,0,0.2)" },
                      }}
                    />
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
                      Uso: {formatUsage(quotaUsage.transcriptsUsed, parseInt(transcriptsLimit) || quotaPolicy?.transcriptsPerMonth)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={
                      quotaUsage.transcriptsUsed != null
                        ? Math.min(
                            (quotaUsage.transcriptsUsed / (parseInt(transcriptsLimit) || 40)) * 100,
                            100,
                          )
                        : 0
                    }
                    sx={{
                      mt: 1,
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.1)",
                      "& .MuiLinearProgress-bar": {
                        background: "linear-gradient(90deg, #2DD4FF, #7B61FF)",
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
                {/* Scripts limit */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <TerminalOutlined sx={{ fontSize: 18, color: "#CE93D8" }} />
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
                      Roteiros (Scripts) / mês
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <TextField
                      value={scriptsLimit}
                      onChange={(e) => setScriptsLimit(e.target.value)}
                      size="small"
                      type="number"
                      sx={{
                        width: 100,
                        "& .MuiOutlinedInput-root": { background: "rgba(0,0,0,0.2)" },
                      }}
                    />
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
                      Uso: {formatUsage(quotaUsage.scriptsUsed, parseInt(scriptsLimit) || quotaPolicy?.scriptsPerMonth)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={
                      quotaUsage.scriptsUsed != null
                        ? Math.min(
                            (quotaUsage.scriptsUsed / (parseInt(scriptsLimit) || 70)) * 100,
                            100,
                          )
                        : 0
                    }
                    sx={{
                      mt: 1,
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.1)",
                      "& .MuiLinearProgress-bar": {
                        background: "linear-gradient(90deg, #7B61FF, #F472B6)",
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {/* Suporte */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardHeader
              avatar={<SupportAgentOutlined sx={{ color: "#2DD4FF" }} />}
              title="Suporte"
              subheader="Canais de atendimento"
              titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
              subheaderTypographyProps={{ fontSize: "0.8rem" }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: 2,
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 2,
                  }}
                >
                  <EmailIcon sx={{ color: "#2DD4FF" }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}>
                      Email de Suporte
                    </Typography>
                    <Typography sx={{ color: "#fff", fontWeight: 500 }}>
                      {supportEmail}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    href={`mailto:${supportEmail}`}
                    sx={{
                      borderColor: "#2DD4FF",
                      color: "#2DD4FF",
                      "&:hover": {
                        borderColor: "#2DD4FF",
                        background: "rgba(45, 212, 255, 0.1)",
                      },
                    }}
                  >
                    Enviar Email
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {/* Prompt Configuração */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardHeader
              avatar={<CodeOutlined sx={{ color: "#2DD4FF" }} />}
              title="Configuração de Prompts"
              subheader="Templates para geração de conteúdo"
              titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
              subheaderTypographyProps={{ fontSize: "0.8rem" }}
              action={
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Restaurar padrões">
                    <IconButton
                      onClick={() =>
                        restoreDefaults(promptTab === 0 ? "insight" : "script")
                      }
                      size="small"
                      sx={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      <RestoreIcon />
                    </IconButton>
                  </Tooltip>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={savedPrompt ? <CheckIcon /> : <SaveIcon />}
                    onClick={savePrompt}
                    sx={{
                      background: savedPrompt
                        ? "rgba(76, 175, 80, 0.2)"
                        : "linear-gradient(135deg, #2DD4FF, #7B61FF)",
                      color: savedPrompt ? "#81C784" : "#fff",
                      fontWeight: 600,
                    }}
                  >
                    {savedPrompt ? "Salvo!" : "Salvar"}
                  </Button>
                </Stack>
              }
            />
            <CardContent>
              <Tabs
                value={promptTab}
                onChange={(_, v) => setPromptTab(v)}
                sx={{
                  mb: 2,
                  "& .MuiTab-root": {
                    color: "rgba(255,255,255,0.5)",
                    "&.Mui-selected": { color: "#2DD4FF" },
                  },
                  "& .MuiTabs-indicator": { background: "#2DD4FF" },
                }}
              >
                <Tab label="Insight" />
                <Tab label="Script" />
              </Tabs>
              {/* Variables Reference */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                  Variáveis: {PROMPT_VARIABLES.map((v) => v.variable).join(", ")}
                </Typography>
              </Box>
              {/* Template Editor */}
              <TextField
                multiline
                rows={6}
                fullWidth
                value={
                  promptConfig
                    ? promptTab === 0
                      ? promptConfig.insight.template
                      : promptConfig.script.template
                    : ""
                }
                onChange={(e) =>
                  updatePromptTemplate(
                    promptTab === 0 ? "insight" : "script",
                    e.target.value,
                  )
                }
                sx={{
                  "& .MuiOutlinedInput-root": {
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    background: "rgba(0,0,0,0.3)",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                    "&:hover fieldset": {
                      borderColor: "rgba(255,255,255,0.2)",
                    },
                    "&.Mui-focused fieldset": { borderColor: "#2DD4FF" },
                  },
                  "& .MuiOutlinedInput-input": {
                    color: "rgba(255,255,255,0.85)",
                  },
                }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
