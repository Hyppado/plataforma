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
} from "@mui/material";
import { PersonOutlined } from "@mui/icons-material";
import type { Subscriber, SubscriptionMetrics } from "@/lib/types/admin";

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
              label={`Inadimplentes (${metrics?.pastDueSubscribers ?? "—"})`}
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
                    "Último Pgto",
                    "Desde",
                  ].map((h) => (
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
                      <TableCell
                        sx={{
                          color: "rgba(255,255,255,0.8)",
                          borderColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {sub.name ?? "—"}
                      </TableCell>
                      <TableCell
                        sx={{
                          color: "rgba(255,255,255,0.6)",
                          borderColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {sub.email ?? "—"}
                      </TableCell>
                      <TableCell sx={{ borderColor: "rgba(255,255,255,0.06)" }}>
                        <Tooltip
                          title={`${sub.plan.code} — ${sub.plan.displayPrice ?? ""}`}
                        >
                          <Chip
                            label={sub.plan.name}
                            size="small"
                            sx={{
                              background: "rgba(45, 212, 255, 0.1)",
                              color: "#2DD4FF",
                              fontSize: "0.75rem",
                            }}
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
                      <TableCell
                        sx={{
                          color: "rgba(255,255,255,0.6)",
                          borderColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {sub.lastPaymentAt
                          ? new Date(sub.lastPaymentAt).toLocaleDateString(
                              "pt-BR",
                            )
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
                      <TableCell
                        sx={{
                          color: "rgba(255,255,255,0.5)",
                          borderColor: "rgba(255,255,255,0.06)",
                          fontSize: "0.8rem",
                        }}
                      >
                        {sub.startedAt
                          ? new Date(sub.startedAt).toLocaleDateString("pt-BR")
                          : sub.createdAt
                            ? new Date(sub.createdAt).toLocaleDateString(
                                "pt-BR",
                              )
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
  );
}
