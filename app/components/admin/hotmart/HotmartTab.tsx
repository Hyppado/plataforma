"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Check as CheckIcon,
  ContentCopy,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Sync as SyncIcon,
  Webhook as WebhookIcon,
  Storefront as StorefrontIcon,
  ListAlt as ListAltIcon,
} from "@mui/icons-material";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocalPlan {
  id: string;
  code: string;
  name: string;
  displayPrice: string | null;
  priceAmount: number;
  currency: string;
  periodicity: "MONTHLY" | "ANNUAL";
  isActive: boolean;
  sortOrder: number;
  hotmartPlanCode: string | null;
  transcriptsPerMonth: number;
  scriptsPerMonth: number;
  insightTokensMonthlyMax: number;
  scriptTokensMonthlyMax: number;
  insightMaxOutputTokens: number;
  scriptMaxOutputTokens: number;
}

interface PlansResponse {
  plans: LocalPlan[];
}

interface SyncResult {
  created: number;
  updated: number;
  plans: { id: string; code: string; name: string; hotmartPlanCode: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

const cellSx = {
  color: "rgba(255,255,255,0.85)",
  fontSize: "0.8rem",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  py: 1,
};

const headerCellSx = {
  ...cellSx,
  color: "rgba(255,255,255,0.5)",
  fontWeight: 600,
  fontSize: "0.72rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function periodicityLabel(p: string): string {
  const map: Record<string, string> = {
    MONTHLY: "Mensal",
    BIMONTHLY: "Bimestral",
    QUARTERLY: "Trimestral",
    BIANNUAL: "Semestral",
    ANNUAL: "Anual",
  };
  return map[p] ?? p;
}

function formatPrice(cents: number, currency: string): string {
  const value = cents / 100;
  if (currency === "BRL") return `R$ ${value.toFixed(2).replace(".", ",")}`;
  if (currency === "USD") return `$ ${value.toFixed(2)}`;
  return `${currency} ${value.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Webhook endpoint card
// ---------------------------------------------------------------------------

function WebhookEndpointCard() {
  const [copied, setCopied] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/hotmart`
      : "https://<seu-domínio>/api/webhooks/hotmart";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Card sx={cardStyle}>
      <CardHeader
        avatar={<WebhookIcon sx={{ color: "#2DD4FF" }} />}
        title="Webhook Endpoint"
        subheader="URL para cadastrar no painel da Hotmart"
        titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
        subheaderTypographyProps={{ fontSize: "0.8rem" }}
      />
      <CardContent>
        <Stack spacing={1.5}>
          <Typography
            variant="body2"
            sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" }}
          >
            Cadastre esta URL em{" "}
            <strong>Hotmart → Ferramentas → Webhooks → Nova URL</strong>.
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1,
              borderRadius: 1,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(45,212,255,0.15)",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                fontFamily: "monospace",
                fontSize: "0.78rem",
                color: "rgba(255,255,255,0.85)",
                wordBreak: "break-all",
                userSelect: "all",
              }}
            >
              {webhookUrl}
            </Typography>
            <Button
              size="small"
              onClick={handleCopy}
              startIcon={
                copied ? (
                  <CheckIcon sx={{ fontSize: 14 }} />
                ) : (
                  <ContentCopy sx={{ fontSize: 14 }} />
                )
              }
              sx={{
                minWidth: "auto",
                px: 1.5,
                color: copied ? "#2ecc71" : "#2DD4FF",
                fontSize: "0.75rem",
                textTransform: "none",
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Product config card
// ---------------------------------------------------------------------------

function ProductConfigCard() {
  const { data, mutate } = useSWR<{ productId: string | null }>(
    "/api/admin/hotmart/product",
    fetcher,
  );

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setValue(data?.productId ?? "");
    setEditing(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!value.trim()) {
      setError("Informe o Product ID");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hotmart/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: value.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      await mutate();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={cardStyle}>
      <CardHeader
        avatar={<StorefrontIcon sx={{ color: "#2DD4FF" }} />}
        title="Produto Hotmart"
        subheader="ID numérico do produto (âncora para planos)"
        titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
        subheaderTypographyProps={{ fontSize: "0.8rem" }}
      />
      <CardContent>
        <Stack spacing={1.5}>
          {!editing ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                borderRadius: 1,
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  color: data?.productId
                    ? "rgba(255,255,255,0.85)"
                    : "rgba(255,255,255,0.35)",
                }}
              >
                {data?.productId ?? "Não configurado"}
              </Typography>
              <Tooltip title="Editar Product ID">
                <IconButton
                  size="small"
                  onClick={startEdit}
                  sx={{ color: "#2DD4FF" }}
                >
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                size="small"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Ex: 7420891"
                error={!!error}
                helperText={error}
                disabled={saving}
                sx={{
                  flex: 1,
                  "& .MuiInputBase-input": {
                    fontSize: "0.85rem",
                    fontFamily: "monospace",
                  },
                }}
              />
              <IconButton
                size="small"
                onClick={handleSave}
                disabled={saving}
                sx={{ color: "#2ecc71" }}
              >
                {saving ? (
                  <CircularProgress size={16} />
                ) : (
                  <SaveIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setEditing(false)}
                disabled={saving}
                sx={{ color: "rgba(255,255,255,0.4)" }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          )}
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem" }}
          >
            Encontre o Product ID no painel Hotmart → Produtos → Configurações.
            Ele será usado para listar os planos automaticamente.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quota edit row
// ---------------------------------------------------------------------------

interface QuotaEditState {
  transcriptsPerMonth: number;
  scriptsPerMonth: number;
  insightTokensMonthlyMax: number;
  scriptTokensMonthlyMax: number;
  insightMaxOutputTokens: number;
  scriptMaxOutputTokens: number;
}

function QuotaEditRow({
  plan,
  onSaved,
}: {
  plan: LocalPlan;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotas, setQuotas] = useState<QuotaEditState>({
    transcriptsPerMonth: plan.transcriptsPerMonth,
    scriptsPerMonth: plan.scriptsPerMonth,
    insightTokensMonthlyMax: plan.insightTokensMonthlyMax,
    scriptTokensMonthlyMax: plan.scriptTokensMonthlyMax,
    insightMaxOutputTokens: plan.insightMaxOutputTokens,
    scriptMaxOutputTokens: plan.scriptMaxOutputTokens,
  });

  const startEdit = () => {
    setQuotas({
      transcriptsPerMonth: plan.transcriptsPerMonth,
      scriptsPerMonth: plan.scriptsPerMonth,
      insightTokensMonthlyMax: plan.insightTokensMonthlyMax,
      scriptTokensMonthlyMax: plan.scriptTokensMonthlyMax,
      insightMaxOutputTokens: plan.insightMaxOutputTokens,
      scriptMaxOutputTokens: plan.scriptMaxOutputTokens,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, ...quotas }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setEditing(false);
      onSaved();
    } catch {
      // silently fail — user sees no change
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof QuotaEditState, val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0) setQuotas((prev) => ({ ...prev, [key]: n }));
  };

  const inputSx = {
    width: 70,
    "& .MuiInputBase-input": {
      fontSize: "0.75rem",
      textAlign: "center" as const,
      py: 0.5,
      px: 0.5,
    },
  };

  return (
    <TableRow sx={{ "&:hover": { background: "rgba(255,255,255,0.02)" } }}>
      <TableCell sx={cellSx}>
        <Stack spacing={0.25}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontSize: "0.82rem" }}
          >
            {plan.name}
          </Typography>
          {plan.hotmartPlanCode && (
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255,255,255,0.4)",
                fontFamily: "monospace",
                fontSize: "0.68rem",
              }}
            >
              {plan.hotmartPlanCode}
            </Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell sx={cellSx}>
        <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
          {formatPrice(plan.priceAmount, plan.currency)}
        </Typography>
      </TableCell>
      <TableCell sx={cellSx}>
        <Chip
          label={periodicityLabel(plan.periodicity)}
          size="small"
          sx={{
            fontSize: "0.68rem",
            height: 20,
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.6)",
          }}
        />
      </TableCell>
      <TableCell sx={cellSx}>
        {editing ? (
          <TextField
            size="small"
            value={quotas.transcriptsPerMonth}
            onChange={(e) => setField("transcriptsPerMonth", e.target.value)}
            sx={inputSx}
          />
        ) : (
          plan.transcriptsPerMonth
        )}
      </TableCell>
      <TableCell sx={cellSx}>
        {editing ? (
          <TextField
            size="small"
            value={quotas.scriptsPerMonth}
            onChange={(e) => setField("scriptsPerMonth", e.target.value)}
            sx={inputSx}
          />
        ) : (
          plan.scriptsPerMonth
        )}
      </TableCell>
      <TableCell sx={cellSx}>
        {editing ? (
          <Stack spacing={0.5}>
            <TextField
              size="small"
              value={quotas.insightTokensMonthlyMax}
              onChange={(e) =>
                setField("insightTokensMonthlyMax", e.target.value)
              }
              sx={inputSx}
              placeholder="Insight"
            />
            <TextField
              size="small"
              value={quotas.scriptTokensMonthlyMax}
              onChange={(e) =>
                setField("scriptTokensMonthlyMax", e.target.value)
              }
              sx={inputSx}
              placeholder="Script"
            />
          </Stack>
        ) : (
          <Stack spacing={0}>
            <Typography
              variant="caption"
              sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}
            >
              I: {plan.insightTokensMonthlyMax.toLocaleString()}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}
            >
              S: {plan.scriptTokensMonthlyMax.toLocaleString()}
            </Typography>
          </Stack>
        )}
      </TableCell>
      <TableCell sx={cellSx}>
        <Chip
          label={plan.isActive ? "Ativo" : "Inativo"}
          size="small"
          sx={{
            fontSize: "0.68rem",
            height: 20,
            background: plan.isActive
              ? "rgba(46,204,113,0.1)"
              : "rgba(255,255,255,0.05)",
            color: plan.isActive ? "#2ecc71" : "rgba(255,255,255,0.4)",
            border: `1px solid ${plan.isActive ? "rgba(46,204,113,0.2)" : "rgba(255,255,255,0.08)"}`,
          }}
        />
      </TableCell>
      <TableCell sx={cellSx}>
        {editing ? (
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={handleSave}
              disabled={saving}
              sx={{ color: "#2ecc71" }}
            >
              {saving ? (
                <CircularProgress size={14} />
              ) : (
                <SaveIcon sx={{ fontSize: 14 }} />
              )}
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setEditing(false)}
              sx={{ color: "rgba(255,255,255,0.4)" }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
        ) : (
          <Tooltip title="Editar quotas">
            <IconButton
              size="small"
              onClick={startEdit}
              sx={{ color: "#2DD4FF" }}
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Plans card
// ---------------------------------------------------------------------------

function PlansCard() {
  const plansSWR = useSWR<PlansResponse>("/api/admin/plans", fetcher);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const hotmartPlans = (plansSWR.data?.plans ?? []).filter(
    (p) => p.hotmartPlanCode,
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/hotmart/plans", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const result: SyncResult = await res.json();
      setSyncResult(result);
      await plansSWR.mutate();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [plansSWR]);

  return (
    <Card sx={cardStyle}>
      <CardHeader
        avatar={<ListAltIcon sx={{ color: "#2DD4FF" }} />}
        title="Planos"
        subheader="Planos sincronizados da Hotmart com quotas configuráveis"
        titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
        subheaderTypographyProps={{ fontSize: "0.8rem" }}
        action={
          <Button
            size="small"
            onClick={handleSync}
            disabled={syncing}
            startIcon={
              syncing ? (
                <CircularProgress size={14} />
              ) : (
                <SyncIcon sx={{ fontSize: 16 }} />
              )
            }
            sx={{
              color: "#2DD4FF",
              textTransform: "none",
              fontSize: "0.78rem",
            }}
          >
            Sincronizar
          </Button>
        }
      />
      <CardContent>
        {plansSWR.isLoading && <LinearProgress sx={{ mb: 2 }} />}

        {syncResult && (
          <Alert
            severity="success"
            onClose={() => setSyncResult(null)}
            sx={{
              mb: 2,
              background: "rgba(46,204,113,0.08)",
              border: "1px solid rgba(46,204,113,0.2)",
            }}
          >
            Sincronização concluída: {syncResult.created} criado(s),{" "}
            {syncResult.updated} atualizado(s).
          </Alert>
        )}

        {syncError && (
          <Alert
            severity="error"
            onClose={() => setSyncError(null)}
            sx={{ mb: 2 }}
          >
            {syncError}
          </Alert>
        )}

        {hotmartPlans.length === 0 && !plansSWR.isLoading ? (
          <Box
            sx={{
              p: 3,
              textAlign: "center",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: "rgba(255,255,255,0.4)", mb: 1 }}
            >
              Nenhum plano sincronizado ainda.
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.3)" }}
            >
              Configure o Product ID acima e clique em{" "}
              <strong>Sincronizar</strong> para importar os planos da Hotmart.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={headerCellSx}>Plano</TableCell>
                  <TableCell sx={headerCellSx}>Preço</TableCell>
                  <TableCell sx={headerCellSx}>Período</TableCell>
                  <TableCell sx={headerCellSx}>Transcrições</TableCell>
                  <TableCell sx={headerCellSx}>Scripts</TableCell>
                  <TableCell sx={headerCellSx}>Tokens/mês</TableCell>
                  <TableCell sx={headerCellSx}>Status</TableCell>
                  <TableCell sx={headerCellSx} width={80}>
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hotmartPlans.map((plan) => (
                  <QuotaEditRow
                    key={plan.id}
                    plan={plan}
                    onSaved={() => plansSWR.mutate()}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HotmartTab() {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: "#fff", mb: 0.5 }}
        >
          Hotmart — Integração
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
          Configuração de produto, planos e webhook da Hotmart.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ProductConfigCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <WebhookEndpointCard />
        </Grid>
        <Grid item xs={12}>
          <PlansCard />
        </Grid>
      </Grid>
    </Box>
  );
}
