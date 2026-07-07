import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { calcUsageCostUsd } from "@/lib/admin/cost-model";
import { getStoredUsdRate } from "@/lib/exchange/fetchRate";

export const runtime = "nodejs";

const log = createLogger("admin:usage");

/** Hotmart transaction fee applied over gross revenue (9.9%). */
const HOTMART_FEE_PERCENT = 0.099;
/** Fallback USD→BRL rate when none is stored. */
const FALLBACK_USD_RATE = 5.5;

// ---------------------------------------------------------------------------
// GET — Uso agregado por usuário em um período (visão "Uso" do admin)
//
// Agrega UsageEvent (histórico completo retido) por usuário e tipo. Os contadores
// de UsagePeriod refletem apenas o mês corrente, então para períodos arbitrários
// somamos os eventos atômicos diretamente.
// ---------------------------------------------------------------------------

type UsagePeriodKey = "current_month" | "last_month" | "last_90_days" | "all";

const VALID_PERIODS: readonly UsagePeriodKey[] = [
  "current_month",
  "last_month",
  "last_90_days",
  "all",
];

function isUsagePeriodKey(value: string | null): value is UsagePeriodKey {
  return value != null && (VALID_PERIODS as readonly string[]).includes(value);
}

/** Resolve o intervalo [start, end) em UTC para o período solicitado. */
function resolveRange(period: UsagePeriodKey): {
  start: Date | null;
  end: Date;
} {
  const now = new Date();
  const end = now;
  switch (period) {
    case "current_month":
      return {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        end,
      };
    case "last_month": {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      const monthEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      return { start, end: monthEnd };
    }
    case "last_90_days":
      return {
        start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        end,
      };
    case "all":
      return { start: null, end };
  }
}

/** Número de meses que o período cobre (para normalizar custo de IA por mês). */
async function resolvePeriodMonths(
  period: UsagePeriodKey,
  end: Date,
): Promise<number> {
  if (period === "last_90_days") return 3;
  if (period === "all") {
    const agg = await prisma.usageEvent.aggregate({
      _min: { occurredAt: true },
    });
    const first = agg._min.occurredAt;
    if (!first) return 1;
    const months =
      (end.getUTCFullYear() - first.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - first.getUTCMonth()) +
      1;
    return Math.max(1, months);
  }
  // current_month e last_month cobrem ~1 mês.
  return 1;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = req.nextUrl;
  const periodParam = searchParams.get("period");
  const period: UsagePeriodKey = isUsagePeriodKey(periodParam)
    ? periodParam
    : "current_month";
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));

  const { start, end } = resolveRange(period);

  try {
    const occurredAt: Record<string, Date> = { lt: end };
    if (start) occurredAt.gte = start;

    // Agrega contagem de eventos e soma de tokens por usuário+tipo.
    const grouped = await prisma.usageEvent.groupBy({
      by: ["userId", "type"],
      where: { occurredAt },
      _count: { _all: true },
      _sum: { tokensUsed: true },
    });

    // Constrói linhas por usuário.
    const rows = new Map<
      string,
      {
        id: string;
        transcripts: number;
        scripts: number;
        insights: number;
        avatarVideos: number;
        tokens: number;
        insightTokens: number;
        scriptTokens: number;
        total: number;
      }
    >();

    for (const g of grouped) {
      const row = rows.get(g.userId) ?? {
        id: g.userId,
        transcripts: 0,
        scripts: 0,
        insights: 0,
        avatarVideos: 0,
        tokens: 0,
        insightTokens: 0,
        scriptTokens: 0,
        total: 0,
      };
      const count = g._count._all;
      const tokens = g._sum.tokensUsed ?? 0;
      switch (g.type) {
        case "TRANSCRIPT":
          row.transcripts += count;
          break;
        case "SCRIPT":
          row.scripts += count;
          row.scriptTokens += tokens;
          break;
        case "INSIGHT":
          row.insights += count;
          row.insightTokens += tokens;
          break;
        case "AVATAR_VIDEO_GENERATION":
          row.avatarVideos += count;
          break;
      }
      row.tokens += tokens;
      row.total += count;
      rows.set(g.userId, row);
    }

    // Enriquece com nome/email dos usuários envolvidos.
    const userIds = Array.from(rows.keys());

    // Câmbio, assinaturas ativas (faturamento real) e cortesias em paralelo.
    const [ratePayload, users, activeSubs, activeGrants, periodMonths] =
      await Promise.all([
        getStoredUsdRate(),
        userIds.length
          ? prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true },
            })
          : Promise.resolve([]),
        prisma.subscription.findMany({
          where: { status: "ACTIVE" },
          select: {
            userId: true,
            plan: {
              select: { name: true, priceAmount: true, periodicity: true },
            },
          },
        }),
        userIds.length
          ? prisma.accessGrant.findMany({
              where: { userId: { in: userIds }, isActive: true },
              select: { userId: true },
            })
          : Promise.resolve([]),
        resolvePeriodMonths(period, end),
      ]);

    const usdToBrl = ratePayload?.rate ?? FALLBACK_USD_RATE;
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Mapa userId → faturamento mensal (assinatura ativa).
    const subMap = new Map<
      string,
      { planName: string; monthlyRevenueBrl: number }
    >();
    let mrrBrl = 0;
    for (const s of activeSubs) {
      const months = s.plan.periodicity === "ANNUAL" ? 12 : 1;
      const monthlyRevenueBrl = s.plan.priceAmount / 100 / months;
      mrrBrl += monthlyRevenueBrl;
      const prev = subMap.get(s.userId);
      subMap.set(s.userId, {
        planName: prev?.planName ?? s.plan.name,
        monthlyRevenueBrl: (prev?.monthlyRevenueBrl ?? 0) + monthlyRevenueBrl,
      });
    }
    const grantSet = new Set(activeGrants.map((g) => g.userId));

    let enriched = Array.from(rows.values()).map((row) => {
      const u = userMap.get(row.id);
      const sub = subMap.get(row.id);
      const situacao: "assinante" | "cortesia" | "cadastro" = sub
        ? "assinante"
        : grantSet.has(row.id)
          ? "cortesia"
          : "cadastro";
      const costUsd = calcUsageCostUsd({
        transcripts: row.transcripts,
        insights: row.insights,
        insightTokens: row.insightTokens,
        scripts: row.scripts,
        scriptTokens: row.scriptTokens,
        avatarVideos: row.avatarVideos,
      }).totalUsd;
      return {
        id: row.id,
        name: u?.name ?? null,
        email: u?.email ?? "",
        transcripts: row.transcripts,
        scripts: row.scripts,
        insights: row.insights,
        avatarVideos: row.avatarVideos,
        tokens: row.tokens,
        total: row.total,
        planName: sub?.planName ?? null,
        situacao,
        monthlyRevenueBrl: sub?.monthlyRevenueBrl ?? 0,
        aiCostBrl: costUsd * usdToBrl,
      };
    });

    // Totais globais do período (antes de filtrar por busca/paginar).
    const totals = enriched.reduce(
      (acc, r) => {
        acc.transcripts += r.transcripts;
        acc.scripts += r.scripts;
        acc.insights += r.insights;
        acc.avatarVideos += r.avatarVideos;
        acc.tokens += r.tokens;
        acc.aiCostBrl += r.aiCostBrl;
        return acc;
      },
      {
        transcripts: 0,
        scripts: 0,
        insights: 0,
        avatarVideos: 0,
        tokens: 0,
        aiCostBrl: 0,
        users: enriched.length,
      },
    );

    // ---- Resumo financeiro (faturamento e lucro reais) --------------------
    const aiCostPeriodBrl = totals.aiCostBrl;
    const aiCostMonthlyBrl = aiCostPeriodBrl / periodMonths;
    const hotmartFeeBrl = mrrBrl * HOTMART_FEE_PERCENT;
    const netRevenueBrl = mrrBrl - hotmartFeeBrl;
    const profitMonthlyBrl = netRevenueBrl - aiCostMonthlyBrl;
    const marginPercent = mrrBrl > 0 ? (profitMonthlyBrl / mrrBrl) * 100 : 0;

    const finance = {
      usdToBrl,
      rateDate: ratePayload?.date ?? null,
      hotmartFeePercent: HOTMART_FEE_PERCENT,
      activeSubscribers: subMap.size,
      mrrBrl,
      hotmartFeeBrl,
      netRevenueBrl,
      aiCostPeriodBrl,
      periodMonths,
      aiCostMonthlyBrl,
      profitMonthlyBrl,
      marginPercent,
    };

    if (search) {
      enriched = enriched.filter((r) =>
        `${r.name ?? ""} ${r.email}`.toLowerCase().includes(search),
      );
    }

    // Ordena por uso total decrescente.
    enriched.sort((a, b) => b.total - a.total);

    const total = enriched.length;
    const skip = (page - 1) * limit;
    const pageRows = enriched.slice(skip, skip + limit);

    return NextResponse.json({
      period,
      range: { start: start ?? null, end },
      totals,
      finance,
      users: pageRows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error("Failed to aggregate usage", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
