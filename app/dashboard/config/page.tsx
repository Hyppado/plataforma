"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  Grid,
  LinearProgress,
  Tabs,
  Tab,
} from "@mui/material";
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
import { LimitsSection } from "@/app/components/admin/LimitsSection";
import { PromptsSection } from "@/app/components/admin/PromptsSection";
import { EchotikTab } from "@/app/components/admin/echotik/EchotikTab";
import { HotmartTab } from "@/app/components/admin/hotmart/HotmartTab";

export default function ConfigPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [activeTab, setActiveTab] = useState(0);

  // Data state (for Geral tab)
  const [quotaPolicy, setQuotaPolicyState] = useState<QuotaPolicy | null>(null);
  const [quotaUsage, setQuotaUsage] = useState<QuotaUsage>({});
  const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);
  const [promptTab, setPromptTab] = useState(0);
  const [savedPrompt, setSavedPrompt] = useState(false);
  const [limitsSaved, setLimitsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transcriptsLimit, setTranscriptsLimit] = useState("40");
  const [scriptsLimit, setScriptsLimit] = useState("70");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [policy, prompt, usageData] = await Promise.all([
        getQuotaPolicy(),
        getPromptConfig(),
        fetch("/api/admin/quota-usage")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
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
    if (status === "loading") return;
    if (!session || session.user?.role !== "ADMIN") {
      router.replace("/dashboard/videos");
      return;
    }
    loadData();
  }, [session, status, router, loadData]);

  if (status === "loading" || !session || session.user?.role !== "ADMIN") {
    return null;
  }

  const saveLimits = useCallback(async () => {
    if (!quotaPolicy) return;
    const newPolicy: QuotaPolicy = {
      ...quotaPolicy,
      transcriptsPerMonth: parseInt(transcriptsLimit) || 40,
      scriptsPerMonth: parseInt(scriptsLimit) || 70,
    };
    try {
      await updateQuotaPolicy(newPolicy);
      setQuotaPolicyState(newPolicy);
      setLimitsSaved(true);
      setTimeout(() => setLimitsSaved(false), 2000);
      window.dispatchEvent(new Event("quota-policy-changed"));
    } catch (error) {
      console.error("Erro ao salvar limites:", error);
    }
  }, [quotaPolicy, transcriptsLimit, scriptsLimit]);

  const updatePromptTemplate = useCallback(
    (type: "insight" | "script", template: string) => {
      setPromptConfig((prev) =>
        prev ? { ...prev, [type]: { ...prev[type], template } } : prev,
      );
      setSavedPrompt(false);
    },
    [],
  );

  const restoreDefaults = useCallback((type: "insight" | "script") => {
    const defaults = getDefaultPromptConfig();
    setPromptConfig((prev) =>
      prev ? { ...prev, [type]: defaults[type] } : prev,
    );
    setSavedPrompt(false);
  }, []);

  const savePrompt = useCallback(async () => {
    if (!promptConfig) return;
    try {
      await updatePromptConfig(promptConfig);
      setSavedPrompt(true);
      setTimeout(() => setSavedPrompt(false), 2000);
    } catch (error) {
      console.error("Erro ao salvar prompt:", error);
    }
  }, [promptConfig]);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 1 }}>
          Configuração
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.6)" }}>
          Limites, prompts, integrações e parâmetros internos
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_e, v: number) => setActiveTab(v)}
        sx={{
          mb: 3,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          "& .MuiTab-root": { color: "rgba(255,255,255,0.5)", fontWeight: 600 },
          "& .Mui-selected": { color: "#2DD4FF" },
          "& .MuiTabs-indicator": { background: "#2DD4FF" },
        }}
      >
        <Tab label="Geral" />
        <Tab label="Echotik" />
        <Tab label="Hotmart" />
      </Tabs>

      {/* Tab 0 — Geral (Limites + Prompts) */}
      {activeTab === 0 && (
        <>
          {loading && <LinearProgress sx={{ mb: 3 }} />}
          <Grid container spacing={3}>
            <LimitsSection
              quotaPolicy={quotaPolicy}
              quotaUsage={quotaUsage}
              transcriptsLimit={transcriptsLimit}
              scriptsLimit={scriptsLimit}
              limitsSaved={limitsSaved}
              onTranscriptsLimitChange={setTranscriptsLimit}
              onScriptsLimitChange={setScriptsLimit}
              onSave={saveLimits}
            />

            <PromptsSection
              promptConfig={promptConfig}
              promptTab={promptTab}
              savedPrompt={savedPrompt}
              promptVariables={PROMPT_VARIABLES}
              onPromptTabChange={setPromptTab}
              onUpdateTemplate={updatePromptTemplate}
              onRestoreDefaults={restoreDefaults}
              onSave={savePrompt}
            />
          </Grid>
        </>
      )}

      {/* Tab 1 — Echotik */}
      {activeTab === 1 && <EchotikTab />}

      {/* Tab 2 — Hotmart */}
      {activeTab === 2 && <HotmartTab />}
    </Box>
  );
}
