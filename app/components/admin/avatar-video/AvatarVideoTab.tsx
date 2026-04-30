"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { AvatarsSection } from "./AvatarsSection";

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
  const [avatars, setAvatars] = useState<AvatarRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/avatar-video/avatars");
      if (res.ok) {
        const data = await res.json();
        setAvatars(data.avatars ?? []);
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
        Gerencie os avatares disponíveis para o Influencer IA. Apenas avatares
        ativos aparecem para usuários finais.
      </Typography>

      <AvatarsSection avatars={avatars} onChanged={loadAll} />
    </Box>
  );
}
