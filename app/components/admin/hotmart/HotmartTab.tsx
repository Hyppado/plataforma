"use client";

import { useEffect, useState } from "react";
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
  Collapse,
  Divider,
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
  ExpandLess,
  ExpandMore,
  Save as SaveIcon,
  Close as CloseIcon,
  StarRounded,
  StarBorderRounded,
  VisibilityOutlined,
  VisibilityOffOutlined,
  Webhook as WebhookIcon,
  Storefront as StorefrontIcon,
  ListAlt as ListAltIcon,
  VpnKey as VpnKeyIcon,
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
  highlight: boolean;
  badge: string | null;
  description: string | null;
  features: string[];
  checkoutUrl: string | null;
  showOnLanding: boolean;
}

interface PlansResponse {
  plans: LocalPlan[];
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
// Plan row (quotas + highlight toggle + visibility toggle + description/features collapse)
// ---------------------------------------------------------------------------

const COL_COUNT = 9;

interface QuotaEditState {
  transcriptsPerMonth: number;
  scriptsPerMonth: number;
}

interface DetailsEditState {
  description: string;
  features: string; // one per line
  badge: string;
  checkoutUrl: string;
}

function PlanRow({ plan, onSaved }: { plan: LocalPlan; onSaved: () => void }) {
  // --- quota inline editing ---
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotas, setQuotas] = useState<QuotaEditState>({
    transcriptsPerMonth: plan.transcriptsPerMonth,
    scriptsPerMonth: plan.scriptsPerMonth,
  });

  const startEdit = () => {
    setQuotas({
      transcriptsPerMonth: plan.transcriptsPerMonth,
      scriptsPerMonth: plan.scriptsPerMonth,
    });
    setEditing(true);
  };

  const handleSaveQuotas = async () => {
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
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof QuotaEditState, val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0) setQuotas((prev) => ({ ...prev, [key]: n }));
  };

  // --- highlight toggle ---
  const [togglingHighlight, setTogglingHighlight] = useState(false);

  // --- showOnLanding toggle ---
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [localVisible, setLocalVisible] = useState(plan.showOnLanding);

  // keep in sync when parent data refreshes
  useEffect(() => {
    setLocalVisible(plan.showOnLanding);
  }, [plan.showOnLanding]);

  const handleToggleVisibility = async () => {
    const next = !localVisible;
    setLocalVisible(next); // optimistic — instant UI update
    setTogglingVisibility(true);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan.id,
          showOnLanding: next,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      onSaved();
    } catch {
      setLocalVisible(!next); // revert on error
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleToggleHighlight = async () => {
    setTogglingHighlight(true);
    const newHighlight = !plan.highlight;
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan.id,
          highlight: newHighlight,
          badge: newHighlight ? (plan.badge ?? "Mais escolhido") : null,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      onSaved();
    } catch {
      // silently fail
    } finally {
      setTogglingHighlight(false);
    }
  };

  // --- details collapse ---
  const [expanded, setExpanded] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [details, setDetails] = useState<DetailsEditState>({
    description: plan.description ?? "",
    features: plan.features.join("\n"),
    badge: plan.badge ?? "",
    checkoutUrl: plan.checkoutUrl ?? "",
  });

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    const featuresArray = details.features
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan.id,
          description: details.description.trim() || null,
          features: featuresArray,
          badge: details.badge.trim() || null,
          checkoutUrl: details.checkoutUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      onSaved();
      setExpanded(false);
    } catch {
      // silently fail
    } finally {
      setSavingDetails(false);
    }
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
    <>
      <TableRow sx={{ "&:hover": { background: "rgba(255,255,255,0.02)" } }}>
        {/* Plano */}
        <TableCell sx={cellSx}>
          <Stack spacing={0.25}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontSize: "0.82rem" }}
              >
                {plan.name}
              </Typography>
              {plan.highlight && (
                <Chip
                  label={plan.badge ?? "Destaque"}
                  size="small"
                  sx={{
                    fontSize: "0.62rem",
                    height: 16,
                    background: "rgba(255,215,0,0.12)",
                    color: "#FFD700",
                    border: "1px solid rgba(255,215,0,0.25)",
                  }}
                />
              )}
            </Stack>
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
        {/* Preço */}
        <TableCell sx={cellSx}>
          <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
            {formatPrice(plan.priceAmount, plan.currency)}
          </Typography>
        </TableCell>
        {/* Período */}
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
        {/* Transcrições */}
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
        {/* Scripts */}
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
        {/* Status */}
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
              border: `1px solid ${
                plan.isActive
                  ? "rgba(46,204,113,0.2)"
                  : "rgba(255,255,255,0.08)"
              }`,
            }}
          />
        </TableCell>
        {/* Visível na landing */}
        <TableCell sx={cellSx}>
          <Tooltip
            title={
              localVisible
                ? "Ocultar da landing page"
                : "Exibir na landing page"
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                sx={{
                  color: localVisible ? "#2DD4FF" : "rgba(255,255,255,0.2)",
                  transition: "color 0.2s",
                }}
              >
                {togglingVisibility ? (
                  <CircularProgress size={14} />
                ) : localVisible ? (
                  <VisibilityOutlined sx={{ fontSize: 18 }} />
                ) : (
                  <VisibilityOffOutlined sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
        {/* Destaque */}
        <TableCell sx={cellSx}>
          <Tooltip
            title={
              plan.highlight ? "Remover destaque" : "Definir como destaque"
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={handleToggleHighlight}
                disabled={togglingHighlight}
                sx={{
                  color: plan.highlight ? "#FFD700" : "rgba(255,255,255,0.2)",
                  transition: "color 0.2s",
                }}
              >
                {togglingHighlight ? (
                  <CircularProgress size={14} />
                ) : plan.highlight ? (
                  <StarRounded sx={{ fontSize: 18 }} />
                ) : (
                  <StarBorderRounded sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
        {/* Ações */}
        <TableCell sx={cellSx}>
          <Stack direction="row" spacing={0.25} alignItems="center">
            {/* Collapse toggle */}
            <Tooltip title={expanded ? "Fechar detalhes" : "Editar detalhes"}>
              <IconButton
                size="small"
                onClick={() => setExpanded((v) => !v)}
                sx={{ color: "rgba(255,255,255,0.4)" }}
              >
                {expanded ? (
                  <ExpandLess sx={{ fontSize: 16 }} />
                ) : (
                  <ExpandMore sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
            {/* Quota edit */}
            {editing ? (
              <>
                <IconButton
                  size="small"
                  onClick={handleSaveQuotas}
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
              </>
            ) : (
              <Tooltip title="Editar quotas">
                <IconButton
                  size="small"
                  onClick={startEdit}
                  sx={{ color: "primary.main" }}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </TableCell>
      </TableRow>

      {/* Collapse row — description, features, badge */}
      <TableRow>
        <TableCell
          colSpan={COL_COUNT}
          sx={{
            p: 0,
            borderBottom: expanded
              ? "1px solid rgba(255,255,255,0.06)"
              : "none",
          }}
        >
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box
              sx={{
                p: 2,
                background: "rgba(0,0,0,0.25)",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.4)",
                  mb: 1.5,
                  display: "block",
                }}
              >
                Detalhes exibidos na landing page
              </Typography>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Descrição"
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                    value={details.description}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Breve descrição do plano"
                  />
                </Grid>
                <Grid item xs={12} md={5}>
                  <TextField
                    label="Benefícios (um por linha)"
                    fullWidth
                    size="small"
                    multiline
                    rows={5}
                    value={details.features}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        features: e.target.value,
                      }))
                    }
                    helperText="Cada linha vira um item no card do plano"
                    placeholder={`40 transcrições / mês\n70 insights / mês\nAcesso prioritário`}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Stack spacing={1.5}>
                    <TextField
                      label="Badge"
                      fullWidth
                      size="small"
                      value={details.badge}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          badge: e.target.value,
                        }))
                      }
                      helperText='Ex: "Mais escolhido"'
                      placeholder="Mais escolhido"
                    />
                    <TextField
                      label="Link de checkout"
                      fullWidth
                      size="small"
                      value={details.checkoutUrl}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          checkoutUrl: e.target.value,
                        }))
                      }
                      helperText="URL do botão na landing page"
                      placeholder="https://pay.hotmart.com/..."
                    />
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={handleSaveDetails}
                        disabled={savingDetails}
                        sx={{ textTransform: "none", fontSize: "0.75rem" }}
                      >
                        {savingDetails ? (
                          <CircularProgress size={12} />
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setExpanded(false);
                          setDetails({
                            description: plan.description ?? "",
                            features: plan.features.join("\n"),
                            badge: plan.badge ?? "",
                            checkoutUrl: plan.checkoutUrl ?? "",
                          });
                        }}
                        sx={{
                          textTransform: "none",
                          fontSize: "0.75rem",
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        Cancelar
                      </Button>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ---------------------------------------------------------------------------
// Plans card
// ---------------------------------------------------------------------------

export function PlansCard() {
  const plansSWR = useSWR<PlansResponse>("/api/admin/plans", fetcher);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const hotmartPlans = (plansSWR.data?.plans ?? []).filter(
    (p) => p.hotmartPlanCode,
  );

  // Auto-sync plans from Hotmart on mount
  useEffect(() => {
    let cancelled = false;
    async function syncOnLoad() {
      setSyncing(true);
      setSyncError(null);
      try {
        const res = await fetch("/api/admin/hotmart/plans", { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `${res.status}`);
        }
        if (!cancelled) await plansSWR.mutate();
      } catch (err) {
        if (!cancelled)
          setSyncError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }
    syncOnLoad();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card sx={cardStyle}>
      <CardHeader
        avatar={<ListAltIcon sx={{ color: "#2DD4FF" }} />}
        title="Planos"
        subheader="Planos sincronizados da Hotmart com quotas configuráveis"
        titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
        subheaderTypographyProps={{ fontSize: "0.8rem" }}
      />
      <CardContent>
        {(plansSWR.isLoading || syncing) && <LinearProgress sx={{ mb: 2 }} />}

        {syncError && (
          <Alert
            severity="error"
            onClose={() => setSyncError(null)}
            sx={{ mb: 2 }}
          >
            {syncError}
          </Alert>
        )}

        {hotmartPlans.length === 0 && !plansSWR.isLoading && !syncing ? (
          <Box
            sx={{
              p: 3,
              textAlign: "center",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)" }}>
              Nenhum plano encontrado.
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
                  <TableCell sx={headerCellSx}>Status</TableCell>
                  <TableCell sx={headerCellSx} width={50}>
                    Visível
                  </TableCell>
                  <TableCell sx={headerCellSx} width={50}>
                    Destaque
                  </TableCell>
                  <TableCell sx={headerCellSx} width={90}>
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hotmartPlans.map((plan) => (
                  <PlanRow
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
// Credentials card
// ---------------------------------------------------------------------------

interface CredentialsState {
  clientId: string;
  hasClientSecret: boolean;
  hasBasicToken: boolean;
  hasWebhookSecret: boolean;
}

function CredentialsCard() {
  const { data, mutate, isLoading } = useSWR<CredentialsState>(
    "/api/admin/hotmart/credentials",
    fetcher,
  );

  const SAVED = "__SAVED__";

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [basicToken, setBasicToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setClientId(data.clientId);
      if (data.hasClientSecret) setClientSecret(SAVED);
      if (data.hasBasicToken) setBasicToken(SAVED);
      if (data.hasWebhookSecret) setWebhookSecret(SAVED);
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { clientId: clientId.trim() };
      if (clientSecret.trim() && clientSecret !== SAVED)
        body.clientSecret = clientSecret.trim();
      if (basicToken.trim() && basicToken !== SAVED)
        body.basicToken = basicToken.trim();
      if (webhookSecret.trim() && webhookSecret !== SAVED)
        body.webhookSecret = webhookSecret.trim();

      const res = await fetch("/api/admin/hotmart/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status}`);

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await mutate();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const secretFieldProps = (
    value: string,
    onChange: (v: string) => void,
    hasSaved: boolean,
  ) => ({
    value,
    type: "password" as const,
    autoComplete: "new-password",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value),
    onFocus: () => {
      if (value === SAVED) onChange("");
    },
    onBlur: () => {
      if (value === "" && hasSaved) onChange(SAVED);
    },
    InputProps:
      value === SAVED
        ? { sx: { "& input": { color: "rgba(255,255,255,0.5)" } } }
        : undefined,
  });

  return (
    <Card sx={cardStyle}>
      <CardHeader
        avatar={<VpnKeyIcon sx={{ fontSize: 20, color: "secondary.main" }} />}
        title="Credenciais Hotmart"
        titleTypographyProps={{
          variant: "subtitle1",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}
        subheader="Configuradas no banco — têm prioridade sobre variáveis de ambiente"
        subheaderTypographyProps={{
          variant: "caption",
          color: "rgba(255,255,255,0.4)",
          fontSize: "0.72rem",
        }}
      />
      <CardContent>
        {isLoading ? (
          <LinearProgress sx={{ my: 2 }} />
        ) : (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Client ID"
                  fullWidth
                  size="small"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Seu Hotmart Client ID"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Client Secret"
                  fullWidth
                  size="small"
                  placeholder="Inserir novo valor"
                  {...secretFieldProps(
                    clientSecret,
                    setClientSecret,
                    data?.hasClientSecret ?? false,
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Basic Token (Base64)"
                  fullWidth
                  size="small"
                  placeholder="Inserir novo valor"
                  {...secretFieldProps(
                    basicToken,
                    setBasicToken,
                    data?.hasBasicToken ?? false,
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Webhook Secret (Hottok)"
                  fullWidth
                  size="small"
                  placeholder="Inserir novo valor"
                  {...secretFieldProps(
                    webhookSecret,
                    setWebhookSecret,
                    data?.hasWebhookSecret ?? false,
                  )}
                />
              </Grid>
            </Grid>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="flex-end"
            >
              <Button
                size="small"
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                startIcon={
                  saving ? (
                    <CircularProgress size={12} />
                  ) : saved ? (
                    <CheckIcon sx={{ fontSize: 14 }} />
                  ) : (
                    <SaveIcon sx={{ fontSize: 14 }} />
                  )
                }
                sx={{ textTransform: "none", fontSize: "0.8rem" }}
              >
                {saved ? "Salvo" : "Salvar"}
              </Button>
            </Stack>
          </Stack>
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
          <CredentialsCard />
        </Grid>
        <Grid item xs={12}>
          <PlansCard />
        </Grid>
      </Grid>
    </Box>
  );
}
