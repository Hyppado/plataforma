import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  Typography,
  Divider,
  Stack,
  Box,
} from "@mui/material";
import {
  PersonOutlined,
  TrendingUpOutlined,
  AttachMoneyOutlined,
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
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
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
            subheader={metrics?.periodLabel ?? ""}
            titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
            subheaderTypographyProps={{ fontSize: "0.8rem" }}
          />
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                >
                  Total Recebido
                </Typography>
                <Typography
                  variant="h3"
                  sx={{ color: "#81C784", fontWeight: 700 }}
                >
                  {metrics
                    ? formatCurrency(metrics.revenueThisMonthCents)
                    : "—"}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </>
  );
}
