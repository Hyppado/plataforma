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
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Pagination,
  Select,
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
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Key as KeyIcon,
  PersonAdd as PersonAddIcon,
  PersonOutlined,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
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

function getUserCategory(u: UserRow): "admin" | "subscriber" {
  if (u.role === "ADMIN") return "admin";
  return "subscriber";
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
// One-Time Password Dialog
// ---------------------------------------------------------------------------

function PasswordDialog({
  open,
  password,
  title,
  onClose,
}: {
  open: boolean;
  password: string;
  title: string;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [password]);

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
      <DialogTitle sx={{ color: "#fff", fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Esta senha só será exibida uma vez. Copie-a agora e envie ao usuário
          de forma segura.
        </Alert>
        <TextField
          fullWidth
          value={visible ? password : "•".repeat(password.length)}
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setVisible(!visible)} size="small">
                  {visible ? (
                    <VisibilityOffIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <VisibilityIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
                <IconButton onClick={handleCopy} size="small">
                  <CopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              fontFamily: "monospace",
              fontSize: "1rem",
              color: "#fff",
              background: "rgba(0,0,0,0.3)",
            },
          }}
        />
        {copied && (
          <Typography
            variant="caption"
            sx={{ color: "#4caf50", mt: 1, display: "block" }}
          >
            Copiado!
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: "rgba(255,255,255,0.6)" }}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
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
  onCreated: (password: string) => void;
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
      onCreated(data.password);
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
  const [passwordDialog, setPasswordDialog] = useState<{
    title: string;
    password: string;
  } | null>(null);

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
          setPasswordDialog({
            title: "Nova Senha",
            password: data.password,
          });
        }
      } catch {
        // ignore
      }
    });
  }, []);

  const handleCreated = useCallback(
    (password: string) => {
      setCreateOpen(false);
      setPasswordDialog({ title: "Senha do Novo Usuário", password });
      mutate();
    },
    [mutate],
  );

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
                    "Plano",
                    "Assinatura",
                    "Cobrança",
                    "Criado",
                    "Último Login",
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
                          sx={{ ...cellSx, color: "rgba(255,255,255,0.8)" }}
                        >
                          {u.name ?? u.email}
                        </TableCell>

                        {/* Email */}
                        <TableCell sx={cellSx}>{u.email}</TableCell>

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

                        {/* Plano */}
                        <TableCell sx={cellSx}>
                          {sub?.plan?.name ? (
                            <Chip
                              label={sub.plan.name}
                              size="small"
                              sx={{
                                background: "rgba(45,212,255,0.1)",
                                color: "#2DD4FF",
                                fontSize: "0.75rem",
                                maxWidth: 150,
                              }}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        {/* Assinatura */}
                        <TableCell sx={cellSx}>
                          {sub && subStyle ? (
                            <Chip
                              label={SUB_STATUS_LABEL[sub.status] ?? sub.status}
                              size="small"
                              sx={{
                                background: subStyle.bg,
                                color: subStyle.color,
                                fontSize: "0.75rem",
                              }}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        {/* Cobrança */}
                        <TableCell sx={cellSx}>
                          {charge && chargeStyle ? (
                            <Chip
                              label={
                                CHARGE_STATUS_LABEL[charge.status] ??
                                charge.status
                              }
                              size="small"
                              sx={{
                                background: chargeStyle.bg,
                                color: chargeStyle.color,
                                fontSize: "0.75rem",
                              }}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        {/* Criado */}
                        <TableCell sx={cellSx}>
                          {formatDate(u.createdAt)}
                        </TableCell>

                        {/* Último Login */}
                        <TableCell sx={cellSx}>
                          {formatDate(u.lastLoginAt)}
                        </TableCell>

                        {/* Ações */}
                        <TableCell sx={cellSx}>
                          <Stack direction="row" spacing={0.5}>
                            {isEditable && (
                              <Tooltip title="Editar">
                                <IconButton
                                  size="small"
                                  onClick={() => setEditUser(u)}
                                  sx={{
                                    color: "rgba(255,255,255,0.4)",
                                    "&:hover": { color: "#2DD4FF" },
                                  }}
                                >
                                  <EditIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Resetar senha">
                              <IconButton
                                size="small"
                                onClick={() => handleResetPassword(u.id)}
                                sx={{
                                  color: "rgba(255,255,255,0.4)",
                                  "&:hover": { color: "#ff9800" },
                                }}
                              >
                                <KeyIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={10}
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

      {passwordDialog && (
        <PasswordDialog
          open
          title={passwordDialog.title}
          password={passwordDialog.password}
          onClose={() => setPasswordDialog(null)}
        />
      )}
    </Box>
  );
}
