import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tabs,
  Tab,
  Tooltip,
  Box,
} from "@mui/material";
import { PersonOutlined } from "@mui/icons-material";
import type { Subscriber, SubscriptionMetrics } from "@/lib/types/admin";

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

/** Map internal status to display label */
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "Ativo",
    CANCELED: "Cancelado",
    PAST_DUE: "Inadimplente",
    PENDING: "Pendente",
    EXPIRED: "Expirado",
  };
  return map[status] ?? status;
}

/** Map raw Hotmart status to a human-readable label */
function hotmartStatusLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const map: Record<string, string> = {
    ACTIVE: "Ativo",
    CANCELLED_BY_CUSTOMER: "Cancelado pelo cliente",
    CANCELLED_BY_SELLER: "Cancelado pelo vendedor",
    CANCELLED_BY_ADMIN: "Reembolsado",
    DELAYED: "Pagamento atrasado",
    OVERDUE: "Inadimplente",
    STARTED: "Aguardando pagamento",
    INACTIVE: "Boleto expirado",
  };
  return map[raw] ?? raw.replace(/_/g, " ").toLowerCase();
}

/** Color for raw Hotmart status badge */
function hotmartStatusColor(
  raw: string | null | undefined,
): { bg: string; fg: string } | null {
  switch (raw) {
    case "STARTED":
      return { bg: "rgba(66, 165, 245, 0.15)", fg: "#42A5F5" };
    case "INACTIVE":
      return { bg: "rgba(255, 152, 0, 0.15)", fg: "#FFA726" };
    default:
      return null;
  }
}

/** Status chip color */
function statusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case "ACTIVE":
      return { bg: "rgba(76, 175, 80, 0.15)", fg: "#81C784" };
    case "PAST_DUE":
      return { bg: "rgba(255, 183, 77, 0.15)", fg: "#FFB74D" };
    case "PENDING":
      return { bg: "rgba(66, 165, 245, 0.15)", fg: "#42A5F5" };
    default:
      return { bg: "rgba(244, 67, 54, 0.15)", fg: "#EF5350" };
  }
}

interface SubscribersTableProps {
  subscribers: Subscriber[];
  totalSubscribers: number;
  metrics: SubscriptionMetrics | null;
  loading: boolean;
  subscriberTab: number;
  subscriberSearch: string;
  onTabChange: (tab: number) => void;
  onSearchChange: (search: string) => void;
}

export function SubscribersTable({
  subscribers,
  totalSubscribers,
  metrics,
  loading,
  subscriberTab,
  subscriberSearch,
  onTabChange,
  onSearchChange,
}: SubscribersTableProps) {
  const cellSx = {
    color: "rgba(255,255,255,0.6)",
    borderColor: "rgba(255,255,255,0.06)",
    fontSize: "0.8rem",
    py: 1,
  };

  const headSx = {
    color: "rgba(255,255,255,0.5)",
    borderColor: "rgba(255,255,255,0.06)",
    fontWeight: 600,
    fontSize: "0.75rem",
    whiteSpace: "nowrap" as const,
  };

  return (
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
              onChange={(e) => onSearchChange(e.target.value)}
              sx={{
                width: 280,
                "& .MuiOutlinedInput-root": {
                  background: "rgba(0,0,0,0.2)",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                },
                "& .MuiOutlinedInput-input": {
                  color: "#fff",
                  fontSize: "0.85rem",
                },
              }}
            />
          }
        />
        <CardContent>
          <Tabs
            value={subscriberTab}
            onChange={(_, v) => onTabChange(v)}
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
            <Tab
              label={`Cancelados (${metrics?.canceledSubscribers ?? "—"})`}
            />
            <Tab
              label={`Reembolsados (${metrics?.refundedSubscribers ?? "—"})`}
            />
            <Tab
              label={`Inadimplentes (${metrics?.pastDueSubscribers ?? "—"})`}
            />
            <Tab
              label={`Compra não finalizada (${metrics?.pendingSubscribers ?? "—"})`}
            />
          </Tabs>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {[
                    "Nome",
                    "Email",
                    "Plano",
                    "Status",
                    "Status Hotmart",
                    "Próx. Cobrança",
                    "Últ. Pgto",
                    "Desde",
                  ].map((h) => (
                    <TableCell key={h} sx={headSx}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {subscribers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
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
                  subscribers.map((sub) => {
                    const sc = statusColor(sub.status);
                    const isCanceled =
                      sub.status === "CANCELED" || sub.status === "EXPIRED";

                    return (
                      <TableRow key={sub.id}>
                        {/* Nome */}
                        <TableCell
                          sx={{ ...cellSx, color: "rgba(255,255,255,0.8)" }}
                        >
                          {sub.name ?? "—"}
                          {sub.trial && (
                            <Chip
                              label="Trial"
                              size="small"
                              sx={{
                                ml: 0.5,
                                height: 18,
                                fontSize: "0.65rem",
                                background: "rgba(156,39,176,0.15)",
                                color: "#CE93D8",
                              }}
                            />
                          )}
                        </TableCell>

                        {/* Email */}
                        <TableCell sx={cellSx}>{sub.email ?? "—"}</TableCell>

                        {/* Plano */}
                        <TableCell sx={{ ...cellSx, maxWidth: 160 }}>
                          <Tooltip
                            title={`${sub.plan.code} — ${sub.plan.displayPrice ?? ""}${sub.recurrencyPeriod ? " / " + sub.recurrencyPeriod : ""}${sub.maxChargeCycles ? " (×" + sub.maxChargeCycles + ")" : ""}`}
                          >
                            <Chip
                              label={sub.plan.name}
                              size="small"
                              sx={{
                                background: "rgba(45, 212, 255, 0.1)",
                                color: "#2DD4FF",
                                fontSize: "0.75rem",
                                maxWidth: 150,
                              }}
                            />
                          </Tooltip>
                          {sub.plan.displayPrice && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                color: "rgba(255,255,255,0.35)",
                                fontSize: "0.7rem",
                                mt: 0.2,
                              }}
                            >
                              {sub.plan.displayPrice}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Status interno */}
                        <TableCell sx={cellSx}>
                          <Chip
                            label={statusLabel(sub.status)}
                            size="small"
                            sx={{
                              background: sc.bg,
                              color: sc.fg,
                              fontSize: "0.75rem",
                            }}
                          />
                        </TableCell>

                        {/* Status Hotmart (raw) */}
                        <TableCell sx={cellSx}>
                          {(() => {
                            const hc = hotmartStatusColor(sub.hotmartStatus);
                            return hc ? (
                              <Chip
                                label={hotmartStatusLabel(sub.hotmartStatus)}
                                size="small"
                                sx={{
                                  background: hc.bg,
                                  color: hc.fg,
                                  fontSize: "0.75rem",
                                }}
                              />
                            ) : (
                              <Tooltip title={sub.hotmartStatus ?? "—"}>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "rgba(255,255,255,0.5)",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  {hotmartStatusLabel(sub.hotmartStatus)}
                                </Typography>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>

                        {/* Próx. Cobrança / Fim */}
                        <TableCell sx={cellSx}>
                          {isCanceled ? (
                            <Box>
                              <Typography
                                variant="caption"
                                sx={{ color: "#EF5350", fontSize: "0.75rem" }}
                              >
                                {sub.endDate
                                  ? "Fim: " + formatDate(sub.endDate)
                                  : "—"}
                              </Typography>
                              {sub.requestDate && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: "block",
                                    color: "rgba(255,255,255,0.3)",
                                    fontSize: "0.65rem",
                                  }}
                                >
                                  Solicitado: {formatDate(sub.requestDate)}
                                </Typography>
                              )}
                            </Box>
                          ) : sub.nextChargeAt ? (
                            <Typography
                              variant="caption"
                              sx={{ color: "#81C784", fontSize: "0.75rem" }}
                            >
                              {formatDate(sub.nextChargeAt)}
                            </Typography>
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        {/* Últ. Pgto */}
                        <TableCell sx={cellSx}>
                          {sub.lastPaymentAt
                            ? formatDate(sub.lastPaymentAt)
                            : "—"}
                          {sub.lastPaymentAmount != null && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                color: "rgba(255,255,255,0.4)",
                              }}
                            >
                              {formatCurrency(sub.lastPaymentAmount)}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Desde */}
                        <TableCell sx={cellSx}>
                          {formatDate(sub.startedAt ?? sub.createdAt)}
                          {sub.subscriberCode && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                color: "rgba(255,255,255,0.25)",
                                fontSize: "0.65rem",
                              }}
                            >
                              {sub.subscriberCode}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Grid>
  );
}
