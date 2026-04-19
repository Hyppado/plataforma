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

  const pct = (used: number, limit: number) =>
    limit > 0 && used > 0 ? Math.min(1, used / limit) : 0;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 1, sm: 1.5 },
        px: { xs: 0.75, sm: 1.25 },
        py: 0.35,
        borderRadius: 1.5,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <MiniQuotaBar
        label="Transcripts"
        used={t.used}
        max={t.limit}
        pct={pct(t.used, t.limit)}
        color="#2DD4FF"
      />
      <Box
        sx={{
          width: "1px",
          height: 18,
          background: "rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}
      />
      <MiniQuotaBar
        label="Scripts"
        used={s.used}
        max={s.limit}
        pct={pct(s.used, s.limit)}
        color="#C7A3FF"
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
  used,
  max,
  pct,
  color,
}: {
  label: string;
  used: number | null;
  max: number | null;
  pct: number;
  color: string;
}) {
  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 0.75 } }}
    >
      <Typography
        sx={{
          fontSize: { xs: "0.6rem", sm: "0.65rem" },
          fontWeight: 600,
          color: "rgba(255,255,255,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          width: { xs: 28, sm: 40 },
          height: 4,
          borderRadius: 999,
          background: `${color}20`,
          overflow: "hidden",
          flexShrink: 0,
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
          fontSize: { xs: "0.56rem", sm: "0.62rem" },
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
