/**
 * Shared utilities for trending API routes (videos / products / creators).
 *
 * Extracted to eliminate ~90% code duplication across the three route files.
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Resolução de URL de imagem
// ---------------------------------------------------------------------------

export const ECHOTIK_CDN = "echosell-images.tos-ap-southeast-1.volces.com";

/**
 * Devolve uma URL de imagem que o navegador consegue carregar sozinho.
 *
 * POR QUE A CAPA CRUA DA ECHOTIK NÃO SERVE
 * O CDN deles responde 403 sem assinatura, e assinar custa 1 requisição de
 * cota POR IMAGEM. O caminho antigo devolvia `/api/proxy/image?url=...`, que
 * assinava sob demanda: uma tela de 24 cards gastava 24 requisições, e um F5
 * gastava outras 24. Medido em produção, 2476 chamadas em 6 horas — foi o que
 * esgotou a cota da conta e derrubou as imagens de toda a plataforma.
 *
 * Agora a única fonte de imagem é o Vercel Blob, gravado uma vez pelo cron.
 * Sem blob, a resposta é vazia e o card mostra "Sem imagem" — degradar um
 * card é muito melhor do que queimar a cota que alimenta a plataforma inteira.
 *
 * URLs de outros CDNs (TikTok, Shopee) passam direto: abrem sem assinatura e
 * não consomem nada.
 *
 * @param url       URL de origem (pode ser null/undefined)
 * @param fallback  Valor devolvido quando não há imagem utilizável (default: "")
 */
export function publicImageUrl(url: string | null | undefined): string;
export function publicImageUrl(
  url: string | null | undefined,
  fallback: string,
): string;
export function publicImageUrl(
  url: string | null | undefined,
  fallback = "",
): string {
  if (!url) return fallback;
  try {
    if (new URL(url).hostname === ECHOTIK_CDN) return fallback;
  } catch {
    return fallback; // URL malformada não carrega em lugar nenhum
  }
  return url;
}

// ---------------------------------------------------------------------------
// Cycle / date resolution
// ---------------------------------------------------------------------------

type RangeParam = "1d" | "7d" | "30d";
type RankingCycle = 1 | 2 | 3;

/**
 * Map a range string to the Echotik ranking cycle.
 * Echotik ranklist API only supports:
 *   "1d"  → rank_type 1 (daily)
 *   "7d"  → rank_type 2 (weekly, every Monday)
 *   "30d" → rank_type 3 (monthly, first day of month)
 *
 * Cada range tenta o próprio ciclo primeiro e cai nos outros quando não há
 * snapshot. O ranklist é dado OFFLINE: a doc da EchoTik diz que ele "会有延迟"
 * (tem atraso) e que resposta vazia significa apenas que a EchoTik ainda não
 * coletou aquele dia — datas faltando são normais, não são erro.
 *
 * O "1d" era o único sem fallback, então um atraso do fornecedor no ranking
 * diário deixava a tela completamente vazia em vez de mostrar o snapshot
 * semanal. Quem consome recebe `effectiveRankingCycle` e sabe qual foi usado.
 */
export function rangeToCycles(range: RangeParam): {
  requested: RankingCycle;
  candidates: RankingCycle[];
} {
  if (range === "1d") return { requested: 1, candidates: [1, 2, 3] };
  if (range === "7d") return { requested: 2, candidates: [2, 1, 3] };
  return { requested: 3, candidates: [3, 2, 1] };
}

type TrendingModel = "video" | "product" | "creator";

interface ResolveCycleArgs {
  model: TrendingModel;
  region: string;
  rankField: number;
  candidates: RankingCycle[];
}

interface ResolveCycleResult {
  latest: Date | null;
  rankingCycle: RankingCycle;
}

/**
 * Finds the most recent snapshot date for the trending model, trying each
 * candidate cycle from most- to least-preferred.
 *
 * Returns `{ latest: null }` when no data exists (cron hasn't run yet).
 */
export async function resolveCycleAndDate({
  model,
  region,
  rankField,
  candidates,
}: ResolveCycleArgs): Promise<ResolveCycleResult> {
  for (const cycle of candidates) {
    let candidate: { date: Date } | null = null;

    if (model === "video") {
      candidate = await prisma.echotikVideoTrendDaily.findFirst({
        where: { country: region, rankingCycle: cycle, rankField },
        orderBy: { date: "desc" },
        select: { date: true },
      });
    } else if (model === "product") {
      candidate = await prisma.echotikProductTrendDaily.findFirst({
        where: { country: region, rankingCycle: cycle, rankField },
        orderBy: { date: "desc" },
        select: { date: true },
      });
    } else {
      candidate = await prisma.echotikCreatorTrendDaily.findFirst({
        where: { country: region, rankingCycle: cycle, rankField },
        orderBy: { date: "desc" },
        select: { date: true },
      });
    }

    if (candidate) {
      return { latest: candidate.date, rankingCycle: cycle };
    }
  }

  return { latest: null, rankingCycle: candidates[0] };
}

/**
 * Returns the sorted list of distinct countries available for a given model.
 */
export async function getAvailableRegions(
  model: TrendingModel,
): Promise<string[]> {
  if (model === "video") {
    const rows = await prisma.echotikVideoTrendDaily.findMany({
      distinct: ["country"],
      select: { country: true },
    });
    return rows.map((r) => r.country).sort();
  } else if (model === "product") {
    const rows = await prisma.echotikProductTrendDaily.findMany({
      distinct: ["country"],
      select: { country: true },
    });
    return rows.map((r) => r.country).sort();
  } else {
    const rows = await prisma.echotikCreatorTrendDaily.findMany({
      distinct: ["country"],
      select: { country: true },
    });
    return rows.map((r) => r.country).sort();
  }
}
