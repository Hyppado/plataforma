"use client";

import { useState, useCallback, useTransition } from "react";
import useSWR from "swr";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Pagination,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
  PersonOutlined,
} from "@mui/icons-material";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionRow {
  id: string;
  status: string;
  startedAt: string | null;
  cancelledAt: string | null;
  endedAt: string | null;
  plan: { name: string } | null;
  charges: { status: string; paidAt: string | null; chargeAt: string | null }[];
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
  lastLoginAt: string | null;
  _count: {
    subscriptions: number;
    accessGrants: number;
  };
  subscriptions?: SubscriptionRow[];
}

interface UsersResponse {
  users: UserRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type UserCategory = "all" | "admin" | "subscriber";

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

function getUserCategory(u: UserRow): "admin" | "subscriber" | "user" {
  if (u.role === "ADMIN") return "admin";
  if ((u._count?.subscriptions ?? 0) > 0) return "subscriber";
  return "user";
}

const CATEGORY_CHIP: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  admin: { label: "Admin", color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  subscriber: {
    label: "Assinante",
    color: "#81C784",
    bg: "rgba(76,175,80,0.15)",
  },
  user: {
    label: "Usuário",
    color: "#7B93A8",
    bg: "rgba(123,147,168,0.15)",
  },
};

// Portuguese labels for user status
const USER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
};

// Portuguese labels for subscription status
const SUB_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  PENDING: "Pendente",
  PAST_DUE: "Inadimplente",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

// Portuguese labels for charge status
const CHARGE_STATUS_LABEL: Record<string, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  OVERDUE: "Atrasado",
  REFUNDED: "Reembolsado",
  CANCELLED: "Cancelado",
  CHARGEBACK: "Chargeback",
  FAILED: "Falhou",
  REFUND_REQUEST: "Reembolso Solicitado",
};

// Colors matching SubscribersTable pattern (0.15 alpha bg, pastel fg)
const SUB_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  ACTIVE: { color: "#81C784", bg: "rgba(76,175,80,0.15)" },
  PENDING: { color: "#42A5F5", bg: "rgba(66,165,245,0.15)" },
  PAST_DUE: { color: "#FFB74D", bg: "rgba(255,183,77,0.15)" },
  CANCELLED: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  EXPIRED: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
};

const CHARGE_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  PAID: { color: "#81C784", bg: "rgba(76,175,80,0.15)" },
  PENDING: { color: "#42A5F5", bg: "rgba(66,165,245,0.15)" },
  OVERDUE: { color: "#FFB74D", bg: "rgba(255,183,77,0.15)" },
  REFUNDED: { color: "#42A5F5", bg: "rgba(66,165,245,0.15)" },
  CANCELLED: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  CHARGEBACK: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  FAILED: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  REFUND_REQUEST: { color: "#FFB74D", bg: "rgba(255,183,77,0.15)" },
};

const USER_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  ACTIVE: { color: "#81C784", bg: "rgba(76,175,80,0.15)" },
  INACTIVE: { color: "#FFB74D", bg: "rgba(255,183,77,0.15)" },
  SUSPENDED: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
};

const defaultStatusStyle = {
  color: "rgba(255,255,255,0.5)",
  bg: "rgba(255,255,255,0.06)",
};

const cellSx = {
  color: "rgba(255,255,255,0.6)",
  borderColor: "rgba(255,255,255,0.06)",
  fontSize: "0.8rem",
  py: 1,
};

const headCellSx = {
  color: "rgba(255,255,255,0.5)",
  borderColor: "rgba(255,255,255,0.06)",
  fontWeight: 600,
  fontSize: "0.75rem",
  whiteSpace: "nowrap" as const,
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Create User Dialog
// ---------------------------------------------------------------------------

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!email.includes("@")) {
      setError("Email inválido");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar usuário");
        return;
      }
      setEmail("");
      setName("");
      setRole("USER");
      onCreated();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  }, [email, name, role, onCreated]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: "#0d1422",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      }}
    >
      <DialogTitle sx={{ color: "#fff", fontWeight: 700 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PersonAddIcon sx={{ color: "#2DD4FF" }} />
          <span>Criar Usuário</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            type="email"
            sx={inputSx}
          />
          <TextField
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            sx={inputSx}
          />
          <Box>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.5)", mb: 0.5, display: "block" }}
            >
              Perfil
            </Typography>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")}
              fullWidth
              size="small"
              sx={{
                color: "#fff",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.15)",
                },
              }}
            >
              <MenuItem value="USER">Usuário</MenuItem>
              <MenuItem value="ADMIN">Administrador</MenuItem>
            </Select>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: "rgba(255,255,255,0.6)" }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !email}
          variant="contained"
          sx={{
            background: "#2DD4FF",
            color: "#0a0a0f",
            fontWeight: 700,
            "&:hover": { background: "#5BE0FF" },
          }}
        >
          {submitting ? "Criando..." : "Criar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const inputSx = {
  "& .MuiOutlinedInput-root": {
    color: "#fff",
    "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
  },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.5)" },
};

// ---------------------------------------------------------------------------
// Edit User Dialog
// ---------------------------------------------------------------------------

function EditUserDialog({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync form when user changes
  const handleOpen = useCallback(() => {
    if (user) {
      setEmail(user.email);
      setName(user.name ?? "");
      setError(null);
    }
  }, [user]);

  // Reset on open
  if (open && email === "" && user) {
    handleOpen();
  }

  const handleSubmit = useCallback(async () => {
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao atualizar");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  }, [user, email, name, onSaved, onClose]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setEmail("");
        setName("");
        onClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: "#0d1422",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      }}
    >
      <DialogTitle sx={{ color: "#fff", fontWeight: 700 }}>
        Editar Usuário
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            type="email"
            sx={inputSx}
          />
          <TextField
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            sx={inputSx}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={() => {
            setEmail("");
            setName("");
            onClose();
          }}
          sx={{ color: "rgba(255,255,255,0.6)" }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          variant="contained"
          sx={{
            background: "#2DD4FF",
            color: "#0a0a0f",
            fontWeight: 700,
            "&:hover": { background: "#5BE0FF" },
          }}
        >
          {submitting ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Confirmation Dialog (Delete / Deactivate)
// ---------------------------------------------------------------------------

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmColor,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: "#0d1422",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      }}
    >
      <DialogTitle sx={{ color: "#fff", fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ color: "rgba(255,255,255,0.6)" }}
        >
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          sx={{
            bgcolor: confirmColor,
            fontWeight: 700,
            "&:hover": { bgcolor: confirmColor, filter: "brightness(0.85)" },
          }}
        >
          {loading ? "Processando..." : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function UsersTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [tab, setTab] = useState(0);
  const [updating, startUpdating] = useTransition();

  // Map tab index to category
  const category: UserCategory = (["all", "admin", "subscriber"] as const)[tab];

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "delete" | "deactivate";
    user: UserRow;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // Build query params
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
  });
  if (search) params.set("search", search);
  if (category === "admin") params.set("role", "ADMIN");

  const { data, isLoading, mutate } = useSWR<UsersResponse>(
    `/api/admin/users?${params.toString()}`,
    fetcher,
  );

  // Client-side category filtering for subscriber vs manual
  const filteredUsers = data?.users?.filter((u) => {
    if (category === "all" || category === "admin") return true;
    const cat = getUserCategory(u);
    return cat === category;
  });

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleResetPassword = useCallback((userId: string) => {
    startUpdating(async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "POST",
        });
        const data = await res.json();
        if (res.ok) {
          setSnackbar(
            data.emailSent
              ? "Nova senha enviada por email ao usuário."
              : "Senha redefinida, mas o envio do email falhou.",
          );
        }
      } catch {
        // ignore
      }
    });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmDialog) return;
    setConfirmLoading(true);
    try {
      if (confirmDialog.type === "delete") {
        const res = await fetch(`/api/admin/users/${confirmDialog.user.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? "Erro ao excluir usuário");
          return;
        }
      } else {
        // deactivate = set status to INACTIVE
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: confirmDialog.user.id,
            status: "INACTIVE",
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? "Erro ao desativar usuário");
          return;
        }
      }
      mutate();
    } catch {
      alert("Erro de conexão");
    } finally {
      setConfirmLoading(false);
      setConfirmDialog(null);
    }
  }, [confirmDialog, mutate]);

  const handleCreated = useCallback(() => {
    setCreateOpen(false);
    setSnackbar("Usuário criado! Email com senha temporária enviado.");
    mutate();
  }, [mutate]);

  return (
    <Box>
      <Card sx={{ ...cardStyle, mb: 3 }}>
        <CardHeader
          avatar={<PersonOutlined sx={{ color: "#2DD4FF" }} />}
          title="Usuários"
          subheader={`${data?.pagination.total ?? 0} usuário(s) encontrado(s)`}
          titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          subheaderTypographyProps={{ fontSize: "0.8rem" }}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                placeholder="Buscar por nome ou email..."
                size="small"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
              <Button
                startIcon={<AddIcon />}
                onClick={() => setCreateOpen(true)}
                variant="contained"
                size="small"
                sx={{
                  background: "#2DD4FF",
                  color: "#0a0a0f",
                  fontWeight: 700,
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  "&:hover": { background: "#5BE0FF" },
                }}
              >
                Criar Usuário
              </Button>
            </Stack>
          }
        />
        <CardContent>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              setPage(1);
            }}
            sx={{
              mb: 2,
              "& .MuiTab-root": {
                color: "rgba(255,255,255,0.5)",
                "&.Mui-selected": { color: "#2DD4FF" },
              },
              "& .MuiTabs-indicator": { background: "#2DD4FF" },
            }}
          >
            <Tab label="Todos" />
            <Tab label="Admins" />
            <Tab label="Assinantes" />
          </Tabs>

          {(isLoading || updating) && <LinearProgress sx={{ mb: 1 }} />}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {[
                    "Nome",
                    "Email",
                    "Perfil",
                    "Status",
                    "Plano / Assinatura",
                    "Criado",
                    "Ações",
                  ].map((h) => (
                    <TableCell key={h} sx={headCellSx}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => {
                    const cat = getUserCategory(u);
                    const chip = CATEGORY_CHIP[cat];
                    const isEditable = cat !== "subscriber";
                    const sub = u.subscriptions?.[0];
                    const subStyle = sub
                      ? (SUB_STATUS_COLORS[sub.status] ?? defaultStatusStyle)
                      : null;
                    const charge = sub?.charges?.[0];
                    const chargeStyle = charge
                      ? (CHARGE_STATUS_COLORS[charge.status] ??
                        defaultStatusStyle)
                      : null;

                    return (
                      <TableRow
                        key={u.id}
                        sx={{
                          "&:hover": { background: "rgba(255,255,255,0.02)" },
                        }}
                      >
                        {/* Nome */}
                        <TableCell
                          sx={{
                            ...cellSx,
                            color: "rgba(255,255,255,0.8)",
                            maxWidth: 140,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {u.name ?? "—"}
                        </TableCell>

                        {/* Email */}
                        <TableCell
                          sx={{
                            ...cellSx,
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {u.email}
                        </TableCell>

                        {/* Perfil */}
                        <TableCell sx={cellSx}>
                          <Chip
                            label={chip.label}
                            size="small"
                            sx={{
                              background: chip.bg,
                              color: chip.color,
                              fontSize: "0.75rem",
                            }}
                          />
                        </TableCell>

                        {/* Status */}
                        <TableCell sx={cellSx}>
                          {(() => {
                            const sc =
                              USER_STATUS_COLORS[u.status] ??
                              defaultStatusStyle;
                            return (
                              <Chip
                                label={USER_STATUS_LABEL[u.status] ?? u.status}
                                size="small"
                                sx={{
                                  background: sc.bg,
                                  color: sc.color,
                                  fontSize: "0.75rem",
                                }}
                              />
                            );
                          })()}
                        </TableCell>

                        {/* Plano / Assinatura (merged) */}
                        <TableCell sx={cellSx}>
                          {sub ? (
                            <Stack
                              direction="row"
                              spacing={0.5}
                              alignItems="center"
                              flexWrap="wrap"
                              useFlexGap
                            >
                              {sub.plan?.name && (
                                <Chip
                                  label={sub.plan.name}
                                  size="small"
                                  sx={{
                                    background: "rgba(45,212,255,0.1)",
                                    color: "#2DD4FF",
                                    fontSize: "0.7rem",
                                    height: 22,
                                  }}
                                />
                              )}
                              {subStyle && (
                                <Chip
                                  label={
                                    SUB_STATUS_LABEL[sub.status] ?? sub.status
                                  }
                                  size="small"
                                  sx={{
                                    background: subStyle.bg,
                                    color: subStyle.color,
                                    fontSize: "0.7rem",
                                    height: 22,
                                  }}
                                />
                              )}
                              {charge && chargeStyle && (
                                <Chip
                                  label={
                                    CHARGE_STATUS_LABEL[charge.status] ??
                                    charge.status
                                  }
                                  size="small"
                                  sx={{
                                    background: chargeStyle.bg,
                                    color: chargeStyle.color,
                                    fontSize: "0.7rem",
                                    height: 22,
                                  }}
                                />
                              )}
                            </Stack>
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        {/* Criado */}
                        <TableCell sx={cellSx}>
                          {formatDate(u.createdAt)}
                        </TableCell>

                        {/* Ações — text links */}
                        <TableCell sx={cellSx}>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            {/* Editar */}
                            <Tooltip
                              title={
                                isEditable
                                  ? "Editar dados do usuário"
                                  : "Assinantes não podem ser editados diretamente"
                              }
                              arrow
                            >
                              <Typography
                                component="span"
                                role={isEditable ? "button" : undefined}
                                onClick={
                                  isEditable ? () => setEditUser(u) : undefined
                                }
                                sx={{
                                  background: "none",
                                  border: "none",
                                  cursor: isEditable
                                    ? "pointer"
                                    : "not-allowed",
                                  color: isEditable
                                    ? "primary.main"
                                    : "text.disabled",
                                  fontSize: "0.75rem",
                                  p: 0,
                                  "&:hover": isEditable
                                    ? { color: "primary.light" }
                                    : {},
                                }}
                              >
                                Editar
                              </Typography>
                            </Tooltip>

                            {/* Resetar Senha */}
                            <Tooltip
                              title="Gera uma senha temporária e envia por email"
                              arrow
                            >
                              <Typography
                                component="button"
                                onClick={() => handleResetPassword(u.id)}
                                sx={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "secondary.main",
                                  fontSize: "0.75rem",
                                  p: 0,
                                  "&:hover": { color: "secondary.light" },
                                }}
                              >
                                Resetar Senha
                              </Typography>
                            </Tooltip>

                            {/* Excluir */}
                            <Tooltip
                              title={
                                isEditable
                                  ? "Excluir permanentemente o usuário e seus dados"
                                  : "Assinantes não podem ser excluídos"
                              }
                              arrow
                            >
                              <Typography
                                component="span"
                                role={isEditable ? "button" : undefined}
                                onClick={
                                  isEditable
                                    ? () =>
                                        setConfirmDialog({
                                          type: "delete",
                                          user: u,
                                        })
                                    : undefined
                                }
                                sx={{
                                  background: "none",
                                  border: "none",
                                  cursor: isEditable
                                    ? "pointer"
                                    : "not-allowed",
                                  color: isEditable
                                    ? "error.light"
                                    : "text.disabled",
                                  fontSize: "0.75rem",
                                  p: 0,
                                  "&:hover": isEditable
                                    ? { color: "error.main" }
                                    : {},
                                }}
                              >
                                Excluir
                              </Typography>
                            </Tooltip>

                            {/* Desativar */}
                            <Tooltip
                              title={
                                u.status !== "ACTIVE"
                                  ? "Usuário já está inativo/suspenso"
                                  : "Desativar impede o login, mas mantém os dados"
                              }
                              arrow
                            >
                              <Typography
                                component="span"
                                role={
                                  u.status === "ACTIVE" ? "button" : undefined
                                }
                                onClick={
                                  u.status === "ACTIVE"
                                    ? () =>
                                        setConfirmDialog({
                                          type: "deactivate",
                                          user: u,
                                        })
                                    : undefined
                                }
                                sx={{
                                  background: "none",
                                  border: "none",
                                  cursor:
                                    u.status === "ACTIVE"
                                      ? "pointer"
                                      : "not-allowed",
                                  color:
                                    u.status === "ACTIVE"
                                      ? "warning.main"
                                      : "text.disabled",
                                  fontSize: "0.75rem",
                                  p: 0,
                                  "&:hover":
                                    u.status === "ACTIVE"
                                      ? { color: "warning.light" }
                                      : {},
                                }}
                              >
                                Desativar
                              </Typography>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      sx={{
                        color: "rgba(255,255,255,0.4)",
                        borderColor: "rgba(255,255,255,0.06)",
                        textAlign: "center",
                        py: 4,
                      }}
                    >
                      {isLoading
                        ? "Carregando..."
                        : "Nenhum usuário encontrado."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <Pagination
            count={data.pagination.totalPages}
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

      {/* Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      <EditUserDialog
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={() => mutate()}
      />

      {confirmDialog && (
        <ConfirmDialog
          open
          title={
            confirmDialog.type === "delete"
              ? "Excluir Usuário"
              : "Desativar Usuário"
          }
          message={
            confirmDialog.type === "delete"
              ? `Tem certeza que deseja excluir "${confirmDialog.user.name ?? confirmDialog.user.email}"? Esta ação é irreversível e todos os dados do usuário serão permanentemente removidos.`
              : `Tem certeza que deseja desativar "${confirmDialog.user.name ?? confirmDialog.user.email}"? O usuário não poderá mais fazer login, mas seus dados serão mantidos.`
          }
          confirmLabel={
            confirmDialog.type === "delete" ? "Excluir" : "Desativar"
          }
          confirmColor={confirmDialog.type === "delete" ? "#EF5350" : "#FFB74D"}
          loading={confirmLoading}
          onConfirm={handleConfirmAction}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar(null)}
          severity="success"
          sx={{ width: "100%" }}
        >
          {snackbar}
        </Alert>
      </Snackbar>
    </Box>
  );
}
