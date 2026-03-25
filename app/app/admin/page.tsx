"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Grid,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  Stack,
} from "@mui/material";
import {
  PersonOutlined,
  ConfirmationNumberOutlined,
  TrendingUpOutlined,
  AttachMoneyOutlined,
} from "@mui/icons-material";
import type { Subscriber, SubscriptionMetrics } from "@/lib/types/admin";
import {
  getSubscribers,
  getSubscriptionMetrics,
} from "@/lib/admin/admin-client";

// Helper to display value or "—" if null/undefined
function displayValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  return value;
}

// Format cents to BRL currency
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

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "ADMIN") {
      router.replace("/app/videos");
    }
  }, [session, status, router]);

  if (status === "loading" || !session || session.user?.role !== "ADMIN") {
    return null;
  }

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriberTab, setSubscriberTab] = useState(0);
  const [subscriberSearch, setSubscriberSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter =
        subscriberTab === 0
          ? "active"
          : subscriberTab === 1
            ? "canceled"
            : "past_due";
      const [subsData, metricsData] = await Promise.all([
        getSubscribers(statusFilter, 1, 100, subscriberSearch || undefined),
        getSubscriptionMetrics(),
      ]);
      setSubscribers(subsData.subscribers);
      setTotalSubscribers(subsData.pagination.total);
      setMetrics(metricsData);
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setLoading(false);
    }
  }, [subscriberTab, subscriberSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <Box>
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 1 }}>
            Admin
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.6)" }}>
            Assinantes, métricas e operações
          </Typography>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Grid container spacing={3}>
        {/* ==================== Subscription Metrics ==================== */}
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
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}>
                      Ativos
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#81C784", fontWeight: 700 }}>
                      {displayValue(metrics?.activeSubscribers)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}>
                      Cancelados
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#FFB74D", fontWeight: 700 }}>
                      {displayValue(metrics?.canceledSubscribers)}
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}>
                      Inadimplentes
                    </Typography>
                    <Typography variant="h5" sx={{ color: "#EF5350", fontWeight: 600 }}>
                      {displayValue(metrics?.pastDueSubscribers)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}>
                      Total Geral
                    </Typography>
                    <Typography variant="h5" sx={{ color: "#fff", fontWeight: 600 }}>
                      {displayValue(metrics?.totalSubscribers)}
                    </Typography>
                  </Box>
                </Box>
                {metrics?.lastSyncAt && (
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                    Último webhook: {new Date(metrics.lastSyncAt).toLocaleString("pt-BR")}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ==================== Monthly Stats ==================== */}
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
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}>
                    Novos Assinantes
                  </Typography>
                  <Typography variant="h4" sx={{ color: "#81C784", fontWeight: 700 }}>
                    {displayValue(metrics?.newThisMonth)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}>
                    Cancelamentos no Mês
                  </Typography>
                  <Typography variant="h4" sx={{ color: "#FFB74D", fontWeight: 700 }}>
                    {displayValue(metrics?.cancelledThisMonth)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ==================== Revenue ==================== */}
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
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5 }}>
                    Total Recebido
                  </Typography>
                  <Typography variant="h3" sx={{ color: "#81C784", fontWeight: 700 }}>
                    {metrics ? formatCurrency(metrics.revenueThisMonthCents) : "—"}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ==================== Coupons (Coming Soon) ==================== */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={cardStyle}>
            <CardHeader
              avatar={<ConfirmationNumberOutlined sx={{ color: "#2DD4FF" }} />}
              title="Cupons"
              subheader="Gerenciamento de cupons"
              titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
              subheaderTypographyProps={{ fontSize: "0.8rem" }}
            />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label="Código do Cupom"
                  placeholder="Ex: DESCONTO20"
                  disabled
                  fullWidth
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { background: "rgba(0,0,0,0.2)" } }}
                />
                <TextField
                  label="Desconto (%)"
                  placeholder="Ex: 20"
                  disabled
                  fullWidth
                  size="small"
                  type="number"
                  sx={{ "& .MuiOutlinedInput-root": { background: "rgba(0,0,0,0.2)" } }}
                />
                <Button
                  variant="contained"
                  disabled
                  sx={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}
                >
                  Em breve
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ==================== Subscribers Table ==================== */}
        <Grid item xs={12}>
          <Card sx={cardStyle}>
            <CardHeader
              avatar={<PersonOutlined sx={{ color: "#2DD4FF" }} />}
              title="Assinantes"
              subheader={`${totalSubscribers} assinante(s) encontrado(s)`}
              titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
              subheaderTypographyProps={{ fontSize: "0.8rem" }}
              action={
                <TextField
                  placeholder="Buscar por nome ou email..."
                  size="small"
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  sx={{
                    width: 280,
                    "& .MuiOutlinedInput-root": {
                      background: "rgba(0,0,0,0.2)",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                    },
                    "& .MuiOutlinedInput-input": { color: "#fff", fontSize: "0.85rem" },
                  }}
                />
              }
            />
            <CardContent>
              <Tabs
                value={subscriberTab}
                onChange={(_, v) => setSubscriberTab(v)}
                sx={{
                  mb: 2,
                  "& .MuiTab-root": {
                    color: "rgba(255,255,255,0.5)",
                    "&.Mui-selected": { color: "#2DD4FF" },
                  },
                  "& .MuiTabs-indicator": { background: "#2DD4FF" },
                }}
              >
                <Tab label={`Ativos (${metrics?.activeSubscribers ?? "—"})`} />
                <Tab label={`Cancelados (${metrics?.canceledSubscribers ?? "—"})`} />
                <Tab label={`Inadimplentes (${metrics?.pastDueSubscribers ?? "—"})`} />
              </Tabs>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {["Nome", "Email", "Plano", "Status", "Último Pgto", "Desde"].map((h) => (
                        <TableCell
                          key={h}
                          sx={{
                            color: "rgba(255,255,255,0.5)",
                            borderColor: "rgba(255,255,255,0.06)",
                            fontWeight: 600,
                          }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subscribers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          sx={{
                            color: "rgba(255,255,255,0.4)",
                            borderColor: "rgba(255,255,255,0.06)",
                            textAlign: "center",
                            py: 4,
                          }}
                        >
                          {loading
                            ? "Carregando..."
                            : "Nenhum assinante encontrado para o filtro selecionado."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      subscribers.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell sx={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
                            {sub.name ?? "—"}
                          </TableCell>
                          <TableCell sx={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.06)" }}>
                            {sub.email ?? "—"}
                          </TableCell>
                          <TableCell sx={{ borderColor: "rgba(255,255,255,0.06)" }}>
                            <Tooltip title={`${sub.plan.code} — ${sub.plan.displayPrice ?? ""}`}>
                              <Chip
                                label={sub.plan.name}
                                size="small"
                                sx={{ background: "rgba(45, 212, 255, 0.1)", color: "#2DD4FF", fontSize: "0.75rem" }}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ borderColor: "rgba(255,255,255,0.06)" }}>
                            <Chip
                              label={
                                sub.status === "ACTIVE"
                                  ? "Ativo"
                                  : sub.status === "CANCELED"
                                    ? "Cancelado"
                                    : sub.status === "PAST_DUE"
                                      ? "Inadimplente"
                                      : sub.status
                              }
                              size="small"
                              sx={{
                                background:
                                  sub.status === "ACTIVE"
                                    ? "rgba(76, 175, 80, 0.15)"
                                    : sub.status === "PAST_DUE"
                                      ? "rgba(255, 183, 77, 0.15)"
                                      : "rgba(244, 67, 54, 0.15)",
                                color:
                                  sub.status === "ACTIVE"
                                    ? "#81C784"
                                    : sub.status === "PAST_DUE"
                                      ? "#FFB74D"
                                      : "#EF5350",
                                fontSize: "0.75rem",
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.06)" }}>
                            {sub.lastPaymentAt
                              ? new Date(sub.lastPaymentAt).toLocaleDateString("pt-BR")
                              : "—"}
                            {sub.lastPaymentAmount != null && (
                              <Typography
                                variant="caption"
                                sx={{ display: "block", color: "rgba(255,255,255,0.4)" }}
                              >
                                {formatCurrency(sub.lastPaymentAmount)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell
                            sx={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.06)", fontSize: "0.8rem" }}
                          >
                            {sub.startedAt
                              ? new Date(sub.startedAt).toLocaleDateString("pt-BR")
                              : sub.createdAt
                                ? new Date(sub.createdAt).toLocaleDateString("pt-BR")
                                : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
