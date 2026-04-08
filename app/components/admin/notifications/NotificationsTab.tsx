"use client";

import { useState, useCallback, useTransition } from "react";
import useSWR from "swr";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Pagination,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutline,
  MarkEmailRead as MarkReadIcon,
  MarkEmailUnread as MarkUnreadIcon,
  NotificationsActive as CriticalIcon,
  NotificationsNone as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationUser {
  id: string;
  email: string | null;
  name: string | null;
  status?: string | null;
}

interface NotificationSubscription {
  id: string;
  status: string;
  source?: string | null;
  startedAt?: string | null;
  plan: { name: string; hotmartPlanCode?: string | null } | null;
  hotmart?: {
    subscriberCode?: string | null;
    hotmartSubscriptionId?: string | null;
    buyerEmail?: string | null;
    externalStatus?: string | null;
  } | null;
}

interface NotificationEvent {
  id: string;
  eventType: string;
  processingStatus: string;
  transactionId?: string | null;
  subscriberCode?: string | null;
  buyerEmail?: string | null;
  productId?: string | null;
  amountCents?: number | null;
  occurredAt?: string | null;
  receivedAt?: string | null;
  processedAt?: string | null;
  errorMessage?: string | null;
}

interface AdminNotification {
  id: string;
  source: string;
  type: string;
  severity: "INFO" | "WARNING" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  status: "UNREAD" | "READ" | "ARCHIVED";
  readAt: string | null;
  archivedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  user: NotificationUser | null;
  subscription: NotificationSubscription | null;
  event: NotificationEvent | null;
}

interface NotificationsResponse {
  items: AdminNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SummaryResponse {
  unread: number;
  critical: number;
  total: number;
}

type StatusFilter = "UNREAD" | "READ" | "ALL";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

const SEVERITY_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  CRITICAL: {
    icon: <CriticalIcon sx={{ fontSize: 16 }} />,
    color: "#f44336",
    label: "Crítico",
  },
  HIGH: {
    icon: <ErrorIcon sx={{ fontSize: 16 }} />,
    color: "#ff9800",
    label: "Alto",
  },
  WARNING: {
    icon: <WarningIcon sx={{ fontSize: 16 }} />,
    color: "#ffc107",
    label: "Atenção",
  },
  INFO: {
    icon: <InfoIcon sx={{ fontSize: 16 }} />,
    color: "#2DD4FF",
    label: "Info",
  },
};

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventType(raw: string): string {
  const map: Record<string, string> = {
    SUBSCRIPTION_CHARGEBACK: "Chargeback",
    SUBSCRIPTION_CANCELED: "Cancelamento",
    SUBSCRIPTION_REFUNDED: "Reembolso",
    SUBSCRIPTION_DELAYED: "Pagamento em atraso",
    SUBSCRIPTION_CANCELLATION: "Cancelamento definitivo",
    SUBSCRIPTION_ACTIVATED: "Nova assinatura",
    WEBHOOK_INVALID: "Webhook inválido",
    PROCESSING_FAILED: "Falha no processamento",
    IDENTITY_UNRESOLVED: "Identidade não resolvida",
    SUSPENDED_USER_PURCHASE: "Compra de suspenso",
    PURCHASE_APPROVED: "Compra aprovada",
    PURCHASE_CANCELED: "Compra cancelada",
    PURCHASE_CANCELLED: "Compra cancelada",
    PURCHASE_REFUNDED: "Reembolso",
    PURCHASE_CHARGEBACK: "Chargeback",
    PURCHASE_DELAYED: "Pagamento atrasado",
    PURCHASE_COMPLETE: "Compra completa",
  };
  return map[raw] ?? raw.replace(/_/g, " ").toLowerCase();
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

/** Build a concise one-line summary for the notification row */
function buildSummary(n: AdminNotification): string {
  const parts: string[] = [];

  const name = n.user?.name ?? n.event?.buyerEmail ?? n.user?.email;
  if (name) parts.push(name);

  const plan = n.subscription?.plan?.name;
  if (plan) parts.push(plan);

  const amount =
    n.event?.amountCents ??
    (typeof n.metadata?.amountCents === "number"
      ? n.metadata.amountCents
      : null);
  if (amount != null) parts.push(formatCurrency(amount));

  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Notification Row — compact, fully clickable
// ---------------------------------------------------------------------------

function NotificationRow({
  n,
  onStatusChange,
}: {
  n: AdminNotification;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[n.severity] ?? SEVERITY_CONFIG.INFO;
  const isUnread = n.status === "UNREAD";
  const summary = buildSummary(n);

  return (
    <Box
      onClick={() => setExpanded((v) => !v)}
      sx={{
        px: 2,
        py: 1.2,
        borderLeft: `3px solid ${sev.color}`,
        background: isUnread ? "rgba(45, 212, 255, 0.03)" : "transparent",
        cursor: "pointer",
        "&:hover": { background: "rgba(255,255,255,0.03)" },
        transition: "background 0.15s",
      }}
    >
      {/* Main row */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Tooltip title={sev.label}>
          <Box sx={{ color: sev.color, display: "flex" }}>{sev.icon}</Box>
        </Tooltip>

        <Typography
          variant="body2"
          noWrap
          sx={{
            fontWeight: isUnread ? 700 : 500,
            color: "#fff",
            fontSize: "0.82rem",
            flex: 1,
            minWidth: 0,
          }}
        >
          {n.title}
        </Typography>

        {summary && (
          <Typography
            variant="caption"
            noWrap
            sx={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "0.75rem",
              maxWidth: 320,
            }}
          >
            {summary}
          </Typography>
        )}

        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.3)",
            whiteSpace: "nowrap",
            fontSize: "0.7rem",
          }}
        >
          {formatDatetime(n.createdAt)}
        </Typography>

        {/* Read/unread toggle */}
        {n.status === "UNREAD" ? (
          <Tooltip title="Marcar como lido">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(n.id, "READ");
              }}
              sx={{ color: "rgba(255,255,255,0.3)", p: 0.3 }}
            >
              <MarkReadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Marcar como não lido">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(n.id, "UNREAD");
              }}
              sx={{ color: "rgba(255,255,255,0.2)", p: 0.3 }}
            >
              <MarkUnreadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Expanded detail — compact */}
      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 1,
            ml: 3.5,
            p: 1.2,
            borderRadius: 1,
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Stack spacing={0.4}>
            {/* Subscriber info */}
            {n.user && (
              <>
                <DetailRow
                  label="Assinante"
                  value={
                    n.user.name
                      ? `${n.user.name} (${n.user.email ?? "—"})`
                      : (n.user.email ?? "—")
                  }
                />
                {n.user.status && n.user.status !== "ACTIVE" && (
                  <DetailRow
                    label="Conta"
                    value={n.user.status}
                    color={
                      n.user.status === "SUSPENDED" ? "#f44336" : "#ff9800"
                    }
                  />
                )}
              </>
            )}

            {/* Plan */}
            {n.subscription?.plan && (
              <DetailRow
                label="Plano"
                value={`${n.subscription.plan.name}${n.subscription.plan.hotmartPlanCode ? ` (${n.subscription.plan.hotmartPlanCode})` : ""}`}
              />
            )}

            {/* Subscription status */}
            {n.subscription && (
              <DetailRow
                label="Assinatura"
                value={n.subscription.status}
                color={
                  n.subscription.status === "ACTIVE"
                    ? "#4caf50"
                    : n.subscription.status === "CANCELLED" ||
                        n.subscription.status === "EXPIRED"
                      ? "#f44336"
                      : undefined
                }
              />
            )}

            {/* Value */}
            {n.event?.amountCents != null && (
              <DetailRow
                label="Valor"
                value={formatCurrency(n.event.amountCents)}
              />
            )}

            {/* Transaction */}
            {n.event?.transactionId && (
              <DetailRow label="Transação" value={n.event.transactionId} />
            )}

            {/* Subscriber code */}
            {(n.event?.subscriberCode ||
              n.subscription?.hotmart?.subscriberCode) && (
              <DetailRow
                label="Cód. assinante"
                value={
                  n.event?.subscriberCode ??
                  n.subscription?.hotmart?.subscriberCode ??
                  "—"
                }
              />
            )}

            {/* Event processing error */}
            {n.event?.errorMessage && (
              <DetailRow
                label="Erro"
                value={n.event.errorMessage}
                color="#f44336"
              />
            )}

            {/* Event type */}
            <DetailRow label="Evento" value={formatEventType(n.type)} />

            {/* Recurrence number from metadata */}
            {n.metadata?.recurrenceNumber != null && (
              <DetailRow
                label="Recorrência"
                value={
                  n.metadata.recurrenceNumber === 1
                    ? "1ª (primeira compra)"
                    : `${n.metadata.recurrenceNumber}ª`
                }
              />
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

function DetailRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Typography
        variant="caption"
        sx={{ color: "rgba(255,255,255,0.35)", minWidth: 100, fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: color ?? "rgba(255,255,255,0.7)",
          fontWeight: color ? 600 : 400,
          wordBreak: "break-all",
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NotificationsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [updating, startUpdating] = useTransition();

  const queryParams = new URLSearchParams({ page: String(page), limit: "20" });
  if (statusFilter !== "ALL") queryParams.set("status", statusFilter);

  const { data, isLoading, mutate } = useSWR<NotificationsResponse>(
    `/api/admin/notifications?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30_000 },
  );

  const { data: summary, mutate: mutateSummary } = useSWR<SummaryResponse>(
    "/api/admin/notifications/summary",
    fetcher,
    { refreshInterval: 30_000 },
  );

  const handleStatusChange = useCallback(
    (id: string, status: string) => {
      startUpdating(async () => {
        await fetch(`/api/admin/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        await Promise.all([mutate(), mutateSummary()]);
      });
    },
    [mutate, mutateSummary],
  );

  const handleMarkAllRead = useCallback(() => {
    if (!data?.items) return;
    const unreadIds = data.items
      .filter((n) => n.status === "UNREAD")
      .map((n) => n.id);
    if (unreadIds.length === 0) return;

    startUpdating(async () => {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds, status: "READ" }),
      });
      await Promise.all([mutate(), mutateSummary()]);
    });
  }, [data, mutate, mutateSummary]);

  const handleRefresh = useCallback(() => {
    mutate();
    mutateSummary();
  }, [mutate, mutateSummary]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, color: "#fff", mb: 0.3 }}
            >
              Notificações
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.45)" }}
            >
              Eventos da Hotmart e do sistema
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {summary && summary.unread > 0 && (
              <Chip
                label={`${summary.unread} não lida${summary.unread > 1 ? "s" : ""}`}
                size="small"
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  background: "rgba(45,212,255,0.12)",
                  color: "#2DD4FF",
                  border: "1px solid rgba(45,212,255,0.25)",
                }}
              />
            )}
            {summary && summary.critical > 0 && (
              <Chip
                label={`${summary.critical} crítica${summary.critical > 1 ? "s" : ""}`}
                size="small"
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  background: "rgba(244,67,54,0.12)",
                  color: "#f44336",
                  border: "1px solid rgba(244,67,54,0.25)",
                }}
              />
            )}
            <Tooltip title="Atualizar">
              <IconButton
                size="small"
                onClick={handleRefresh}
                sx={{ color: "rgba(255,255,255,0.4)" }}
              >
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {/* Filters */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_e, v) => {
            if (v !== null) {
              setStatusFilter(v as StatusFilter);
              setPage(1);
            }
          }}
          size="small"
          sx={{
            "& .MuiToggleButton-root": {
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              textTransform: "none",
              fontSize: "0.78rem",
              px: 1.5,
              py: 0.3,
              "&.Mui-selected": {
                color: "#2DD4FF",
                background: "rgba(45,212,255,0.08)",
                borderColor: "rgba(45,212,255,0.3)",
              },
            },
          }}
        >
          <ToggleButton value="ALL">Todas</ToggleButton>
          <ToggleButton value="UNREAD">Não lidas</ToggleButton>
          <ToggleButton value="READ">Lidas</ToggleButton>
        </ToggleButtonGroup>

        <Button
          size="small"
          startIcon={<CheckCircleOutline sx={{ fontSize: 14 }} />}
          onClick={handleMarkAllRead}
          disabled={
            updating || !data?.items?.some((n) => n.status === "UNREAD")
          }
          sx={{
            color: "rgba(255,255,255,0.45)",
            textTransform: "none",
            fontSize: "0.75rem",
          }}
        >
          Marcar todas como lidas
        </Button>
      </Stack>

      {(isLoading || updating) && <LinearProgress sx={{ mb: 0.5 }} />}

      {/* Notification list */}
      <Card sx={{ ...cardStyle, mb: 2 }}>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {data?.items && data.items.length > 0 ? (
            <Stack
              divider={
                <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />
              }
            >
              {data.items.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </Stack>
          ) : !isLoading ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <InfoIcon
                sx={{ fontSize: 32, color: "rgba(255,255,255,0.12)", mb: 0.5 }}
              />
              <Typography
                variant="body2"
                sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem" }}
              >
                {statusFilter === "ALL"
                  ? "Nenhuma notificação."
                  : `Nenhuma notificação ${statusFilter === "UNREAD" ? "não lida" : "lida"}.`}
              </Typography>
            </Box>
          ) : null}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Pagination
            count={data.totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            size="small"
            sx={{
              "& .MuiPaginationItem-root": {
                color: "rgba(255,255,255,0.5)",
              },
              "& .Mui-selected": {
                background: "rgba(45,212,255,0.15) !important",
                color: "#2DD4FF",
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
