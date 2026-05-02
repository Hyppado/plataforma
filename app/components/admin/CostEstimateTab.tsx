"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  TextField,
  Slider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Collapse,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  InfoOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import {
  calcPlanCost,
  UNIT_COSTS_USD,
  type PlanCostBreakdown,
} from "@/lib/admin/cost-model";
import {
  useAdminCostEstimate,
  type PlanWithMeta,
} from "@/lib/swr/useAdminCostEstimate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtBrl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtUsd = (v: number) =>
  `US$\u2009${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function MarginChip({ pct }: { pct: number }) {
  const color = pct >= 60 ? "success" : pct >= 30 ? "warning" : "error";
  return (
    <Chip
      label={fmtPct(pct)}
      color={color}
      size="small"
      sx={{ fontWeight: 700, minWidth: 64 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Label with tooltip
// ---------------------------------------------------------------------------

function FieldLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
      <Typography
        sx={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Tooltip title={tip} arrow>
        <InfoOutlined
          sx={{ fontSize: 15, color: "rgba(255,255,255,0.35)", cursor: "help" }}
        />
      </Tooltip>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Detail row (expandable)
// ---------------------------------------------------------------------------

interface DetailRowProps {
  plan: PlanWithMeta;
  breakdown: PlanCostBreakdown;
  usdToBrl: number;
}

function DetailRow({ plan, breakdown, usdToBrl }: DetailRowProps) {
  const bm = breakdown.billingMonths; // 1 = monthly, 12 = annual
  const annual = bm > 1;

  // For annual plans, multiply each monthly cost by 12 so the detail rows
  // sum to the same value shown in the main table column (totalAiCostBrl).
  const c = (monthlyUsd: number) => monthlyUsd * usdToBrl * bm;

  // Helper: show "N/mês × 12 meses (= N×12/ano)" for annual, or just "N" for monthly.
  const qty = (n: number, unit: string) =>
    annual
      ? `${n} ${unit}/mês × 12 meses = ${n * 12} ${unit}/ano`
      : `${n} ${unit}`;

  const aiRows: Array<{
    label: string;
    what: string;
    detail: string;
    costBrl: number;
  }> = [
    {
      label: "Transcrições · OpenAI Whisper",
      what: "Converte o áudio dos vídeos em texto para análise. Cobrado por minuto de áudio.",
      detail: `${qty(plan.transcriptsPerMonth, "transcrições")} × US$${UNIT_COSTS_USD.whisperPerTranscript.toFixed(3)} (≈ 3 min × US$0,006/min)`,
      costBrl: c(breakdown.transcriptCostUsd),
    },
    {
      label: "Insights · GPT-4o-mini",
      what: "Analisa a transcrição do vídeo e gera um resumo inteligente (insight) para o usuário.",
      detail: annual
        ? `${breakdown.insightCallsPerMonth} chamadas/mês × 12 meses = ${breakdown.insightCallsPerMonth * 12} chamadas/ano — limite mensal de ${plan.insightTokensMonthlyMax.toLocaleString("pt-BR")} tokens ÷ ${plan.insightMaxOutputTokens} por chamada`
        : `${breakdown.insightCallsPerMonth} chamadas/mês — limite de ${plan.insightTokensMonthlyMax.toLocaleString("pt-BR")} tokens de saída ÷ ${plan.insightMaxOutputTokens} por chamada`,
      costBrl: c(breakdown.insightCostUsd),
    },
    {
      label: "Scripts · GPT-4o-mini",
      what: "Gera roteiros de vídeo baseados nas tendências. Cobrado por tokens processados.",
      detail: annual
        ? `${breakdown.scriptCallsPerMonth} chamadas/mês × 12 meses = ${breakdown.scriptCallsPerMonth * 12} chamadas/ano — limite mensal de ${plan.scriptTokensMonthlyMax.toLocaleString("pt-BR")} tokens ÷ ${plan.scriptMaxOutputTokens} por chamada`
        : `${breakdown.scriptCallsPerMonth} chamadas/mês — limite de ${plan.scriptTokensMonthlyMax.toLocaleString("pt-BR")} tokens de saída ÷ ${plan.scriptMaxOutputTokens} por chamada`,
      costBrl: c(breakdown.scriptCostUsd),
    },
    {
      label: "Avatar com IA — Imagens · Google Gemini",
      what: "O Google Gemini gera 2 imagens do avatar com o produto por criação de vídeo.",
      detail: `${qty(plan.avatarVideoQuota, "criações")} × 2 imagens × US$${UNIT_COSTS_USD.geminiImagePerImage.toFixed(2)}/imagem`,
      costBrl: c(breakdown.avatarImagesCostUsd),
    },
    {
      label: "Avatar com IA — Prompt de vídeo · GPT-4o",
      what: "O GPT-4o escreve o roteiro detalhado (prompt VEO) que descreve cada cena do vídeo gerado.",
      detail: `${qty(plan.avatarVideoQuota, "criações")} × ~600 tokens entrada + ~800 tokens saída`,
      costBrl: c(breakdown.avatarVeoCostUsd),
    },
    {
      label: "Influencer IA — Imagens · Google Gemini",
      what: "O Google Gemini gera a foto do influencer segurando o produto. Quota mensal = Vídeos Avatar do plano; o limite diário é o ritmo máximo de consumo.",
      detail: `${qty(breakdown.influencerMonthlyGenMax, "imagens")} (cota mensal = avatarVideoQuota) × US$${UNIT_COSTS_USD.geminiImagePerImage.toFixed(2)}/imagem`,
      costBrl: c(breakdown.influencerImagesCostUsd),
    },
    {
      label: "Influencer IA — Prompt de vídeo · GPT-4o",
      what: "O GPT-4o cria os prompts de cada cena do vídeo do influencer após gerar a imagem.",
      detail: `${qty(breakdown.influencerMonthlyGenMax, "usos")} (cota mensal = avatarVideoQuota) × ~600 tokens entrada + ~600 tokens saída`,
      costBrl: c(breakdown.influencerVeoCostUsd),
    },
  ];

  return (
    <Box sx={{ px: 2, py: 2, bgcolor: "rgba(255,255,255,0.02)" }}>
      {/* Hotmart line */}
      <Box
        sx={{
          mb: 2,
          p: 1.5,
          bgcolor: "rgba(255,152,0,0.06)",
          borderRadius: 1,
          border: "1px solid rgba(255,152,0,0.15)",
        }}
      >
        <Typography
          sx={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 12,
            fontWeight: 600,
            mb: 0.25,
          }}
        >
          Taxa Hotmart
          {breakdown.billingMonths > 1
            ? " (cobrada uma vez por ano)"
            : " (cobrada por mês)"}
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
          Descontada diretamente da receita antes de chegar à conta da Hyppado.
          Não é um custo de IA, mas reduz o que sobra para cobrir os gastos dos
          provedores.
        </Typography>
        <Typography
          sx={{ color: "warning.main", fontSize: 12, fontWeight: 600, mt: 0.5 }}
        >
          − {fmtBrl(breakdown.hotmartFeeBrl)}
          {breakdown.billingMonths > 1 ? "/ano" : ""} desta receita
        </Typography>
      </Box>

      {/* AI costs */}
      <Typography
        sx={{
          color: "rgba(255,255,255,0.4)",
          fontSize: 11,
          fontWeight: 600,
          mb: 1,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Custos de IA por período de cobrança (por assinante)
        {breakdown.billingMonths > 1
          ? " — cotas mensais × 12 meses"
          : " — convertidos para BRL"}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 11,
                pl: 0,
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              Serviço
            </TableCell>
            <TableCell
              sx={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 11,
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              O que faz / cálculo
            </TableCell>
            <TableCell
              align="right"
              sx={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 11,
                pr: 0,
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              Custo estimado
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {aiRows.map((r) => (
            <TableRow
              key={r.label}
              sx={{
                "& td": {
                  borderColor: "rgba(255,255,255,0.04)",
                  verticalAlign: "top",
                },
              }}
            >
              <TableCell
                sx={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 12,
                  pl: 0,
                  py: 1,
                  minWidth: 220,
                }}
              >
                {r.label}
              </TableCell>
              <TableCell sx={{ py: 1 }}>
                <Typography
                  sx={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}
                >
                  {r.what}
                </Typography>
                <Typography
                  sx={{
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 10.5,
                    mt: 0.25,
                    fontFamily: "monospace",
                  }}
                >
                  {r.detail}
                </Typography>
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 12,
                  pr: 0,
                  py: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {fmtBrl(r.costBrl)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main plan row
// ---------------------------------------------------------------------------

interface PlanRowProps {
  plan: PlanWithMeta;
  usdToBrl: number;
  utilization: number;
  hotmartFee: number;
}

function PlanRow({ plan, usdToBrl, utilization, hotmartFee }: PlanRowProps) {
  const [open, setOpen] = useState(false);

  const breakdown = useMemo(
    () => calcPlanCost(plan, usdToBrl, utilization / 100, hotmartFee / 100),
    [plan, usdToBrl, utilization, hotmartFee],
  );

  return (
    <>
      <TableRow
        sx={{
          "& td": { borderColor: "rgba(255,255,255,0.06)" },
          "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
          cursor: "pointer",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <TableCell sx={{ pl: 1, width: 40 }}>
          <IconButton size="small" tabIndex={-1}>
            {open ? (
              <KeyboardArrowUp
                sx={{ color: "rgba(255,255,255,0.5)", fontSize: 18 }}
              />
            ) : (
              <KeyboardArrowDown
                sx={{ color: "rgba(255,255,255,0.5)", fontSize: 18 }}
              />
            )}
          </IconButton>
        </TableCell>

        {/* Plan name */}
        <TableCell>
          <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
            {plan.name}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            {plan.periodicity === "ANNUAL"
              ? "Cobrança anual"
              : "Cobrança mensal"}{" "}
            · {plan.displayPrice ?? fmtBrl(plan.priceAmount / 100)}
          </Typography>
        </TableCell>

        {/* Gross revenue */}
        <TableCell align="right">
          <Typography sx={{ color: "#fff", fontWeight: 500, fontSize: 14 }}>
            {fmtBrl(breakdown.revenueBrl)}
            {breakdown.billingMonths > 1 && (
              <Typography
                component="span"
                sx={{ color: "rgba(255,255,255,0.4)", fontSize: 11, ml: 0.5 }}
              >
                /ano
              </Typography>
            )}
          </Typography>
          {breakdown.billingMonths > 1 && (
            <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
              ≈ {fmtBrl(breakdown.monthlyRevenueBrl)}/mês
            </Typography>
          )}
        </TableCell>

        {/* Hotmart fee */}
        <TableCell align="right">
          <Typography sx={{ color: "warning.main", fontSize: 13 }}>
            − {fmtBrl(breakdown.hotmartFeeBrl)}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
            = {fmtBrl(breakdown.netRevenueBrl)} líquido
          </Typography>
        </TableCell>

        {/* AI cost */}
        <TableCell align="right">
          <Typography sx={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
            {fmtBrl(breakdown.totalAiCostBrl)}
            {breakdown.billingMonths > 1 && (
              <Typography
                component="span"
                sx={{ color: "rgba(255,255,255,0.4)", fontSize: 11, ml: 0.5 }}
              >
                /ano
              </Typography>
            )}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
            {breakdown.billingMonths > 1
              ? `≈ ${fmtBrl(breakdown.monthlyAiCostBrl)}/mês`
              : fmtUsd(breakdown.totalAiCostUsd)}
          </Typography>
        </TableCell>

        {/* Margin */}
        <TableCell align="right" sx={{ pr: 2 }}>
          <MarginChip pct={breakdown.marginPercent} />
          <Typography
            sx={{ color: "rgba(255,255,255,0.45)", fontSize: 11, mt: 0.25 }}
          >
            {breakdown.billingMonths > 1
              ? `${fmtBrl(breakdown.marginBrl)}/ano (≈ ${fmtBrl(breakdown.monthlyMarginBrl)}/mês)`
              : `${fmtBrl(breakdown.marginBrl)}/mês`}
          </Typography>
        </TableCell>
      </TableRow>

      <TableRow
        sx={{ "& td": { pb: 0, pt: 0, borderColor: "rgba(255,255,255,0.06)" } }}
      >
        <TableCell colSpan={6} sx={{ p: 0 }}>
          <Collapse in={open} unmountOnExit>
            <DetailRow plan={plan} breakdown={breakdown} usdToBrl={usdToBrl} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ---------------------------------------------------------------------------
// Unit costs reference
// ---------------------------------------------------------------------------

function UnitCostsReference() {
  const rows = [
    {
      provider: "OpenAI",
      item: "Whisper — transcrição de áudio",
      price: `US$${UNIT_COSTS_USD.whisperPerTranscript.toFixed(3)}/transcrição`,
      note: "3 min × US$0,006/min (média estimada)",
      href: "https://openai.com/api/pricing/",
    },
    {
      provider: "OpenAI",
      item: "GPT-4o-mini — entrada (input)",
      price: "US$0,15/1M tokens",
      note: "usado em insights e scripts",
      href: "https://openai.com/api/pricing/",
    },
    {
      provider: "OpenAI",
      item: "GPT-4o-mini — saída (output)",
      price: "US$0,60/1M tokens",
      note: "usado em insights e scripts",
      href: "https://openai.com/api/pricing/",
    },
    {
      provider: "OpenAI",
      item: "GPT-4o — entrada (input)",
      price: "US$2,50/1M tokens",
      note: "usado em prompts de vídeo (Avatar e Influencer)",
      href: "https://openai.com/api/pricing/",
    },
    {
      provider: "OpenAI",
      item: "GPT-4o — saída (output)",
      price: "US$10,00/1M tokens",
      note: "usado em prompts de vídeo (Avatar e Influencer)",
      href: "https://openai.com/api/pricing/",
    },
    {
      provider: "Google",
      item: "Gemini Flash — geração de imagem",
      price: `~US$${UNIT_COSTS_USD.geminiImagePerImage.toFixed(2)}/imagem`,
      note: "estimativa — modelo em fase experimental",
      href: "https://ai.google.dev/pricing",
    },
  ];

  return (
    <Box
      sx={{
        mt: 5,
        p: 2.5,
        bgcolor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ color: "rgba(255,255,255,0.6)", mb: 0.5, fontWeight: 700 }}
      >
        Tabela de custos unitários (referência)
      </Typography>
      <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 12, mb: 2 }}>
        Estes são os preços cobrados diretamente pelos provedores de IA por uso.
        Os cálculos acima multiplicam esses valores pelo volume de uso estimado
        de cada plano. Verifique periodicamente se os preços mudaram nos painéis
        da OpenAI e do Google.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {[
              "Provedor",
              "Serviço",
              "Preço unitário",
              "Onde é usado",
              "Fonte",
            ].map((h) => (
              <TableCell
                key={h}
                sx={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 11,
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.item}
              sx={{ "& td": { borderColor: "rgba(255,255,255,0.04)" } }}
            >
              <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                {r.provider}
              </TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                {r.item}
              </TableCell>
              <TableCell
                sx={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              >
                {r.price}
              </TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                {r.note}
              </TableCell>
              <TableCell sx={{ fontSize: 11 }}>
                <a
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#2DD4FF",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Ver preços oficiais ↗
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

export function CostEstimateTab() {
  const { data, error, isLoading } = useAdminCostEstimate();

  // Controls — all override-only (not persisted)
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [utilization, setUtilization] = useState<number>(80);
  const [hotmartFee, setHotmartFee] = useState<number>(9.9);

  const effectiveRate = rateOverride ?? data?.usdToBrl ?? 5.5;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Erro ao carregar dados de custo. Tente recarregar a página.
      </Alert>
    );
  }

  const plans = data?.plans ?? [];

  return (
    <Box>
      {/* ── Explanation header ─────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          bgcolor: "rgba(45,212,255,0.06)",
          border: "1px solid rgba(45,212,255,0.15)",
          borderRadius: 2,
        }}
      >
        <Typography
          sx={{ color: "primary.main", fontWeight: 700, fontSize: 15, mb: 1 }}
        >
          O que este painel mostra?
        </Typography>
        <Typography
          sx={{
            color: "rgba(255,255,255,0.75)",
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          Para cada plano ativo, calculamos quanto custaria por assinante por
          mês se todos usassem 100% da cota disponível — incluindo transcrições,
          geração de insights, scripts, imagens de avatar e influencer.{" "}
          <strong style={{ color: "#fff" }}>
            Esses são custos reais pagos aos provedores de IA
          </strong>{" "}
          (OpenAI e Google), convertidos para BRL com a taxa de câmbio atual.
        </Typography>
        <Typography
          sx={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 12,
            mt: 1.5,
            lineHeight: 1.6,
          }}
        >
          Além dos custos de IA, a{" "}
          <strong style={{ color: "rgba(255,255,255,0.8)" }}>
            taxa da Hotmart
          </strong>{" "}
          é descontada de cada pagamento antes do dinheiro chegar à conta. A
          margem mostrada é o que sobra da receita depois de deduzir a taxa da
          Hotmart e os custos de IA. Use o ajuste de utilização para simular
          cenários mais realistas — por exemplo, 80% significa que o assinante
          médio usa 80% da cota contratada.
        </Typography>
      </Paper>

      {/* ── Simulation controls ────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          bgcolor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 2,
        }}
      >
        <Typography
          sx={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            fontWeight: 700,
            mb: 2,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Parâmetros de simulação
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          {/* USD → BRL rate */}
          <Box sx={{ minWidth: 200 }}>
            <FieldLabel
              label="Taxa de câmbio USD → BRL"
              tip="Os provedores de IA (OpenAI e Google) cobram em dólar americano. Esta taxa converte os custos para reais. O valor é atualizado automaticamente pelo Banco Central do Brasil (PTAX). Altere aqui para simular outros cenários — não é salvo."
            />
            <TextField
              type="number"
              size="small"
              value={
                rateOverride !== null ? rateOverride : (data?.usdToBrl ?? 5.5)
              }
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setRateOverride(isNaN(v) || v <= 0 ? null : v);
              }}
              inputProps={{ min: 1, max: 20, step: 0.01 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography
                      sx={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}
                    >
                      R$
                    </Typography>
                  </InputAdornment>
                ),
              }}
              sx={{
                width: 150,
                "& .MuiInputBase-input": { color: "#fff" },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.2)",
                },
              }}
            />
            {data?.rateDate && (
              <Typography
                sx={{ color: "rgba(255,255,255,0.3)", fontSize: 11, mt: 0.5 }}
              >
                Dado do Banco Central em {data.rateDate}
                {" · "}
                <a
                  href="https://ptax.bcb.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2DD4FF", textDecoration: "none" }}
                >
                  PTAX ↗
                </a>
              </Typography>
            )}
          </Box>

          <Divider
            orientation="vertical"
            flexItem
            sx={{
              borderColor: "rgba(255,255,255,0.08)",
              display: { xs: "none", md: "block" },
            }}
          />

          {/* Hotmart fee */}
          <Box sx={{ minWidth: 200 }}>
            <FieldLabel
              label="Taxa da Hotmart (%)"
              tip="A Hotmart retém uma porcentagem de cada pagamento antes de repassar o valor. A taxa padrão é 9,9%. Verifique o valor exato no painel da Hotmart — pode variar conforme o contrato. Esta taxa é descontada da receita antes de calcular a margem."
            />
            <TextField
              type="number"
              size="small"
              value={hotmartFee}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0 && v <= 50) setHotmartFee(v);
              }}
              inputProps={{ min: 0, max: 50, step: 0.1 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography
                      sx={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}
                    >
                      %
                    </Typography>
                  </InputAdornment>
                ),
              }}
              sx={{
                width: 130,
                "& .MuiInputBase-input": { color: "#fff" },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.2)",
                },
              }}
            />
            <Typography
              sx={{ color: "rgba(255,255,255,0.3)", fontSize: 11, mt: 0.5 }}
            >
              Padrão Hotmart: 9,9% por transação
              {" · "}
              <a
                href="https://help.hotmart.com/pt-br/article/360036640174"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#2DD4FF", textDecoration: "none" }}
              >
                Ver tabela oficial ↗
              </a>
            </Typography>
          </Box>

          <Divider
            orientation="vertical"
            flexItem
            sx={{
              borderColor: "rgba(255,255,255,0.08)",
              display: { xs: "none", md: "block" },
            }}
          />

          {/* Utilization slider */}
          <Box sx={{ minWidth: 260, flexGrow: 1, maxWidth: 420 }}>
            <FieldLabel
              label="Utilização estimada da cota"
              tip="Quanto da cota disponível no plano um assinante típico realmente usa. 100% = cenário pessimista (todos usam tudo). 80% = cenário realista (assinante médio usa 80% do limite). 50% = cenário otimista. Ajuste conforme seu histórico de uso."
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mb: 0.25,
              }}
            >
              <Typography
                sx={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}
              >
                0% = ninguém usa · 100% = todos no limite máximo
              </Typography>
              <Typography
                sx={{ color: "primary.main", fontWeight: 700, fontSize: 13 }}
              >
                {utilization}%
              </Typography>
            </Box>
            <Slider
              value={utilization}
              onChange={(_, v) => setUtilization(v as number)}
              min={0}
              max={100}
              step={5}
              marks={[
                { value: 0, label: "0%" },
                { value: 50, label: "50%" },
                { value: 100, label: "100%" },
              ]}
              sx={{
                color: "primary.main",
                "& .MuiSlider-markLabel": {
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 11,
                },
              }}
            />
          </Box>
        </Box>
      </Paper>

      {/* ── Disclaimer ────────────────────────────────────────────────── */}
      <Alert
        severity="warning"
        icon={<WarningAmberOutlined />}
        sx={{
          mb: 3,
          bgcolor: "rgba(255,152,0,0.07)",
          color: "rgba(255,255,255,0.75)",
          fontSize: 12,
        }}
      >
        <strong>Estimativa — não é faturamento real.</strong> Os valores são
        calculados com base nos limites máximos de cada plano e em preços
        públicos dos provedores. O custo real depende do uso efetivo de cada
        assinante. Clique em qualquer linha para ver o detalhamento por serviço.
      </Alert>

      {/* ── Plans table ───────────────────────────────────────────────── */}
      {plans.length === 0 ? (
        <Alert severity="info">
          Nenhum plano ativo encontrado no banco de dados.
        </Alert>
      ) : (
        <Table>
          <TableHead>
            <TableRow
              sx={{ "& th": { borderColor: "rgba(255,255,255,0.08)" } }}
            >
              <TableCell sx={{ width: 48 }} />
              <TableCell
                sx={{
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Plano
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <Tooltip
                  title="Quanto o assinante paga pelo período de cobrança: mensal para planos mensais, anual (valor cheio) para planos anuais."
                  arrow
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      cursor: "help",
                    }}
                  >
                    Receita bruta
                    <InfoOutlined sx={{ fontSize: 13 }} />
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <Tooltip
                  title="Valor retido pela Hotmart antes de repassar para a Hyppado. Calculado sobre a receita bruta."
                  arrow
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      cursor: "help",
                    }}
                  >
                    Taxa Hotmart
                    <InfoOutlined sx={{ fontSize: 13 }} />
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <Tooltip
                  title="Custo total dos serviços de IA para o período de cobrança do plano (mensal ou anual). Para planos anuais, o custo mensal é multiplicado por 12."
                  arrow
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      cursor: "help",
                    }}
                  >
                    Custo de IA (BRL)
                    <InfoOutlined sx={{ fontSize: 13 }} />
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 600,
                  fontSize: 12,
                  pr: 2,
                }}
              >
                <Tooltip
                  title="Receita líquida (após taxa Hotmart) menos os custos de IA. Verde = margem saudável (≥60%). Amarelo = atenção (≥30%). Vermelho = risco de prejuízo (<30%)."
                  arrow
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      cursor: "help",
                    }}
                  >
                    Margem estimada
                    <InfoOutlined sx={{ fontSize: 13 }} />
                  </Box>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                usdToBrl={effectiveRate}
                utilization={utilization}
                hotmartFee={hotmartFee}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {/* ── Unit costs reference ──────────────────────────────────────── */}
      <UnitCostsReference />
    </Box>
  );
}
