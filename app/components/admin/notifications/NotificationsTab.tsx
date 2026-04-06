"use client";

import { useState, useCallback, useTransition } from "react";
import useSWR from "swr";
import {
  Alert,
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
  Archive as ArchiveIcon,
  CheckCircleOutline,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
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
}

interface NotificationSubscription {
  id: string;
  status: string;
  plan: { name: string } | null;
}

interface NotificationEvent {
  id: string;
  eventType: string;
  processingStatus: string;
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

interface WebhookEvent {
  id: string;
  eventType: string;
  processingStatus: string;
  buyerEmail: string | null;
  subscriberCode: string | null;
  transactionId: string | null;
  amountCents: number | null;
  occurredAt: string | null;
  receivedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
}

interface WebhookEventsResponse {
  events: WebhookEvent[];
  pagination: { page: number; total: number; totalPages: number };
}

type StatusFilter = "UNREAD" | "READ" | "ARCHIVED" | "ALL";

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
    icon: <CriticalIcon sx={{ fontSize: 18 }} />,
    color: "#f44336",
    label: "Crítico",
  },
  HIGH: {
    icon: <ErrorIcon sx={{ fontSize: 18 }} />,
    color: "#ff9800",
    label: "Alto",
  },
  WARNING: {
    icon: <WarningIcon sx={{ fontSize: 18 }} />,
    color: "#ffc107",
    label: "Atenção",
  },
  INFO: {
    icon: <InfoIcon sx={{ fontSize: 18 }} />,
    color: "#2DD4FF",
    label: "Info",
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RECEIVED: { label: "Recebido", color: "#2DD4FF" },
  PROCESSING: { label: "Processando", color: "#ffc107" },
  PROCESSED: { label: "Processado", color: "#2ecc71" },
  FAILED: { label: "Falhou", color: "#f44336" },
  DUPLICATE: { label: "Duplicado", color: "rgba(255,255,255,0.4)" },
};

function formatDatetime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
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
    WEBHOOK_INVALID: "Webhook inválido",
    PROCESSING_FAILED: "Falha no processamento",
    IDENTITY_UNRESOLVED: "Identidade não resolvida",
    PURCHASE_APPROVED: "Compra aprovada",
    PURCHASE_CANCELED: "Compra cancelada",
    PURCHASE_CANCELLED: "Compra cancelada",
    PURCHASE_REFUNDED: "Reembolso",
    PURCHASE_CHARGEBACK: "Chargeback",
    PURCHASE_DELAYED: "Pagamento atrasado",
    PURCHASE_COMPLETE: "Compra completa",
    PURCHASE_BILLET_PRINTED: "Boleto impresso",
    PURCHASE_PROTEST: "Protesto",
    SUBSCRIPTION_CANCELLATION_REQUEST: "Solicitação de cancelamento",
  };
  return map[raw] ?? raw.replace(/_/g, " ").toLowerCase();
}

// ---------------------------------------------------------------------------
// Notification Row
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

  return (
    <Box
      sx={{
        p: 2,
        borderLeft: `3px solid ${sev.color}`,
        background: isUnread ? "rgba(45, 212, 255, 0.03)" : "transparent",
        "&:hover": { background: "rgba(255,255,255,0.02)" },
        transition: "background 0.15s",
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        {/* Severity icon */}
        <Tooltip title={sev.label}>
          <Box sx={{ color: sev.color, mt: 0.3 }}>{sev.icon}</Box>
        </Tooltip>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 0.3 }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: isUnread ? 700 : 500,
                color: "#fff",
                flex: 1,
              }}
            >
              {n.title}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}
            >
              {formatDatetime(n.createdAt)}
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            sx={{
              color: "rgba(255,255,255,0.65)",
              fontSize: "0.82rem",
              mb: 0.5,
            }}
          >
            {n.message}
          </Typography>

          {/* Tags row */}
          <Stack
            direction="row"
            spacing={0.5}
            flexWrap="wrap"
            sx={{ gap: 0.5 }}
          >
            <Chip
              label={sev.label}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.7rem",
                background: `${sev.color}22`,
                color: sev.color,
                border: `1px solid ${sev.color}44`,
              }}
            />
            <Chip
              label={n.source}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.7rem",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
              }}
            />
            {n.user?.email && (
              <Chip
                label={n.user.email}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.5)",
                }}
              />
            )}
            {n.event && (
              <Chip
                label={formatEventType(n.event.eventType)}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  background: "rgba(45,212,255,0.08)",
                  color: "#2DD4FF",
                }}
              />
            )}
          </Stack>

          {/* Expandable details */}
          <Collapse in={expanded}>
            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 1,
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Stack spacing={1}>
                <DetailRow label="Tipo" value={formatEventType(n.type)} />
                <DetailRow label="Fonte" value={n.source} />
                <DetailRow label="Status" value={n.status} />
                {n.user && (
                  <DetailRow
                    label="Usuário"
                    value={`${n.user.name ?? ""} (${n.user.email ?? "—"})`}
                  />
                )}
                {n.subscription && (
                  <DetailRow
                    label="Assinatura"
                    value={`${n.subscription.plan?.name ?? "—"} — ${n.subscription.status}`}
                  />
                )}
                {n.event && (
                  <>
                    <DetailRow
                      label="Evento Hotmart"
                      value={formatEventType(n.event.eventType)}
                    />
                    <DetailRow
                      label="Status do evento"
                      value={n.event.processingStatus}
                    />
                  </>
                )}
                {n.readAt && (
                  <DetailRow label="Lido em" value={formatDatetime(n.readAt)} />
                )}
                {n.resolvedAt && (
                  <DetailRow
                    label="Resolvido em"
                    value={formatDatetime(n.resolvedAt)}
                  />
                )}
                {n.metadata && Object.keys(n.metadata).length > 0 && (
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(255,255,255,0.4)",
                        fontWeight: 600,
                        display: "block",
                        mb: 0.5,
                      }}
                    >
                      Metadados
                    </Typography>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        background: "rgba(0,0,0,0.3)",
                        maxHeight: 120,
                        overflow: "auto",
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="pre"
                        sx={{
                          color: "rgba(255,255,255,0.5)",
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          whiteSpace: "pre-wrap",
                          m: 0,
                        }}
                      >
                        {JSON.stringify(n.metadata, null, 2)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Stack>
            </Box>
          </Collapse>
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
          <Tooltip title={expanded ? "Recolher" : "Detalhes"}>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: "rgba(255,255,255,0.4)",
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            >
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {n.status === "UNREAD" && (
            <Tooltip title="Marcar como lido">
              <IconButton
                size="small"
                onClick={() => onStatusChange(n.id, "READ")}
                sx={{ color: "rgba(255,255,255,0.4)" }}
              >
                <MarkReadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {n.status === "READ" && (
            <Tooltip title="Marcar como não lido">
              <IconButton
                size="small"
                onClick={() => onStatusChange(n.id, "UNREAD")}
                sx={{ color: "rgba(255,255,255,0.4)" }}
              >
                <MarkUnreadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {n.status !== "ARCHIVED" && (
            <Tooltip title="Arquivar">
              <IconButton
                size="small"
                onClick={() => onStatusChange(n.id, "ARCHIVED")}
                sx={{ color: "rgba(255,255,255,0.4)" }}
              >
                <ArchiveIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1}>
      <Typography
        variant="caption"
        sx={{ color: "rgba(255,255,255,0.4)", minWidth: 110, fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
        {value}
      </Typography>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Recent Webhook Events (compact)
// ---------------------------------------------------------------------------

function RecentWebhookEvents() {
  const { data, isLoading } = useSWR<WebhookEventsResponse>(
    "/api/admin/webhook-events?limit=10",
    fetcher,
    { refreshInterval: 30_000 },
  );

  if (isLoading) return <LinearProgress sx={{ my: 1 }} />;
  if (!data?.events?.length) {
    return (
      <Typography
        variant="body2"
        sx={{ color: "rgba(255,255,255,0.4)", py: 2, textAlign: "center" }}
      >
        Nenhum evento recente.
      </Typography>
    );
  }

  return (
    <Stack divider={<Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />}>
      {data.events.map((evt) => {
        const st =
          STATUS_CONFIG[evt.processingStatus] ?? STATUS_CONFIG.RECEIVED;
        return (
          <Stack
            key={evt.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ py: 1, px: 0.5 }}
          >
            <Chip
              label={st.label}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 600,
                background: `${st.color}18`,
                color: st.color,
                border: `1px solid ${st.color}33`,
                minWidth: 80,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.8rem",
                flex: 1,
              }}
            >
              {formatEventType(evt.eventType)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}
            >
              {evt.buyerEmail ?? "—"}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255,255,255,0.35)",
                fontSize: "0.72rem",
                whiteSpace: "nowrap",
              }}
            >
              {formatDatetime(evt.receivedAt)}
            </Typography>
            {evt.errorMessage && (
              <Tooltip title={evt.errorMessage}>
                <ErrorIcon sx={{ fontSize: 14, color: "#f44336" }} />
              </Tooltip>
            )}
          </Stack>
        );
      })}
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

  const queryParams = new URLSearchParams({ page: String(page), limit: "15" });
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
      <Box sx={{ mb: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, color: "#fff", mb: 0.5 }}
            >
              Notificações
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
              Eventos importantes da Hotmart e do sistema.
            </Typography>
          </Box>
          {summary && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              {summary.unread > 0 && (
                <Chip
                  label={`${summary.unread} não lida${summary.unread > 1 ? "s" : ""}`}
                  size="small"
                  sx={{
                    height: 24,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    background: "rgba(45,212,255,0.12)",
                    color: "#2DD4FF",
                    border: "1px solid rgba(45,212,255,0.25)",
                  }}
                />
              )}
              {summary.critical > 0 && (
                <Chip
                  label={`${summary.critical} crítica${summary.critical > 1 ? "s" : ""}`}
                  size="small"
                  sx={{
                    height: 24,
                    fontWeight: 600,
                    fontSize: "0.75rem",
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
          )}
        </Stack>
      </Box>

      {/* Filters */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
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
              fontSize: "0.8rem",
              px: 2,
              py: 0.5,
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
          <ToggleButton value="ARCHIVED">Arquivadas</ToggleButton>
        </ToggleButtonGroup>

        {statusFilter !== "ARCHIVED" && (
          <Button
            size="small"
            startIcon={<CheckCircleOutline sx={{ fontSize: 16 }} />}
            onClick={handleMarkAllRead}
            disabled={
              updating || !data?.items?.some((n) => n.status === "UNREAD")
            }
            sx={{
              color: "rgba(255,255,255,0.5)",
              textTransform: "none",
              fontSize: "0.8rem",
            }}
          >
            Marcar todas como lidas
          </Button>
        )}
      </Stack>

      {(isLoading || updating) && <LinearProgress sx={{ mb: 1 }} />}

      {/* Notification list */}
      <Card sx={{ ...cardStyle, mb: 3 }}>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {data?.items && data.items.length > 0 ? (
            <Stack
              divider={
                <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
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
            <Box sx={{ py: 4, textAlign: "center" }}>
              <InfoIcon
                sx={{ fontSize: 40, color: "rgba(255,255,255,0.15)", mb: 1 }}
              />
              <Typography
                variant="body2"
                sx={{ color: "rgba(255,255,255,0.4)" }}
              >
                {statusFilter === "ALL"
                  ? "Nenhuma notificação encontrada."
                  : `Nenhuma notificação ${statusFilter === "UNREAD" ? "não lida" : statusFilter === "READ" ? "lida" : "arquivada"}.`}
              </Typography>
            </Box>
          ) : null}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
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

      {/* Recent Hotmart Events — helps testing */}
      <Card sx={cardStyle}>
        <CardContent>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, color: "#fff", mb: 1 }}
          >
            Eventos Hotmart recentes
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.4)", display: "block", mb: 1.5 }}
          >
            Últimos webhooks recebidos — útil para validar o fluxo com eventos
            de teste.
          </Typography>
          <RecentWebhookEvents />
        </CardContent>
      </Card>
    </Box>
  );
}
