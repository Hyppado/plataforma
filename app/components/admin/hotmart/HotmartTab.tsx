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
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Check as CheckIcon,
  ContentCopy,
  Inventory2Outlined,
  Save as SaveIcon,
  Webhook as WebhookIcon,
} from "@mui/icons-material";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  displayPrice: string | null;
  priceAmount: number;
  periodicity: "MONTHLY" | "ANNUAL";
  isActive: boolean;
  hotmartProductId: string | null;
  hotmartPlanCode: string | null;
  hotmartOfferCode: string | null;
  transcriptsPerMonth: number;
  scriptsPerMonth: number;
}

interface PlansResponse {
  plans: Plan[];
}

/** Hotmart fields being edited, keyed by plan id */
interface EditState {
  hotmartProductId: string;
  hotmartPlanCode: string;
  hotmartOfferCode: string;
}

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

// ---------------------------------------------------------------------------
// Webhook endpoint card (self-contained)
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
// Plan Mapping Card
// ---------------------------------------------------------------------------

function PlanMappingCard({
  plan,
  editing,
  saving,
  saved,
  onChange,
  onSave,
}: {
  plan: Plan;
  editing: EditState;
  saving: boolean;
  saved: boolean;
  onChange: (field: keyof EditState, value: string) => void;
  onSave: () => void;
}) {
  const hasChanges =
    editing.hotmartProductId !== (plan.hotmartProductId ?? "") ||
    editing.hotmartPlanCode !== (plan.hotmartPlanCode ?? "") ||
    editing.hotmartOfferCode !== (plan.hotmartOfferCode ?? "");

  const isMapped = !!plan.hotmartProductId;

  return (
    <Card sx={cardStyle}>
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {plan.name}
            </Typography>
            <Chip
              label={plan.code}
              size="small"
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                background: "rgba(45,212,255,0.1)",
                color: "#2DD4FF",
                border: "1px solid rgba(45,212,255,0.2)",
                height: 22,
              }}
            />
            <Chip
              label={plan.periodicity === "MONTHLY" ? "Mensal" : "Anual"}
              size="small"
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
                height: 22,
              }}
            />
            {!plan.isActive && (
              <Chip
                label="Inativo"
                size="small"
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  background: "rgba(244,67,54,0.1)",
                  color: "#f44336",
                  height: 22,
                }}
              />
            )}
            <Chip
              label={isMapped ? "Mapeado" : "Não mapeado"}
              size="small"
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                background: isMapped
                  ? "rgba(46,204,113,0.1)"
                  : "rgba(255,193,7,0.1)",
                color: isMapped ? "#2ecc71" : "#ffc107",
                border: `1px solid ${isMapped ? "rgba(46,204,113,0.2)" : "rgba(255,193,7,0.2)"}`,
                height: 22,
              }}
            />
          </Stack>
        }
        subheader={
          <Typography
            variant="body2"
            sx={{ color: "rgba(255,255,255,0.4)", mt: 0.5 }}
          >
            {plan.displayPrice} — {plan.transcriptsPerMonth} transcrições /{" "}
            {plan.scriptsPerMonth} insights por mês
          </Typography>
        }
        sx={{
          "& .MuiCardHeader-subheader": { color: "rgba(255,255,255,0.4)" },
          pb: 1,
        }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Product ID"
              size="small"
              fullWidth
              value={editing.hotmartProductId}
              onChange={(e) => onChange("hotmartProductId", e.target.value)}
              placeholder="Ex: 7420891"
              helperText="ID do produto na Hotmart"
              sx={{
                "& .MuiOutlinedInput-root": {
                  background: "rgba(255,255,255,0.03)",
                },
              }}
            />
            <TextField
              label="Plan Code"
              size="small"
              fullWidth
              value={editing.hotmartPlanCode}
              onChange={(e) => onChange("hotmartPlanCode", e.target.value)}
              placeholder="Ex: plano1"
              helperText="planCode do payload do webhook"
              sx={{
                "& .MuiOutlinedInput-root": {
                  background: "rgba(255,255,255,0.03)",
                },
              }}
            />
            <TextField
              label="Offer Code"
              size="small"
              fullWidth
              value={editing.hotmartOfferCode}
              onChange={(e) => onChange("hotmartOfferCode", e.target.value)}
              placeholder="Ex: abc123"
              helperText="Código da oferta (fallback)"
              sx={{
                "& .MuiOutlinedInput-root": {
                  background: "rgba(255,255,255,0.03)",
                },
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              size="small"
              disabled={!hasChanges || saving}
              startIcon={saved ? <CheckIcon /> : <SaveIcon />}
              onClick={onSave}
              sx={{
                background: saved
                  ? "#2ecc71"
                  : hasChanges
                    ? "#2DD4FF"
                    : undefined,
                color: "#0a0f18",
                fontWeight: 700,
                "&:hover": {
                  background: saved ? "#27ae60" : "#1bb8e0",
                },
              }}
            >
              {saving ? "Salvando…" : saved ? "Salvo" : "Salvar mapeamento"}
            </Button>
            {saved && (
              <Typography
                variant="caption"
                sx={{ color: "#2ecc71", fontSize: "0.72rem" }}
              >
                Mapeamento atualizado com sucesso
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HotmartTab() {
  const plansSWR = useSWR<PlansResponse>("/api/admin/plans", fetcher);

  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const getEditState = useCallback(
    (plan: Plan): EditState =>
      edits[plan.id] ?? {
        hotmartProductId: plan.hotmartProductId ?? "",
        hotmartPlanCode: plan.hotmartPlanCode ?? "",
        hotmartOfferCode: plan.hotmartOfferCode ?? "",
      },
    [edits],
  );

  const handleChange = useCallback(
    (planId: string, plan: Plan, field: keyof EditState, value: string) => {
      setEdits((prev) => ({
        ...prev,
        [planId]: {
          ...getEditState(plan),
          [field]: value,
        },
      }));
    },
    [getEditState],
  );

  const handleSave = useCallback(
    async (planId: string) => {
      const editState = edits[planId];
      if (!editState) return;

      setSavingId(planId);
      setSavedId(null);
      setError(null);

      try {
        const res = await fetch("/api/admin/plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: planId,
            hotmartProductId: editState.hotmartProductId || null,
            hotmartPlanCode: editState.hotmartPlanCode || null,
            hotmartOfferCode: editState.hotmartOfferCode || null,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Erro ao salvar (${res.status})`);
        }

        startTransition(() => {
          setSavedId(planId);
          setSavingId(null);
          setEdits((prev) => {
            const next = { ...prev };
            delete next[planId];
            return next;
          });
        });

        await plansSWR.mutate();
        setTimeout(() => setSavedId(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setSavingId(null);
      }
    },
    [edits, plansSWR],
  );

  const plans = plansSWR.data?.plans ?? [];
  const isLoading = plansSWR.isLoading;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: "#fff", mb: 0.5 }}
        >
          Hotmart — Configuração
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
          Webhook, mapeamento de planos e integração com a Hotmart.
        </Typography>
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Webhook endpoint */}
        <Grid item xs={12} md={6}>
          <WebhookEndpointCard />
        </Grid>
      </Grid>

      {/* Plan mapping section */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ mt: 4, mb: 2 }}
      >
        <Inventory2Outlined sx={{ color: "#2DD4FF", fontSize: 24 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Mapeamento de Planos
        </Typography>
      </Stack>

      {isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={140} />
          <Skeleton variant="rounded" height={140} />
        </Stack>
      ) : plans.length === 0 ? (
        <Typography
          variant="body2"
          sx={{ color: "rgba(255,255,255,0.4)", textAlign: "center", py: 4 }}
        >
          Nenhum plano cadastrado.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {plans.map((plan) => (
            <PlanMappingCard
              key={plan.id}
              plan={plan}
              editing={getEditState(plan)}
              saving={savingId === plan.id}
              saved={savedId === plan.id}
              onChange={(field, value) =>
                handleChange(plan.id, plan, field, value)
              }
              onSave={() => handleSave(plan.id)}
            />
          ))}
        </Stack>
      )}

      {!isLoading && plans.length > 0 && (
        <Alert
          severity="info"
          sx={{
            mt: 3,
            background: "rgba(45,212,255,0.05)",
            border: "1px solid rgba(45,212,255,0.15)",
            "& .MuiAlert-icon": { color: "#2DD4FF" },
          }}
        >
          <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
            Quando um webhook <strong>PURCHASE_APPROVED</strong> chega da
            Hotmart, o sistema resolve o plano interno usando{" "}
            <strong>Product ID</strong> + <strong>Plan Code</strong>. Se nenhum
            plano for encontrado, uma notificação{" "}
            <strong>&quot;Identidade não resolvida&quot;</strong> é criada.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
