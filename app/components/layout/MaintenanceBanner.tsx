"use client";

import { Box, Typography } from "@mui/material";
import { WarningAmberRounded, Close } from "@mui/icons-material";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr/fetcher";

interface BannerData {
  enabled: boolean;
  message: string;
}

/**
 * Faixa fina de aviso no topo da plataforma.
 *
 * Ligada e escrita pelo admin em Configuração → Aviso de indisponibilidade.
 * Serve para o caso em que a plataforma segue no ar mas algum recurso está
 * degradado — a alternativa hoje é o usuário descobrir sozinho pelo card que
 * não carrega.
 *
 * Revalida sozinha a cada minuto: quando o admin desliga o aviso, quem já
 * estava com a tela aberta para de ver sem precisar recarregar.
 */
export function MaintenanceBanner() {
  const { data } = useSWR<BannerData>("/api/maintenance-banner", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  // Dispensar vale só para a mensagem atual: se o admin trocar o texto, o
  // aviso novo reaparece mesmo para quem já tinha fechado o anterior.
  const [dispensada, setDispensada] = useState<string | null>(null);

  if (!data?.enabled || !data.message) return null;
  if (dispensada === data.message) return null;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: { xs: 1.25, sm: 2 },
        py: 0.65,
        flexShrink: 0,
        background:
          "linear-gradient(90deg, rgba(255,138,61,0.16), rgba(255,138,61,0.08))",
        borderBottom: "1px solid rgba(255,138,61,0.28)",
      }}
    >
      <WarningAmberRounded
        sx={{ fontSize: 16, color: "#FF8A3D", flexShrink: 0 }}
      />
      <Typography
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: { xs: "0.72rem", sm: "0.78rem" },
          fontWeight: 600,
          color: "rgba(255,255,255,0.88)",
          lineHeight: 1.35,
        }}
      >
        {data.message}
      </Typography>
      <Box
        component="button"
        aria-label="Dispensar aviso"
        onClick={() => setDispensada(data.message)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          p: 0.25,
          borderRadius: 1,
          color: "rgba(255,255,255,0.45)",
          "&:hover": { color: "rgba(255,255,255,0.85)" },
        }}
      >
        <Close sx={{ fontSize: 15 }} />
      </Box>
    </Box>
  );
}
