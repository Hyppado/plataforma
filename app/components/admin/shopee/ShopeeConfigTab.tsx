/**
 * app/components/admin/shopee/ShopeeConfigTab.tsx
 *
 * Aba de configuração da integração Shopee (Admin → Configuração).
 * Segue o mesmo padrão da aba Google AI.
 *
 * GET /api/admin/settings/shopee — status configurado + valores atuais
 * POST /api/admin/settings/shopee — salva credenciais (criptografadas) + parâmetros
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Autocomplete,
} from "@mui/material";
import { Check, Warning } from "@mui/icons-material";

/** Hashtag real devolvida pela busca no EchoTik. */
interface HashtagOption {
  id: string;
  name: string;
  videoCount: number;
  viewCount: number;
}

interface ShopeeConfig {
  configured: boolean;
  rankingLimit: string;
  rankingFrequency: string;
  achadinhosFrequency: string;
  achadinhosCount: string;
  achadinhosHashtagId: string;
}

export function ShopeeConfigTab() {
  const [config, setConfig] = useState<ShopeeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [affiliateAppId, setAffiliateAppId] = useState("");
  const [affiliateSecret, setAffiliateSecret] = useState("");
  const [rankingLimit, setRankingLimit] = useState("50");
  const [rankingFrequency, setRankingFrequency] = useState("24");
  const [achadinhosFrequency, setAchadinhosFrequency] = useState("12");
  const [achadinhosCount, setAchadinhosCount] = useState("50");
  const [achadinhosHashtagId, setAchadinhosHashtagId] = useState(
    "1696392324325382",
  );

  // ── Seletor de hashtag (busca ao vivo na EchoTik) ──────────────────────
  const [hashtagOptions, setHashtagOptions] = useState<HashtagOption[]>([]);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [hashtagQuery, setHashtagQuery] = useState("");
  const [selectedHashtag, setSelectedHashtag] = useState<HashtagOption | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/shopee");
      if (res.ok) {
        const data = (await res.json()) as ShopeeConfig;
        setConfig(data);
        if (data.rankingLimit) setRankingLimit(data.rankingLimit);
        if (data.rankingFrequency) setRankingFrequency(data.rankingFrequency);
        if (data.achadinhosFrequency) setAchadinhosFrequency(data.achadinhosFrequency);
        if (data.achadinhosCount) setAchadinhosCount(data.achadinhosCount);
        if (data.achadinhosHashtagId) setAchadinhosHashtagId(data.achadinhosHashtagId);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        rankingLimit,
        rankingFrequency,
        achadinhosFrequency,
        achadinhosCount,
        achadinhosHashtagId,
      };
      if (affiliateAppId.trim()) body.affiliateAppId = affiliateAppId.trim();
      if (affiliateSecret.trim()) body.affiliateSecret = affiliateSecret.trim();

      const res = await fetch("/api/admin/settings/shopee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setAffiliateAppId("");
        setAffiliateSecret("");
        setTimeout(() => setSaved(false), 2000);
        await loadConfig();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erro ao salvar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  // Busca hashtags no EchoTik conforme o admin digita (debounce de 400ms).
  // A lista vem sempre do servidor: assim o campo só oferece hashtags que
  // existem, em vez de aceitar um ID numérico digitado à mão.
  useEffect(() => {
    const termo = hashtagQuery.trim();
    const alvo = termo.length >= 2 ? termo : "achadinhosshopee";

    let cancelado = false;
    setHashtagLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/settings/shopee/hashtags?q=${encodeURIComponent(alvo)}`,
        );
        const data = await res.json();
        if (cancelado) return;
        setHashtagOptions(data.hashtags ?? []);
      } catch {
        if (!cancelado) setHashtagOptions([]);
      } finally {
        if (!cancelado) setHashtagLoading(false);
      }
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [hashtagQuery]);

  // Mostra a hashtag já salva assim que ela aparecer nos resultados —
  // o banco guarda só o ID, o nome vem da busca.
  useEffect(() => {
    if (selectedHashtag || !achadinhosHashtagId) return;
    const achada = hashtagOptions.find((h) => h.id === achadinhosHashtagId);
    if (achada) setSelectedHashtag(achada);
  }, [hashtagOptions, achadinhosHashtagId, selectedHashtag]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#fff", mb: 0.5 }}>
        Shopee Affiliate API
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3, fontSize: "0.875rem" }}>
        Credenciais da Shopee Affiliate Partner API usada para buscar produtos
        e gerar links de afiliado. As chaves são armazenadas criptografadas.
      </Typography>

      {/* Status */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 3,
          p: 1.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: config?.configured ? "success.main" : "warning.main",
          bgcolor: config?.configured
            ? "rgba(46,125,50,0.08)"
            : "rgba(237,108,2,0.08)",
        }}
      >
        {config?.configured ? (
          <Check sx={{ fontSize: 18, color: "success.main" }} />
        ) : (
          <Warning sx={{ fontSize: 18, color: "warning.main" }} />
        )}
        <Typography
          variant="body2"
          sx={{
            color: config?.configured ? "success.main" : "warning.main",
            fontWeight: 600,
          }}
        >
          {config?.configured
            ? "API configurada"
            : "API não configurada — pipeline de achadinhos não conseguirá buscar produtos na Shopee"}
        </Typography>
      </Box>

      {/* App ID + Secret */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
        <TextField
          label="App ID"
          type="password"
          value={affiliateAppId}
          onChange={(e) => setAffiliateAppId(e.target.value)}
          placeholder="Seu App ID da Shopee Affiliate"
          size="small"
          fullWidth
          helperText="App ID do parceiro Shopee Affiliate. Será armazenado criptografado."
        />
        <TextField
          label="API Secret"
          type="password"
          value={affiliateSecret}
          onChange={(e) => setAffiliateSecret(e.target.value)}
          placeholder="Sua chave secreta da Shopee Affiliate"
          size="small"
          fullWidth
          helperText="Secret do parceiro Shopee Affiliate. Será armazenado criptografado."
        />
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 3 }} />

      {/* Parâmetros de sincronização */}
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          mb: 2,
        }}
      >
        Parâmetros de Sincronização
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
        <TextField
          label="Limite do Ranking"
          value={rankingLimit}
          onChange={(e) => setRankingLimit(e.target.value)}
          type="number"
          size="small"
          fullWidth
          inputProps={{ min: 1, max: 200 }}
          helperText="Quantidade máxima de produtos no ranking (1-200)"
        />
        <TextField
          label="Frequência do Ranking (horas)"
          value={rankingFrequency}
          onChange={(e) => setRankingFrequency(e.target.value)}
          type="number"
          size="small"
          fullWidth
          inputProps={{ min: 1, max: 168 }}
          helperText="Horas entre cada sincronização dos produtos do ranking"
        />
        <TextField
          label="Frequência Achadinhos (horas)"
          value={achadinhosFrequency}
          onChange={(e) => setAchadinhosFrequency(e.target.value)}
          type="number"
          size="small"
          fullWidth
          inputProps={{ min: 1, max: 168 }}
          helperText="Horas entre cada scan de novos achadinhos via EchoTik"
        />
        <TextField
          label="Quantidade de Achadinhos por Sincronização"
          value={achadinhosCount}
          onChange={(e) => setAchadinhosCount(e.target.value)}
          type="number"
          size="small"
          fullWidth
          inputProps={{ min: 20, max: 400 }}
          helperText="Quantos vídeos o cron deve buscar a cada execução (20-400). A busca é paginada em blocos de 20 com delay ~2s."
        />
        <Autocomplete
          options={hashtagOptions}
          loading={hashtagLoading}
          value={selectedHashtag}
          filterOptions={(x) => x} /* a filtragem é do servidor */
          getOptionLabel={(o) => `#${o.name}`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onInputChange={(_, v, reason) => {
            if (reason === "input") setHashtagQuery(v);
          }}
          onChange={(_, option) => {
            setSelectedHashtag(option);
            setAchadinhosHashtagId(option?.id ?? "");
          }}
          noOptionsText={
            hashtagLoading ? "Buscando..." : "Nenhuma hashtag encontrada"
          }
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id}>
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                <Typography sx={{ fontSize: "0.85rem" }}>#{option.name}</Typography>
                <Typography sx={{ fontSize: "0.7rem", opacity: 0.6 }}>
                  {option.videoCount.toLocaleString("pt-BR")} vídeos · ID {option.id}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Hashtag dos Achadinhos"
              size="small"
              fullWidth
              placeholder="Digite para buscar, ex: achadinhosshopee"
              helperText={
                achadinhosHashtagId
                  ? `Hashtag selecionada — ID ${achadinhosHashtagId}. Escolha da lista: só aparecem hashtags que existem de verdade no EchoTik.`
                  : "Digite um termo para buscar hashtags reais no EchoTik. A contagem de vídeos ajuda a escolher qual vale minerar."
              }
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {hashtagLoading ? <CircularProgress size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Configurações salvas com sucesso!</Alert>}

      <Box>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving}
          startIcon={
            saving ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
          sx={{
            textTransform: "none",
            fontWeight: 600,
            background: "linear-gradient(135deg, #2DD4FF 0%, #2563EB 100%)",
            "&:hover": {
              background: "linear-gradient(135deg, #3BDFFF 0%, #3B82F6 100%)",
            },
          }}
        >
          {saving ? "Salvando…" : "Salvar Configurações"}
        </Button>
      </Box>
    </Box>
  );
}