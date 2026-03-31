"use client";

import { useState, useCallback, useTransition } from "react";
import useSWR from "swr";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Check as CheckIcon,
  Save as SaveIcon,
  SettingsOutlined,
  SyncOutlined,
} from "@mui/icons-material";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Setting {
  key: string;
  value: string;
  label: string | null;
  group: string;
  type: string;
}

interface SettingsResponse {
  settings: Setting[];
}

interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: { offers: number; coupons: number };
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
// Component
// ---------------------------------------------------------------------------

export function HotmartTab() {
  const settingsSWR = useSWR<SettingsResponse>("/api/admin/settings", fetcher);

  const hotmartSettings = settingsSWR.data?.settings.filter(
    (s) => s.group === "hotmart",
  );

  const currentProductId =
    hotmartSettings?.find((s) => s.key === "hotmart.product_id")?.value ?? "";

  const [productId, setProductId] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Use local state if edited, otherwise use the SWR value
  const displayValue = productId ?? currentProductId;
  const hasChanges = productId !== null && productId !== currentProductId;

  const handleSave = useCallback(() => {
    if (!productId) return;
    setSaved(false);
    startSaving(async () => {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "hotmart.product_id",
          value: productId.trim(),
          label: "ID do Produto Hotmart",
          group: "hotmart",
          type: "text",
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erro ao salvar");
      }
      await settingsSWR.mutate();
      setProductId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }, [productId, settingsSWR]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync-hotmart", { method: "POST" });
      const body = (await res.json()) as SyncResult;
      setSyncResult(body);
    } catch {
      setSyncResult({ success: false, error: "Erro de rede" });
    } finally {
      setSyncing(false);
    }
  }, []);

  const isLoading = settingsSWR.isLoading;

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
          ID do produto, sincronização de planos e cupons.
        </Typography>
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {/* Product ID config */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardHeader
              avatar={<SettingsOutlined sx={{ color: "#2DD4FF" }} />}
              title="Produto"
              subheader="ID do produto Hotmart vinculado à plataforma"
              titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
              subheaderTypographyProps={{ fontSize: "0.8rem" }}
            />
            <CardContent>
              <Stack spacing={2}>
                {isLoading ? (
                  <Skeleton variant="rounded" height={40} />
                ) : (
                  <TextField
                    label="Product ID"
                    value={displayValue}
                    onChange={(e) => setProductId(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="Ex: 7420891"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        background: "rgba(0,0,0,0.2)",
                      },
                    }}
                  />
                )}
                <Button
                  variant="contained"
                  startIcon={saved ? <CheckIcon /> : <SaveIcon />}
                  disabled={!hasChanges || saving}
                  onClick={handleSave}
                  sx={{
                    background: saved
                      ? "rgba(46, 204, 113, 0.2)"
                      : hasChanges
                        ? "linear-gradient(135deg, #2DD4FF 0%, #1B8DFF 100%)"
                        : "rgba(255,255,255,0.06)",
                    color: saved ? "#2ecc71" : "#fff",
                    "&:hover": {
                      background: saved
                        ? "rgba(46, 204, 113, 0.3)"
                        : "linear-gradient(135deg, #1B8DFF 0%, #2DD4FF 100%)",
                    },
                    "&.Mui-disabled": {
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.3)",
                    },
                  }}
                >
                  {saving ? "Salvando..." : saved ? "Salvo" : "Salvar"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Sync card */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardHeader
              avatar={<SyncOutlined sx={{ color: "#2DD4FF" }} />}
              title="Sincronização"
              subheader="Importar planos (offers) e cupons do Hotmart"
              titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
              subheaderTypographyProps={{ fontSize: "0.8rem" }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.6)" }}
                >
                  Sincroniza os dados de ofertas e cupons do produto configurado
                  com o banco de dados local.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<SyncOutlined />}
                  disabled={syncing || !currentProductId}
                  onClick={handleSync}
                  sx={{
                    background:
                      "linear-gradient(135deg, #2DD4FF 0%, #1B8DFF 100%)",
                    color: "#fff",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #1B8DFF 0%, #2DD4FF 100%)",
                    },
                    "&.Mui-disabled": {
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.3)",
                    },
                  }}
                >
                  {syncing ? "Sincronizando..." : "Sincronizar Agora"}
                </Button>

                {!currentProductId && !isLoading && (
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255, 152, 0, 0.8)" }}
                  >
                    Configure o Product ID primeiro.
                  </Typography>
                )}

                {syncResult && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: syncResult.success
                        ? "rgba(46, 204, 113, 0.9)"
                        : "rgba(244, 67, 54, 0.9)",
                      fontWeight: 500,
                    }}
                  >
                    {syncResult.success
                      ? `Sync concluído — ${syncResult.data?.offers ?? 0} ofertas, ${syncResult.data?.coupons ?? 0} cupons`
                      : (syncResult.error ?? "Erro desconhecido")}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
