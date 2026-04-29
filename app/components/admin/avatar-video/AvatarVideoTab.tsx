"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Typography, Tabs, Tab, CircularProgress } from "@mui/material";
import { AvatarsSection } from "./AvatarsSection";
import { ScenariosSection } from "./ScenariosSection";
import { TemplatesSection } from "./TemplatesSection";

export interface AvatarRow {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ScenarioRow {
  id: string;
  name: string;
  description: string | null;
  promptHint: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export function AvatarVideoTab() {
  const [activeSubtab, setActiveSubtab] = useState(0);
  const [avatars, setAvatars] = useState<AvatarRow[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [conceptTemplate, setConceptTemplate] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [imageTemplate, setImageTemplate] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [avRes, scRes, tplRes] = await Promise.all([
        fetch("/api/admin/avatar-video/avatars"),
        fetch("/api/admin/avatar-video/scenarios"),
        fetch("/api/admin/avatar-video/templates"),
      ]);

      if (avRes.ok) {
        const data = await avRes.json();
        setAvatars(data.avatars ?? []);
      }
      if (scRes.ok) {
        const data = await scRes.json();
        setScenarios(data.scenarios ?? []);
      }
      if (tplRes.ok) {
        const data = await tplRes.json();
        setConceptTemplate(data.conceptTemplate ?? "");
        setPromptTemplate(data.promptTemplate ?? "");
        setImageTemplate(data.imageTemplate ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="body2"
        sx={{ color: "rgba(255,255,255,0.6)", mb: 2 }}
      >
        Gerencie avatares, cenários de vídeo e templates de prompts usados pelo
        Avatar Video. Apenas registros ativos aparecem para usuários finais.
      </Typography>

      <Tabs
        value={activeSubtab}
        onChange={(_e, v: number) => setActiveSubtab(v)}
        sx={{
          mb: 3,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          "& .MuiTab-root": {
            color: "rgba(255,255,255,0.5)",
            fontWeight: 600,
          },
          "& .Mui-selected": { color: "primary.main" },
          "& .MuiTabs-indicator": { backgroundColor: "primary.main" },
        }}
      >
        <Tab label="Avatares" />
        <Tab label="Cenários" />
        <Tab label="Templates de Prompt" />
      </Tabs>

      {activeSubtab === 0 && (
        <AvatarsSection avatars={avatars} onChanged={loadAll} />
      )}
      {activeSubtab === 1 && (
        <ScenariosSection scenarios={scenarios} onChanged={loadAll} />
      )}
      {activeSubtab === 2 && (
        <TemplatesSection
          initialConceptTemplate={conceptTemplate}
          initialPromptTemplate={promptTemplate}
          initialImageTemplate={imageTemplate}
          onSaved={loadAll}
        />
      )}
    </Box>
  );
}
