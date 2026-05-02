"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Typography, CircularProgress, Tabs, Tab } from "@mui/material";
import { AvatarsSection } from "./AvatarsSection";
import { ScenariosSection, type ScenarioRow } from "./ScenariosSection";
import { AvatarPromptsSection } from "./AvatarPromptsSection";

export interface AvatarRow {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export function AvatarVideoTab() {
  const [subTab, setSubTab] = useState(0);
  const [avatars, setAvatars] = useState<AvatarRow[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [avatarsRes, scenariosRes] = await Promise.all([
        fetch("/api/admin/avatar-video/avatars"),
        fetch("/api/admin/avatar-video/scenarios"),
      ]);
      if (avatarsRes.ok) {
        const data = await avatarsRes.json();
        setAvatars(data.avatars ?? []);
      }
      if (scenariosRes.ok) {
        const data = await scenariosRes.json();
        setScenarios(data.scenarios ?? []);
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
        Gerencie os avatares e cenários disponíveis para o Influencer IA. Apenas
        itens ativos aparecem para usuários finais.
      </Typography>

      <Tabs
        value={subTab}
        onChange={(_e, v: number) => setSubTab(v)}
        sx={{
          mb: 3,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          "& .MuiTab-root": { color: "rgba(255,255,255,0.5)", fontWeight: 600 },
          "& .Mui-selected": { color: "primary.main" },
          "& .MuiTabs-indicator": {
            background: "primary.main",
            bgcolor: "primary.main",
          },
        }}
      >
        <Tab label={`Avatares (${avatars.length})`} />
        <Tab label={`Cenários (${scenarios.length})`} />
        <Tab label="Prompts IA" />
      </Tabs>

      {subTab === 0 && <AvatarsSection avatars={avatars} onChanged={loadAll} />}
      {subTab === 1 && (
        <ScenariosSection scenarios={scenarios} onChanged={loadAll} />
      )}
      {subTab === 2 && <AvatarPromptsSection />}
    </Box>
  );
}
