"use client";

import { Box, Typography } from "@mui/material";
import { useUserQuota } from "@/lib/swr/useUserQuota";

/**
 * Compact inline quota display for the top header bar.
 * Shows transcripts + scripts usage as mini bars side by side.
 */
export function HeaderQuota() {
  const quota = useUserQuota();
  const t = quota.transcripts;
  const s = quota.scripts;
  const av = quota.avatarVideos;
  const sd = quota.shopeeDownloads;

  const pct = (used: number, limit: number) =>
    limit > 0 && used > 0 ? Math.min(1, used / limit) : 0;

  const divider = (
    <Box
      sx={{
        width: "1px",
        height: 14,
        background: "rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}
    />
  );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 0.75, sm: 1.5 },
        px: { xs: 0.75, sm: 1.25 },
        py: 0.35,
        borderRadius: 1.5,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        // Quatro contadores não cabem em tela estreita. A saída não é rolar —
        // barra de rolagem dentro do header é invisível, e quem vê o corte
        // conclui que o contador não existe (foi o que aconteceu com o de
        // downloads da Shopee). Abaixo de `lg` os rótulos encurtam e as
        // barrinhas somem: o conjunto cai de ~680px para ~360px e cabe até em
        // janela estreita de desktop. A rolagem fica só como rede de segurança
        // para telas extremas, com um desvanecer na borda avisando que há mais.
        minWidth: 0,
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
        maskImage:
          "linear-gradient(to right, #000 calc(100% - 14px), transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, #000 calc(100% - 14px), transparent)",
      }}
    >
      <MiniQuotaBar
        label="Transcripts"
        shortLabel="Transcr."
        used={t.used}
        max={t.limit}
        pct={pct(t.used, t.limit)}
        color="#2DD4FF"
      />
      {divider}
      <MiniQuotaBar
        label="Scripts"
        shortLabel="Scripts"
        used={s.used}
        max={s.limit}
        pct={pct(s.used, s.limit)}
        color="#C7A3FF"
      />
      {divider}
      <MiniQuotaBar
        // "Vídeos" sozinho ficaria ambíguo agora que há dois contadores de
        // vídeo lado a lado. Este é o de geração com avatar.
        label="Vídeos IA"
        shortLabel="Vídeos IA"
        used={av.used}
        max={av.limit}
        pct={pct(av.used, av.limit)}
        color="#FF2D78"
      />
      {divider}
      <MiniQuotaBar
        // "/dia" no rótulo porque este é o único contador do header que zera
        // diariamente — sem isso, 0/10 ao lado de cotas mensais sugere mês.
        label="Downloads Shopee/dia"
        shortLabel="Shopee/dia"
        used={sd.used}
        max={sd.limit}
        pct={pct(sd.used, sd.limit)}
        color="#FF8A3D"
      />
    </Box>
  );
}

/* ---- internal ---- */

function formatDisplay(used: number | null, max: number | null): string {
  const usedStr = used !== null ? used.toLocaleString("pt-BR") : "—";
  const maxStr = max !== null && max > 0 ? max.toLocaleString("pt-BR") : "∞";
  return `${usedStr} / ${maxStr}`;
}

function MiniQuotaBar({
  label,
  shortLabel,
  used,
  max,
  pct,
  color,
}: {
  label: string;
  /** Versão curta para telas estreitas — quatro contadores não cabem. */
  shortLabel?: string;
  used: number | null;
  max: number | null;
  pct: number;
  color: string;
}) {
  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: { xs: 0.4, sm: 0.75 } }}
    >
      <Typography
        sx={{
          fontSize: { xs: "0.55rem", sm: "0.65rem" },
          fontWeight: 600,
          color: "rgba(255,255,255,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        <Box component="span" sx={{ display: { xs: "none", lg: "inline" } }}>
          {label}
        </Box>
        <Box component="span" sx={{ display: { xs: "inline", lg: "none" } }}>
          {shortLabel ?? label}
        </Box>
      </Typography>
      <Box
        sx={{
          width: { xs: 24, sm: 40 },
          height: 4,
          borderRadius: 999,
          background: `${color}20`,
          overflow: "hidden",
          flexShrink: 0,
          // A barrinha é enfeite: o número já diz tudo. Some cedo, para o
          // conjunto caber com folga em vez de depender de rolagem.
          display: { xs: "none", lg: "block" },
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${pct * 100}%`,
            background: `linear-gradient(90deg, ${color}F2, ${color}8C)`,
            boxShadow: `0 0 8px ${color}25`,
            transition: "width 200ms ease",
          }}
        />
      </Box>
      <Typography
        sx={{
          fontSize: { xs: "0.6rem", sm: "0.62rem" },
          fontWeight: 700,
          color,
          whiteSpace: "nowrap",
          textShadow: `0 0 10px ${color}20`,
        }}
      >
        {formatDisplay(used, max)}
      </Typography>
    </Box>
  );
}
