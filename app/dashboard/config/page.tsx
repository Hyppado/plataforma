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
import { getPromptConfig, updatePromptConfig } from "@/lib/admin/admin-client";
import {
  PROMPT_VARIABLES,
  getDefaultPromptConfig,
} from "@/lib/admin/config-defaults";
import type { PromptConfig } from "@/lib/types/admin";
import { PromptsSection } from "@/app/components/admin/PromptsSection";
import { PrivacyPolicySection } from "@/app/components/admin/PrivacyPolicySection";
import { EchotikTab } from "@/app/components/admin/echotik/EchotikTab";
import { HotmartTab } from "@/app/components/admin/hotmart/HotmartTab";
import { OpenAITab } from "@/app/components/admin/openai/OpenAITab";
import { UsersTab } from "@/app/components/admin/users/UsersTab";
import CircularProgress from "@mui/material/CircularProgress";

export default function ConfigPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [activeTab, setActiveTab] = useState(0);

  // Data state (for Geral tab)
  const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);
  const [promptTab, setPromptTab] = useState(0);
  const [savedPrompt, setSavedPrompt] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const prompt = await getPromptConfig();
      setPromptConfig(prompt);
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

  if (status === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

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
        <Tab label="Usuários" />
        <Tab label="Echotik" />
        <Tab label="Hotmart" />
        <Tab label="OpenAI" />
      </Tabs>

      {/* Tab 0 — Geral (Prompts) */}
      {activeTab === 0 && (
        <>
          {loading && <LinearProgress sx={{ mb: 3 }} />}
          <Grid container spacing={3}>
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
            <PrivacyPolicySection />
          </Grid>
        </>
      )}

      {/* Tab 1 — Usuários */}
      {activeTab === 1 && <UsersTab />}

      {/* Tab 2 — Echotik */}
      {activeTab === 2 && <EchotikTab />}

      {/* Tab 3 — Hotmart */}
      {activeTab === 3 && <HotmartTab />}

      {/* Tab 4 — OpenAI */}
      {activeTab === 4 && <OpenAITab />}
    </Box>
  );
}
