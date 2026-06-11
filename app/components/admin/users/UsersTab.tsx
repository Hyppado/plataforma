"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import useSWR from "swr";
import {
  Alert,
  Avatar,
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
  Menu,
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
  Clear as ClearIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  PersonOutlined,
  InfoOutlined as InfoOutlinedIcon,
} from "@mui/icons-material";
import {
  ACCOUNT_STATE_LABEL,
  ACCOUNT_TYPE_LABEL,
  type AccountState,
  type AccountType,
  type AccountFilterGroup,
  type AccountTypeFilter,
} from "@/lib/admin/account-state";

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

interface UsageRow {
  transcripts: number;
  scripts: number;
  insights: number;
  avatarVideos: number;
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
  accountState: AccountState;
  accountType: AccountType;
  hasAccess: boolean;
  createdByAdmin: boolean;
  origin: "admin" | "hotmart" | "none";
  creator: { name: string | null; email: string } | null;
  usage: UsageRow;
}

interface UsersSummary {
  total: number;
  withAccess: number;
  // access states
  active: number;
  courtesy: number;
  pastDue: number;
  cancelling: number;
  refunded: number;
  cancelled: number;
  expired: number;
  noAccess: number;
  inactive: number;
  suspended: number;
  // account types
  typeAdmin: number;
  typeSubscriber: number;
  typeCourtesy: number;
  typeLead: number;
}

interface UsersResponse {
  users: UserRow[];
  summary: UsersSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Access-situation filter options for the "Acesso" dropdown in the Contas view.
const ACCESS_FILTER_OPTIONS: { value: AccountFilterGroup; label: string }[] = [
  { value: "all", label: "Todos os acessos" },
  { value: "with_access", label: "Com acesso" },
  { value: "no_access", label: "Sem acesso" },
  { value: "active", label: "Ativos" },
  { value: "courtesy", label: "Cortesia" },
  { value: "past_due", label: "Inadimplentes" },
  { value: "cancelling", label: "Cancelando" },
  { value: "refunded", label: "Reembolsados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "expired", label: "Expirados" },
  { value: "inactive", label: "Inativos" },
  { value: "suspended", label: "Suspensos" },
];

// Type filter options for the "Tipo" dropdown in the Contas view.
const TYPE_FILTER_OPTIONS: { value: AccountTypeFilter; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "subscriber", label: "Assinantes" },
  { value: "courtesy", label: "Cortesia" },
  { value: "lead", label: "Cadastros" },
  { value: "admin", label: "Admins" },
];

// Quick-access chips: one-click shortcuts that set the access filter.
const QUICK_ACCESS_CHIPS: {
  label: string;
  value: AccountFilterGroup;
  count: (s: UsersSummary) => number;
}[] = [
  { label: "Com acesso", value: "with_access", count: (s) => s.withAccess },
  {
    label: "Sem acesso",
    value: "no_access",
    count: (s) => s.noAccess + s.cancelled + s.expired,
  },
  { label: "Cortesia", value: "courtesy", count: (s) => s.courtesy },
  { label: "Inadimplentes", value: "past_due", count: (s) => s.pastDue },
];

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

// Hotmart-origin (billing-linked) accounts are protected from manual edit/delete.
function isUserEditable(u: UserRow): boolean {
  return u.origin !== "hotmart";
}

// Account-type chip colors (labels come from ACCOUNT_TYPE_LABEL).
const ACCOUNT_TYPE_CHIP: Record<AccountType, { color: string; bg: string }> = {
  admin: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  subscriber: { color: "#81C784", bg: "rgba(76,175,80,0.15)" },
  courtesy: { color: "#2DD4FF", bg: "rgba(45,212,255,0.15)" },
  lead: { color: "#7B93A8", bg: "rgba(123,147,168,0.15)" },
};

// Effective account-state chip colors (labels come from ACCOUNT_STATE_LABEL).
const ACCOUNT_STATE_COLORS: Record<
  AccountState,
  { color: string; bg: string }
> = {
  ACTIVE: { color: "#81C784", bg: "rgba(76,175,80,0.15)" },
  COURTESY: { color: "#2DD4FF", bg: "rgba(45,212,255,0.15)" },
  PAST_DUE: { color: "#FFB74D", bg: "rgba(255,183,77,0.15)" },
  CANCELLING: { color: "#FFB74D", bg: "rgba(255,183,77,0.15)" },
  REFUNDED: { color: "#CE93D8", bg: "rgba(206,147,216,0.15)" },
  CANCELLED: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  EXPIRED: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  INACTIVE: { color: "#90A4AE", bg: "rgba(144,164,174,0.15)" },
  SUSPENDED: { color: "#EF5350", bg: "rgba(244,67,54,0.15)" },
  NO_ACCESS: { color: "#7B93A8", bg: "rgba(123,147,168,0.15)" },
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
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

const AVATAR_PALETTE = [
  "#2DD4FF",
  "#FF2D78",
  "#81C784",
  "#FFB74D",
  "#CE93D8",
  "#80DEEA",
];

function getAvatarColor(str: string): string {
  let hash = 0;
  for (const c of str) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
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
// Row Actions Dropdown
// ---------------------------------------------------------------------------

function RowActionsMenu({
  user,
  isEditable,
  onEdit,
  onResetPassword,
  onDelete,
  onDeactivate,
}: {
  user: UserRow;
  isEditable: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
  onDeactivate: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          color: "rgba(255,255,255,0.45)",
          p: 0.5,
          "&:hover": { color: "#fff" },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        PaperProps={{
          sx: {
            background: "#0d1422",
            border: "1px solid rgba(255,255,255,0.1)",
            minWidth: 170,
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem
          disabled={!isEditable}
          onClick={() => {
            close();
            if (isEditable) onEdit();
          }}
          sx={{
            fontSize: "0.82rem",
            color: isEditable ? "secondary.main" : "text.disabled",
          }}
        >
          Editar
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onResetPassword();
          }}
          sx={{ fontSize: "0.82rem", color: "secondary.main" }}
        >
          Resetar Senha
        </MenuItem>
        <MenuItem
          disabled={!isEditable}
          onClick={() => {
            close();
            if (isEditable) onDelete();
          }}
          sx={{
            fontSize: "0.82rem",
            color: isEditable ? "secondary.main" : "text.disabled",
          }}
        >
          Excluir
        </MenuItem>
        <MenuItem
          disabled={user.status !== "ACTIVE"}
          onClick={() => {
            close();
            if (user.status === "ACTIVE") onDeactivate();
          }}
          sx={{
            fontSize: "0.82rem",
            color:
              user.status === "ACTIVE" ? "secondary.main" : "text.disabled",
          }}
        >
          Desativar
        </MenuItem>
      </Menu>
    </>
  );
}

// ---------------------------------------------------------------------------
// Usage View (aba "Uso")
// ---------------------------------------------------------------------------

type UsagePeriodKey = "current_month" | "last_month" | "last_90_days" | "all";

const USAGE_PERIODS: { value: UsagePeriodKey; label: string }[] = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_month", label: "Mês anterior" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "all", label: "Tudo" },
];

interface UsageUserRow {
  id: string;
  name: string | null;
  email: string;
  transcripts: number;
  scripts: number;
  insights: number;
  avatarVideos: number;
  tokens: number;
  total: number;
  planName: string | null;
  situacao: "assinante" | "cortesia" | "cadastro";
  monthlyRevenueBrl: number;
  aiCostBrl: number;
}

interface UsageResponse {
  period: UsagePeriodKey;
  totals: {
    transcripts: number;
    scripts: number;
    insights: number;
    avatarVideos: number;
    tokens: number;
    aiCostBrl: number;
    users: number;
  };
  finance: {
    usdToBrl: number;
    rateDate: string | null;
    hotmartFeePercent: number;
    activeSubscribers: number;
    mrrBrl: number;
    hotmartFeeBrl: number;
    netRevenueBrl: number;
    aiCostPeriodBrl: number;
    periodMonths: number;
    aiCostMonthlyBrl: number;
    profitMonthlyBrl: number;
    marginPercent: number;
  };
  users: UsageUserRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const fmtBrlShort = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: v >= 100 ? 0 : 2,
  });

const SITUACAO_CHIP: Record<
  UsageUserRow["situacao"],
  { label: string; color: string; bg: string }
> = {
  assinante: {
    label: "Assinante",
    color: "#34D399",
    bg: "rgba(52,211,153,0.12)",
  },
  cortesia: {
    label: "Cortesia",
    color: "#FBBF24",
    bg: "rgba(251,191,36,0.12)",
  },
  cadastro: {
    label: "Cadastro",
    color: "#94A3B8",
    bg: "rgba(148,163,184,0.12)",
  },
};

/** Card de métrica financeira (faturamento, custo, lucro). */
function FinanceStat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
}) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 2,
        flex: "1 1 160px",
        minWidth: 160,
        background: `${accent}14`,
        border: `1px solid ${accent}33`,
      }}
    >
      <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "1.35rem", fontWeight: 800, color: accent }}>
        {value}
      </Typography>
      {hint && (
        <Typography
          sx={{ fontSize: "0.66rem", color: "rgba(255,255,255,0.4)" }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  );
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.25,
        borderRadius: 2,
        background: "rgba(45,212,255,0.06)",
        border: "1px solid rgba(45,212,255,0.12)",
        minWidth: 110,
      }}
    >
      <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
        {value.toLocaleString("pt-BR")}
      </Typography>
      <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>
        {label}
      </Typography>
    </Box>
  );
}

function UsageView() {
  const [period, setPeriod] = useState<UsagePeriodKey>("current_month");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = new URLSearchParams({
    period,
    page: String(page),
    limit: "20",
  });
  if (search) params.set("search", search);

  const { data, isLoading } = useSWR<UsageResponse>(
    `/api/admin/usage?${params.toString()}`,
    fetcher,
  );

  const totals = data?.totals;
  const finance = data?.finance;

  return (
    <Card sx={{ ...cardStyle, mb: 3 }}>
      <CardHeader
        avatar={<PersonOutlined sx={{ color: "#2DD4FF" }} />}
        title="Uso, faturamento e lucro"
        subheader={`${data?.totals.users ?? 0} usuário(s) com consumo no período`}
        titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
        subheaderTypographyProps={{ fontSize: "0.8rem" }}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as UsagePeriodKey);
                setPage(1);
              }}
              size="small"
              sx={{
                color: "#fff",
                minWidth: 160,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.15)",
                },
              }}
            >
              {USAGE_PERIODS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
            <TextField
              placeholder="Buscar usuário..."
              size="small"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                endAdornment: searchInput ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchInput("")}
                      edge="end"
                      sx={{ color: "rgba(255,255,255,0.4)", p: 0.25 }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                width: 240,
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
          </Stack>
        }
      />
      <CardContent>
        {/* Resumo financeiro (faturamento e lucro reais) */}
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            background: "rgba(45,212,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Typography
              sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}
            >
              Faturamento e lucro
            </Typography>
            <Tooltip
              title="Faturamento = receita recorrente mensal das assinaturas ativas (planos anuais ÷ 12). Lucro = receita após a taxa Hotmart, menos o custo de IA médio mensal estimado a partir do uso real do período. Câmbio USD→BRL pelo PTAX."
              arrow
            >
              <InfoOutlinedIcon
                sx={{ fontSize: 16, color: "rgba(255,255,255,0.35)" }}
              />
            </Tooltip>
          </Stack>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <FinanceStat
              label="Faturamento mensal (MRR)"
              accent="#2DD4FF"
              value={fmtBrlShort(finance?.mrrBrl ?? 0)}
              hint={`${finance?.activeSubscribers ?? 0} assinante(s) ativo(s)`}
            />
            <FinanceStat
              label="Taxa Hotmart"
              accent="#FB923C"
              value={`− ${fmtBrlShort(finance?.hotmartFeeBrl ?? 0)}`}
              hint={`${((finance?.hotmartFeePercent ?? 0) * 100).toFixed(1)}% da receita`}
            />
            <FinanceStat
              label="Custo de IA / mês"
              accent="#A78BFA"
              value={`− ${fmtBrlShort(finance?.aiCostMonthlyBrl ?? 0)}`}
              hint={
                (finance?.periodMonths ?? 1) > 1
                  ? `${fmtBrlShort(finance?.aiCostPeriodBrl ?? 0)} em ${finance?.periodMonths} meses`
                  : "uso real do período"
              }
            />
            <FinanceStat
              label="Lucro mensal estimado"
              accent={
                (finance?.profitMonthlyBrl ?? 0) >= 0 ? "#34D399" : "#F87171"
              }
              value={fmtBrlShort(finance?.profitMonthlyBrl ?? 0)}
              hint={`margem ${(finance?.marginPercent ?? 0).toFixed(1)}%`}
            />
          </Stack>
          <Typography
            sx={{ mt: 1, fontSize: "0.66rem", color: "rgba(255,255,255,0.35)" }}
          >
            Estimativa — câmbio USD→BRL {(finance?.usdToBrl ?? 0).toFixed(4)}
            {finance?.rateDate ? ` (PTAX ${finance.rateDate})` : ""}. Custos de
            IA baseados em preços públicos dos provedores.
          </Typography>
        </Box>

        {/* Totais do período */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}
        >
          <UsageStat label="Transcrições" value={totals?.transcripts ?? 0} />
          <UsageStat label="Roteiros" value={totals?.scripts ?? 0} />
          <UsageStat label="Insights" value={totals?.insights ?? 0} />
          <UsageStat label="Vídeos IA" value={totals?.avatarVideos ?? 0} />
          <UsageStat label="Tokens" value={totals?.tokens ?? 0} />
        </Stack>

        {isLoading && <LinearProgress sx={{ mb: 1 }} />}

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 960 }}>
            <TableHead>
              <TableRow>
                {(
                  [
                    ["Usuário", 240],
                    ["Plano / Situação", 150],
                    ["Transcrições", 100],
                    ["Roteiros", 90],
                    ["Insights", 90],
                    ["Vídeos IA", 90],
                    ["Tokens", 100],
                    ["Total", 80],
                    ["Custo IA", 100],
                  ] as [string, number][]
                ).map(([h, w]) => (
                  <TableCell key={h} sx={{ ...headCellSx, minWidth: w }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data && data.users.length > 0 ? (
                data.users.map((u) => (
                  <TableRow
                    key={u.id}
                    sx={{ "&:hover": { background: "rgba(255,255,255,0.02)" } }}
                  >
                    <TableCell sx={{ ...cellSx, maxWidth: 240 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ minWidth: 0 }}
                      >
                        <Avatar
                          sx={{
                            width: 30,
                            height: 30,
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            bgcolor: getAvatarColor(u.email),
                            color: "#0a0f1e",
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(u.name, u.email)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontSize: "0.85rem",
                              color: "rgba(255,255,255,0.9)",
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {u.name ?? <span style={{ opacity: 0.4 }}>—</span>}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "0.72rem",
                              color: "rgba(255,255,255,0.4)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {u.email}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                        <Box
                          component="span"
                          sx={{
                            alignSelf: "flex-start",
                            px: 0.9,
                            py: 0.2,
                            borderRadius: 1,
                            fontSize: "0.66rem",
                            fontWeight: 700,
                            color: SITUACAO_CHIP[u.situacao].color,
                            background: SITUACAO_CHIP[u.situacao].bg,
                          }}
                        >
                          {SITUACAO_CHIP[u.situacao].label}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: "0.72rem",
                            color: "rgba(255,255,255,0.55)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 150,
                          }}
                        >
                          {u.planName ?? "—"}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={cellSx}>{u.transcripts}</TableCell>
                    <TableCell sx={cellSx}>{u.scripts}</TableCell>
                    <TableCell sx={cellSx}>{u.insights}</TableCell>
                    <TableCell sx={cellSx}>{u.avatarVideos}</TableCell>
                    <TableCell sx={cellSx}>
                      {u.tokens.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography
                        sx={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "#2DD4FF",
                        }}
                      >
                        {u.total}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography
                        sx={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.75)",
                        }}
                      >
                        {fmtBrlShort(u.aiCostBrl)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    sx={{
                      color: "rgba(255,255,255,0.4)",
                      borderColor: "rgba(255,255,255,0.06)",
                      textAlign: "center",
                      py: 4,
                    }}
                  >
                    {isLoading ? "Carregando..." : "Nenhum consumo no período."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {data && data.pagination.totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Pagination
              count={data.pagination.totalPages}
              page={page}
              onChange={(_e, p) => setPage(p)}
              size="small"
              sx={{
                "& .MuiPaginationItem-root": { color: "rgba(255,255,255,0.5)" },
                "& .Mui-selected": {
                  background: "rgba(45,212,255,0.15) !important",
                  color: "#2DD4FF",
                },
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function UsersTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [view, setView] = useState(0); // 0 = Contas, 1 = Uso
  const [accessGroup, setAccessGroup] = useState<AccountFilterGroup>("all");
  const [typeFilter, setTypeFilter] = useState<AccountTypeFilter>("all");
  const [updating, startUpdating] = useTransition();

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
  if (accessGroup !== "all") params.set("access", accessGroup);
  if (typeFilter !== "all") params.set("type", typeFilter);

  const { data, isLoading, mutate } = useSWR<UsersResponse>(
    `/api/admin/users?${params.toString()}`,
    fetcher,
  );

  const filteredUsers = data?.users;
  const summary = data?.summary;

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  // Debounce search — auto-search 400ms after typing stops
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
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
      {/* View tabs — visões diferentes (não status): Contas e Uso */}
      <Tabs
        value={view}
        onChange={(_, v) => {
          setView(v);
          setPage(1);
        }}
        sx={{
          mb: 2,
          "& .MuiTab-root": {
            color: "rgba(255,255,255,0.5)",
            textTransform: "none",
            minHeight: 44,
            fontSize: "0.9rem",
            fontWeight: 600,
            "&.Mui-selected": { color: "#2DD4FF" },
          },
          "& .MuiTabs-indicator": { background: "#2DD4FF" },
        }}
      >
        <Tab label="Contas" />
        <Tab label="Uso" />
      </Tabs>

      {view === 1 ? (
        <UsageView />
      ) : (
        <>
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
                    InputProps={{
                      endAdornment: searchInput ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setSearchInput("")}
                            edge="end"
                            sx={{
                              color: "rgba(255,255,255,0.4)",
                              "&:hover": { color: "#fff" },
                              p: 0.25,
                            }}
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
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
              {/* Filtros: situação de acesso + tipo de conta + atalhos rápidos */}
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", md: "center" }}
                sx={{ mb: 2 }}
              >
                <Select
                  value={accessGroup}
                  onChange={(e) => {
                    setAccessGroup(e.target.value as AccountFilterGroup);
                    setPage(1);
                  }}
                  size="small"
                  sx={{
                    color: "#fff",
                    minWidth: 180,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255,255,255,0.15)",
                    },
                  }}
                >
                  {ACCESS_FILTER_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>

                <Select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as AccountTypeFilter);
                    setPage(1);
                  }}
                  size="small"
                  sx={{
                    color: "#fff",
                    minWidth: 160,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255,255,255,0.15)",
                    },
                  }}
                >
                  {TYPE_FILTER_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>

                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: "wrap", gap: 1 }}
                >
                  {QUICK_ACCESS_CHIPS.map((c) => {
                    const selected = accessGroup === c.value;
                    const n = summary ? c.count(summary) : null;
                    return (
                      <Chip
                        key={c.value}
                        label={n != null ? `${c.label} (${n})` : c.label}
                        size="small"
                        onClick={() => {
                          setAccessGroup(selected ? "all" : c.value);
                          setPage(1);
                        }}
                        sx={{
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          color: selected ? "#0a0f1e" : "rgba(255,255,255,0.7)",
                          background: selected
                            ? "#2DD4FF"
                            : "rgba(255,255,255,0.06)",
                          fontWeight: selected ? 700 : 500,
                          "&:hover": {
                            background: selected
                              ? "#5BE0FF"
                              : "rgba(255,255,255,0.12)",
                          },
                        }}
                      />
                    );
                  })}
                </Stack>
              </Stack>

              {(isLoading || updating) && <LinearProgress sx={{ mb: 1 }} />}

              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 1000 }}>
                  <TableHead>
                    <TableRow>
                      {(
                        [
                          ["Usuário", 240],
                          ["Tipo", 100],
                          ["Acesso", 150],
                          ["Plano", 110],
                          ["Acesso até", 100],
                          ["Origem", 150],
                          ["Último acesso", 120],
                          ["Ações", 60],
                        ] as [string, number][]
                      ).map(([h, w]) => (
                        <TableCell key={h} sx={{ ...headCellSx, minWidth: w }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers && filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => {
                        const typeChip = ACCOUNT_TYPE_CHIP[u.accountType];
                        const isEditable = isUserEditable(u);
                        const sub = u.subscriptions?.[0];

                        return (
                          <TableRow
                            key={u.id}
                            sx={{
                              "&:hover": {
                                background: "rgba(255,255,255,0.02)",
                              },
                            }}
                          >
                            {/* Usuário (nome + email + avatar) */}
                            <TableCell sx={{ ...cellSx, maxWidth: 240 }}>
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1.5}
                                sx={{ minWidth: 0 }}
                              >
                                <Avatar
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    fontSize: "0.8rem",
                                    fontWeight: 700,
                                    bgcolor: getAvatarColor(u.email),
                                    color: "#0a0f1e",
                                    flexShrink: 0,
                                  }}
                                >
                                  {getInitials(u.name, u.email)}
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                  <Tooltip
                                    title={u.name ?? u.email}
                                    placement="top"
                                    disableInteractive
                                  >
                                    <Typography
                                      sx={{
                                        fontSize: "0.85rem",
                                        color: "rgba(255,255,255,0.9)",
                                        fontWeight: 500,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {u.name ?? (
                                        <span style={{ opacity: 0.4 }}>—</span>
                                      )}
                                    </Typography>
                                  </Tooltip>
                                  <Tooltip
                                    title={u.email}
                                    placement="bottom"
                                    disableInteractive
                                  >
                                    <Typography
                                      sx={{
                                        fontSize: "0.72rem",
                                        color: "rgba(255,255,255,0.4)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {u.email}
                                    </Typography>
                                  </Tooltip>
                                </Box>
                              </Stack>
                            </TableCell>

                            {/* Tipo (admin / assinante / cortesia / cadastro) */}
                            <TableCell sx={cellSx}>
                              <Chip
                                label={ACCOUNT_TYPE_LABEL[u.accountType]}
                                size="small"
                                sx={{
                                  background: typeChip.bg,
                                  color: typeChip.color,
                                  fontSize: "0.75rem",
                                }}
                              />
                            </TableCell>

                            {/* Acesso (estado efetivo da conta) */}
                            <TableCell sx={cellSx}>
                              {(() => {
                                const sc =
                                  ACCOUNT_STATE_COLORS[u.accountState] ??
                                  defaultStatusStyle;
                                return (
                                  <Chip
                                    label={
                                      ACCOUNT_STATE_LABEL[u.accountState] ??
                                      u.accountState
                                    }
                                    size="small"
                                    sx={{
                                      background: sc.bg,
                                      color: sc.color,
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      height: 22,
                                    }}
                                  />
                                );
                              })()}
                            </TableCell>

                            {/* Plano */}
                            <TableCell sx={cellSx}>
                              {sub?.plan?.name ? (
                                <Tooltip
                                  title={sub.plan.name}
                                  placement="top"
                                  disableInteractive
                                >
                                  <Chip
                                    label={sub.plan.name}
                                    size="small"
                                    sx={{
                                      background: "rgba(45,212,255,0.1)",
                                      color: "#2DD4FF",
                                      fontSize: "0.72rem",
                                      maxWidth: 100,
                                      ".MuiChip-label": {
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      },
                                    }}
                                  />
                                </Tooltip>
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            {/* Acesso até */}
                            <TableCell sx={cellSx}>
                              {sub ? (
                                sub.endedAt ? (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color:
                                        new Date(sub.endedAt) < new Date()
                                          ? "#EF5350"
                                          : "rgba(255,255,255,0.6)",
                                      fontSize: "0.8rem",
                                    }}
                                  >
                                    {formatDate(sub.endedAt)}
                                  </Typography>
                                ) : sub.status === "ACTIVE" ? (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: "#81C784",
                                      fontSize: "0.8rem",
                                    }}
                                  >
                                    Em vigor
                                  </Typography>
                                ) : (
                                  "—"
                                )
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            {/* Origem (quem criou / canal) */}
                            <TableCell sx={cellSx}>
                              {u.origin === "admin" ? (
                                <Tooltip
                                  title={
                                    u.creator
                                      ? `Criado por ${u.creator.name ?? u.creator.email}`
                                      : "Criado pelo admin"
                                  }
                                  placement="top"
                                  disableInteractive
                                >
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                      sx={{
                                        fontSize: "0.78rem",
                                        color: "#2DD4FF",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      Admin
                                    </Typography>
                                    {u.creator && (
                                      <Typography
                                        sx={{
                                          fontSize: "0.68rem",
                                          color: "rgba(255,255,255,0.4)",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          maxWidth: 130,
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        {u.creator.name ?? u.creator.email}
                                      </Typography>
                                    )}
                                  </Box>
                                </Tooltip>
                              ) : u.origin === "hotmart" ? (
                                <Typography
                                  sx={{
                                    fontSize: "0.78rem",
                                    color: "rgba(255,255,255,0.6)",
                                  }}
                                >
                                  Hotmart
                                </Typography>
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            {/* Último acesso */}
                            <TableCell sx={cellSx}>
                              {u.lastLoginAt ? (
                                <Tooltip
                                  title={new Date(u.lastLoginAt).toLocaleString(
                                    "pt-BR",
                                  )}
                                  placement="top"
                                  disableInteractive
                                >
                                  <Typography
                                    sx={{
                                      fontSize: "0.8rem",
                                      color: "rgba(255,255,255,0.6)",
                                    }}
                                  >
                                    {formatDate(u.lastLoginAt)}
                                  </Typography>
                                </Tooltip>
                              ) : (
                                <Typography
                                  sx={{
                                    fontSize: "0.8rem",
                                    color: "rgba(255,255,255,0.3)",
                                  }}
                                >
                                  Nunca
                                </Typography>
                              )}
                            </TableCell>

                            {/* Ações */}
                            <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                              <RowActionsMenu
                                user={u}
                                isEditable={isEditable}
                                onEdit={() => setEditUser(u)}
                                onResetPassword={() =>
                                  handleResetPassword(u.id)
                                }
                                onDelete={() =>
                                  setConfirmDialog({ type: "delete", user: u })
                                }
                                onDeactivate={() =>
                                  setConfirmDialog({
                                    type: "deactivate",
                                    user: u,
                                  })
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
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
        </>
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
