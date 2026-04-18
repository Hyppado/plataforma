import { Box, Typography } from "@mui/material";
import { formatCurrency, formatNumber } from "@/lib/format";
import { UI } from "./videoCardConfig";

interface VideoCardMetricsProps {
  revenueBRL: number;
  views: number;
  sales: number;
  currency?: string;
  usdToBrl?: number | null;
}

/** Metrics row (revenue, views, sales) for VideoCard */
export function VideoCardMetrics({
  revenueBRL,
  views,
  sales,
  currency,
  usdToBrl,
}: VideoCardMetricsProps) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 1,
        mb: { xs: 1.1, md: 1.3 },
        px: { xs: 0.5, md: 0.75 },
      }}
    >
      <MetricCell
        value={
          revenueBRL > 0 ? formatCurrency(revenueBRL, currency, usdToBrl) : "-"
        }
        label="Receita"
        color={UI.accent}
      />
      <MetricCell
        value={views > 0 ? formatNumber(views) : "-"}
        label="Views"
        color={UI.text.primary}
      />
      <MetricCell
        value={sales > 0 ? formatNumber(sales) : "-"}
        label="Vendas"
        color={UI.text.primary}
      />
    </Box>
  );
}

/* ---- internal ---- */

function MetricCell({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <Box sx={{ flex: 1, textAlign: "center" }}>
      <Typography
        sx={{
          fontSize: { xs: "0.92rem", md: "0.98rem" },
          fontWeight: 700,
          color,
          mb: 0.2,
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: "0.68rem", md: "0.72rem" },
          color: UI.text.muted,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
