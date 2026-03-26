"use client";

import { Box, Typography } from "@mui/material";
import { useQuotaUsage, formatQuotaDisplay } from "@/lib/admin/useQuotaUsage";

/** Compact quota usage block for the sidebar */
export function SidebarQuota() {
  const quota = useQuotaUsage();
  const t = quota.transcripts;
  const s = quota.scripts;

  const pct = (used: number | null, max: number | null) =>
    max && used ? Math.min(1, Math.max(0, used / max)) : 0;

  return (
    <Box sx={{ mt: 2, px: 0.5 }}>
      <Box
        sx={{
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          backdropFilter: "blur(10px)",
          px: 1.5,
          py: 1.25,
          transition: "transform 160ms ease, border-color 160ms ease",
          "&:hover": {
            borderColor: "rgba(255,255,255,0.16)",
            transform: "translateY(-1px)",
          },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.7rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "rgba(255,255,255,0.62)",
            mb: 1,
          }}
        >
          Uso do mês
        </Typography>

        {/* Transcripts */}
        <QuotaBar
          label="Transcripts"
          used={t.used}
          max={t.max}
          pct={pct(t.used, t.max)}
          color="#2DD4FF"
        />

        {/* Scripts */}
        <QuotaBar
          label="Scripts"
          used={s.used}
          max={s.max}
          pct={pct(s.used, s.max)}
          color="#C7A3FF"
          isLast
        />
      </Box>
    </Box>
  );
}

/* ---- internal ---- */

function QuotaBar({
  label,
  used,
  max,
  pct,
  color,
  isLast,
}: {
  label: string;
  used: number | null;
  max: number | null;
  pct: number;
  color: string;
  isLast?: boolean;
}) {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.78rem",
            fontWeight: 600,
            color,
            textShadow: `0 0 14px ${color}30`,
          }}
        >
          {formatQuotaDisplay(used, max)}
        </Typography>
      </Box>
      <Box sx={{ mt: 0.5, mb: isLast ? 0 : 1 }}>
        <Box
          sx={{
            height: 6,
            borderRadius: 999,
            background: `${color}24`,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${pct * 100}%`,
              background: `linear-gradient(90deg, ${color}F2, ${color}8C)`,
              boxShadow: `0 0 18px ${color}30`,
              transition: "width 200ms ease",
            }}
          />
        </Box>
      </Box>
    </>
  );
}
