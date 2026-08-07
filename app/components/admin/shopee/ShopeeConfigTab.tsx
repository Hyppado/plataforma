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
import { ACHADINHOS_MAX_HASHTAGS } from "@/lib/shopee/types";

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
  /** Seleção salva já resolvida — a tela desenha os chips a partir disto. */
  achadinhosHashtags?: { id: string; name: string }[];
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
  const [selectedHashtags, setSelectedHashtags] = useState<HashtagOption[]>([]);
  const noLimite = selectedHashtags.length >= ACHADINHOS_MAX_HASHTAGS;
  const totalVideos = selectedHashtags.reduce((t, h) => t + h.videoCount, 0);

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
        // A seleção salva vem pronta do banco. Nada aqui depende da EchoTik:
        // se a busca estiver fora do ar, os chips continuam aparecendo.
        if (data.achadinhosHashtags?.length) {
          setSelectedHashtags(
            data.achadinhosHashtags.map((h) => ({
              id: h.id,
              // Config no formato antigo vem sem nome. Deixar vazio de
              // propósito: getOptionLabel exibe o ID nesse caso, e assim o ID
              // não acaba gravado COMO nome no próximo save.
              name: h.name,
              videoCount: 0,
              viewCount: 0,
            })),
          );
        }
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

  // NÃO reidratar a seleção a partir de hashtagOptions. A seleção salva já
  // chega pronta em loadConfig; redescobri-la pela busca fazia os chips
  // sumirem sempre que a EchoTik respondia risk control — e, pior, salvar
  // nesse estado apagava as hashtags que não tinham aparecido.
  //
  // O que a busca PODE fazer é preencher o nome de uma hashtag salva no
  // formato antigo (só ID), se ela por acaso aparecer no resultado. É
  // estritamente aditivo: nunca remove nem troca um chip, então a falha da
  // EchoTik continua sendo inofensiva.
  useEffect(() => {
    if (hashtagOptions.length === 0) return;

    setSelectedHashtags((atuais) => {
      let mudou = false;
      const enriquecidas = atuais.map((sel) => {
        if (sel.name) return sel;
        const achada = hashtagOptions.find((o) => o.id === sel.id);
        if (!achada) return sel;
        mudou = true;
        return { ...sel, name: achada.name, videoCount: achada.videoCount };
      });

      if (!mudou) return atuais;
      // Reflete no valor que será salvo, senão o nome recuperado se perderia.
      setAchadinhosHashtagId(
        enriquecidas.map((o) => `${o.id}|${o.name}`).join(","),
      );
      return enriquecidas;
    });
  }, [hashtagOptions]);

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
        e resolver os links dos produtos. As chaves são armazenadas criptografadas.
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
          label="Alvo de Achadinhos Disponíveis"
          value={achadinhosCount}
          onChange={(e) => setAchadinhosCount(e.target.value)}
          type="number"
          size="small"
          fullWidth
          inputProps={{ min: 20, max: 400 }}
          helperText="ALVO de achadinhos disponíveis no feed (20-400). O cron trabalha até atingir esse número e, depois, só volta a rodar na frequência configurada para trazer conteúdo novo."
        />
        <Autocomplete
          multiple
          options={hashtagOptions}
          loading={hashtagLoading}
          value={selectedHashtags}
          filterOptions={(x) => x} /* a filtragem é do servidor */
          getOptionLabel={(o) => `#${o.name || o.id}`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onInputChange={(_, v, reason) => {
            if (reason === "input") setHashtagQuery(v);
          }}
          onChange={(_, options) => {
            // Segunda barreira além do getOptionDisabled: colar/Enter também
            // passa por aqui. Remover nunca é bloqueado.
            if (options.length > ACHADINHOS_MAX_HASHTAGS) return;
            setSelectedHashtags(options);
            // "id|nome" — o nome é gravado junto para a tela não precisar
            // redescobri-lo na EchoTik ao reabrir.
            setAchadinhosHashtagId(
              options.map((o) => `${o.id}|${o.name}`).join(","),
            );
          }}
          getOptionDisabled={() => noLimite}
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
              label={`Hashtags dos Achadinhos (máx. ${ACHADINHOS_MAX_HASHTAGS})`}
              size="small"
              fullWidth
              placeholder={
                selectedHashtags.length === 0 ? "Digite para buscar, ex: achadinhosshopee" : ""
              }
              helperText={
                noLimite
                  ? `Limite de ${ACHADINHOS_MAX_HASHTAGS} atingido. Acima disso a varredura não termina dentro do orçamento e as últimas hashtags nunca são lidas.`
                  : selectedHashtags.length > 0
                    ? // O total de vídeos só é conhecido para hashtags vindas
                      // da busca; as carregadas do banco não o trazem. Omitir
                      // é melhor do que exibir uma soma incompleta.
                      `${selectedHashtags.length} de ${ACHADINHOS_MAX_HASHTAGS} hashtags` +
                      (totalVideos > 0
                        ? ` · ${totalVideos.toLocaleString("pt-BR")} vídeos no total`
                        : "")
                    : `Escolha até ${ACHADINHOS_MAX_HASHTAGS}. Cada hashtag rende poucos vídeos novos por dia — combinar várias aumenta a oferta.`
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