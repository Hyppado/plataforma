"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  NotificationsNone as BellIcon,
  NotificationsActive as CriticalIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircleOutline,
  MarkEmailRead as MarkReadIcon,
  Archive as ArchiveIcon,
} from "@mui/icons-material";

// ---------------------------------------------------------------------------
// Types (mirror of admin notifications API)
// ---------------------------------------------------------------------------

interface AdminNotification {
  id: string;
  source: string;
  type: string;
  severity: "INFO" | "WARNING" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  status: "UNREAD" | "READ" | "ARCHIVED";
  createdAt: string;
  user: { email: string | null; name: string | null } | null;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <CriticalIcon sx={{ fontSize: 16, color: "#f44336" }} />,
  HIGH: <ErrorIcon sx={{ fontSize: 16, color: "#ff9800" }} />,
  WARNING: <WarningIcon sx={{ fontSize: 16, color: "#ffc107" }} />,
  INFO: <InfoIcon sx={{ fontSize: 16, color: "#2DD4FF" }} />,
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#f44336",
  HIGH: "#ff9800",
  WARNING: "#ffc107",
  INFO: "#2DD4FF",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HeaderNotifications() {
  const router = useRouter();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [updating, startUpdating] = useTransition();

  // Fetch summary (badge count) — polls every 30s
  const { data: summary, mutate: mutateSummary } = useSWR<SummaryResponse>(
    "/api/admin/notifications/summary",
    fetcher,
    { refreshInterval: 30_000 },
  );

  // Fetch recent unread notifications (only when popover is open)
  const { data, mutate } = useSWR<NotificationsResponse>(
    open ? "/api/admin/notifications?limit=8&status=UNREAD" : null,
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

  const unreadCount = summary?.unread ?? 0;
  const hasCritical = (summary?.critical ?? 0) > 0;

  return (
    <>
      <Tooltip title="Notificações">
        <IconButton
          ref={anchorRef}
          onClick={() => setOpen(true)}
          size="small"
          sx={{
            color: hasCritical
              ? "#f44336"
              : unreadCount > 0
                ? "#2DD4FF"
                : "rgba(255,255,255,0.5)",
            transition: "color 0.2s",
            "&:hover": { background: "rgba(255,255,255,0.06)" },
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color={hasCritical ? "error" : "primary"}
            max={99}
            sx={{
              "& .MuiBadge-badge": {
                fontSize: "0.65rem",
                height: 16,
                minWidth: 16,
                ...(hasCritical && {
                  animation: "pulse 2s ease-in-out infinite",
                  "@keyframes pulse": {
                    "0%, 100%": { transform: "scale(1) translate(50%, -50%)" },
                    "50%": { transform: "scale(1.15) translate(50%, -50%)" },
                  },
                }),
              },
            }}
          >
            <BellIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              width: 380,
              maxHeight: 480,
              background: "#0d1422",
              border: "1px solid rgba(45,212,255,0.12)",
              borderRadius: 2,
              boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}
            >
              Notificações
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  background: "rgba(45,212,255,0.12)",
                  color: "#2DD4FF",
                  border: "1px solid rgba(45,212,255,0.25)",
                }}
              />
            )}
            {hasCritical && (
              <Chip
                label={`${summary!.critical} crítica${summary!.critical > 1 ? "s" : ""}`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  background: "rgba(244,67,54,0.12)",
                  color: "#f44336",
                  border: "1px solid rgba(244,67,54,0.25)",
                }}
              />
            )}
          </Stack>
          {unreadCount > 0 && (
            <Tooltip title="Marcar todas como lidas">
              <IconButton
                size="small"
                onClick={handleMarkAllRead}
                disabled={updating}
                sx={{ color: "rgba(255,255,255,0.4)" }}
              >
                <CheckCircleOutline sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Notification list */}
        <Box sx={{ flex: 1, overflow: "auto" }}>
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
                  onMarkRead={() => handleStatusChange(n.id, "READ")}
                  onArchive={() => handleStatusChange(n.id, "ARCHIVED")}
                />
              ))}
            </Stack>
          ) : (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <BellIcon
                sx={{
                  fontSize: 32,
                  color: "rgba(255,255,255,0.12)",
                  mb: 0.5,
                }}
              />
              <Typography
                variant="body2"
                sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem" }}
              >
                Nenhuma notificação não lida
              </Typography>
            </Box>
          )}
        </Box>

        {/* Footer — link to full page */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
            textAlign: "center",
          }}
        >
          <Button
            size="small"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/admin/notificacoes");
            }}
            sx={{
              color: "#2DD4FF",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.8rem",
              "&:hover": { background: "rgba(45,212,255,0.08)" },
            }}
          >
            Ver todas as notificações
          </Button>
        </Box>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------------------
// Compact notification row for dropdown
// ---------------------------------------------------------------------------

function NotificationRow({
  n,
  onMarkRead,
  onArchive,
}: {
  n: AdminNotification;
  onMarkRead: () => void;
  onArchive: () => void;
}) {
  const sevColor = SEVERITY_COLOR[n.severity] ?? "#2DD4FF";

  return (
    <Box
      sx={{
        px: 2,
        py: 1.25,
        borderLeft: `3px solid ${sevColor}`,
        "&:hover": { background: "rgba(255,255,255,0.02)" },
        transition: "background 0.15s",
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ mt: 0.2, flexShrink: 0 }}>
          {SEVERITY_ICON[n.severity] ?? SEVERITY_ICON.INFO}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography
              noWrap
              sx={{
                fontWeight: 600,
                fontSize: "0.8rem",
                color: "#fff",
                flex: 1,
              }}
            >
              {n.title}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.68rem",
                color: "rgba(255,255,255,0.35)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {timeAgo(n.createdAt)}
            </Typography>
          </Stack>

          <Typography
            noWrap
            sx={{
              fontSize: "0.76rem",
              color: "rgba(255,255,255,0.55)",
              mt: 0.15,
            }}
          >
            {n.message}
          </Typography>

          {n.user?.email && (
            <Typography
              noWrap
              sx={{
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.3)",
                mt: 0.15,
              }}
            >
              {n.user.email}
            </Typography>
          )}
        </Box>

        {/* Quick actions */}
        <Stack direction="row" spacing={0} sx={{ flexShrink: 0, ml: 0.5 }}>
          <Tooltip title="Marcar como lido">
            <IconButton
              size="small"
              onClick={onMarkRead}
              sx={{
                color: "rgba(255,255,255,0.3)",
                p: 0.4,
                "&:hover": { color: "#2DD4FF" },
              }}
            >
              <MarkReadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Arquivar">
            <IconButton
              size="small"
              onClick={onArchive}
              sx={{
                color: "rgba(255,255,255,0.3)",
                p: 0.4,
                "&:hover": { color: "#ff9800" },
              }}
            >
              <ArchiveIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}
