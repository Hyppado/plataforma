import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  Typography,
  Divider,
  Stack,
  Box,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  PersonOutlined,
  TrendingUpOutlined,
  AttachMoneyOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
} from "@mui/icons-material";
import type { SubscriptionMetrics } from "@/lib/types/admin";

function displayValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  return value;
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

interface MetricsCardsProps {
  metrics: SubscriptionMetrics | null;
  /** 1-based month currently selected */
  selectedMonth?: number;
  /** Full year currently selected */
  selectedYear?: number;
  /** Navigate to previous/next month */
  onMonthChange?: (month: number, year: number) => void;
}

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function MetricsCards({
  metrics,
  selectedMonth,
  selectedYear,
  onMonthChange,
}: MetricsCardsProps) {
  const now = new Date();
  const month = selectedMonth ?? now.getMonth() + 1;
  const year = selectedYear ?? now.getFullYear();
  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();

  const goPrev = () => {
    if (!onMonthChange) return;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    onMonthChange(m, y);
  };
  const goNext = () => {
    if (!onMonthChange || isCurrentMonth) return;
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    onMonthChange(m, y);
  };

  return (
    <>
      {/* Subscription Metrics */}
      <Grid item xs={12} md={4}>
        <Card sx={cardStyle}>
          <CardHeader
            avatar={<PersonOutlined sx={{ color: "#2DD4FF" }} />}
            title="Assinantes"
            subheader={metrics?.periodLabel ?? "Período atual"}
            titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
            subheaderTypographyProps={{ fontSize: "0.8rem" }}
          />
          <CardContent>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                  >
                    Ativos
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "#81C784", fontWeight: 700 }}
                  >
                    {displayValue(metrics?.activeSubscribers)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                  >
                    Cancelados
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "#FFB74D", fontWeight: 700 }}
                  >
                    {displayValue(metrics?.canceledSubscribers)}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                  >
                    Inadimplentes
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: "#EF5350", fontWeight: 600 }}
                  >
                    {displayValue(metrics?.pastDueSubscribers)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                  >
                    Total Geral
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: "#fff", fontWeight: 600 }}
                  >
                    {displayValue(metrics?.totalSubscribers)}
                  </Typography>
                </Box>
              </Box>
              {metrics?.lastSyncAt && (
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Último webhook:{" "}
                  {new Date(metrics.lastSyncAt).toLocaleString("pt-BR")}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Monthly Stats */}
      <Grid item xs={12} md={4}>
        <Card sx={cardStyle}>
          <CardHeader
            avatar={<TrendingUpOutlined sx={{ color: "#2DD4FF" }} />}
            title="Este Mês"
            subheader={metrics?.periodLabel ?? ""}
            titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
            subheaderTypographyProps={{ fontSize: "0.8rem" }}
          />
          <CardContent>
            <Stack spacing={2.5}>
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                >
                  Novos Assinantes
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ color: "#81C784", fontWeight: 700 }}
                >
                  {displayValue(metrics?.newThisMonth)}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                >
                  Cancelamentos no Mês
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ color: "#FFB74D", fontWeight: 700 }}
                >
                  {displayValue(metrics?.cancelledThisMonth)}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Revenue */}
      <Grid item xs={12} md={4}>
        <Card sx={cardStyle}>
          <CardHeader
            avatar={<AttachMoneyOutlined sx={{ color: "#81C784" }} />}
            title="Receita do Mês"
            subheader={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Tooltip title="Mês anterior">
                  <span>
                    <IconButton
                      size="small"
                      onClick={goPrev}
                      disabled={!onMonthChange}
                      sx={{ color: "rgba(255,255,255,0.6)", p: 0.25 }}
                    >
                      <ChevronLeftOutlined fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 110, textAlign: "center" }}
                >
                  {`${MONTH_LABELS[month - 1]} ${year}`}
                </Typography>
                <Tooltip title="Próximo mês">
                  <span>
                    <IconButton
                      size="small"
                      onClick={goNext}
                      disabled={!onMonthChange || isCurrentMonth}
                      sx={{ color: "rgba(255,255,255,0.6)", p: 0.25 }}
                    >
                      <ChevronRightOutlined fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            }
            titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          />
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                >
                  Faturado (total do período)
                </Typography>
                <Typography
                  variant="h3"
                  sx={{ color: "#81C784", fontWeight: 700 }}
                >
                  {metrics
                    ? formatCurrency(metrics.revenueThisMonthCents)
                    : "—"}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Aprovado + liquidado no período
                </Typography>
              </Box>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                >
                  Liquidado (concluído)
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ color: "primary.main", fontWeight: 700 }}
                >
                  {metrics
                    ? formatCurrency(metrics.revenueCompletedCents)
                    : "—"}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Após janela de estorno (pode incluir compras anteriores)
                </Typography>
              </Box>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                >
                  Previsto (pendente)
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ color: "#FFB74D", fontWeight: 700 }}
                >
                  {metrics
                    ? formatCurrency(metrics.revenueApprovedCents)
                    : "—"}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Aprovado, ainda dentro da janela de estorno
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </>
  );
}
