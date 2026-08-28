import type { UsageEventType } from "@prisma/client";
import { getUserActivePlan, getQuotaLimits } from "./quota";
import { getCurrentUsagePeriod } from "./period";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Contagem diária
// ---------------------------------------------------------------------------

/** Início do dia corrente em UTC — mesma convenção do resto das cotas. */
function inicioDoDiaUTC(): Date {
  const agora = new Date();
  return new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
  );
}

/**
 * Downloads de vídeo da Shopee feitos pelo usuário hoje.
 *
 * Conta eventos em vez de ler UsagePeriod porque aquele contador é mensal:
 * usá-lo faria o limite diário só zerar na virada do mês.
 */
export async function contarDownloadsShopeeHoje(
  userId: string,
): Promise<number> {
  return prisma.usageEvent.count({
    where: {
      userId,
      type: "SHOPEE_VIDEO_DOWNLOAD",
      occurredAt: { gte: inicioDoDiaUTC() },
    },
  });
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class QuotaExceededError extends Error {
  public readonly action: UsageEventType;
  public readonly used: number;
  public readonly limit: number;

  constructor(action: UsageEventType, used: number, limit: number) {
    super(`Quota exceeded for ${action}: used ${used} of ${limit} this month.`);
    this.name = "QuotaExceededError";
    this.action = action;
    this.used = used;
    this.limit = limit;
  }
}

// ---------------------------------------------------------------------------
// assertQuota
// ---------------------------------------------------------------------------

/**
 * Throws `QuotaExceededError` when the user has already reached the limit for
 * `action` in the current billing period.
 *
 * Called **before** recording consumption so the action can be rejected early.
 *
 * @param userId   Internal User ID
 * @param action   TRANSCRIPT | SCRIPT | INSIGHT
 * @param tokens   Tokens that would be consumed (used only for token-based checks)
 */
export async function assertQuota(
  userId: string,
  action: UsageEventType,
  tokens = 0,
): Promise<void> {
  const [plan, period] = await Promise.all([
    getUserActivePlan(userId),
    getCurrentUsagePeriod(userId),
  ]);

  const limits = getQuotaLimits(plan);

  // Current usage (defaults to 0 when no period exists yet)
  const used = {
    transcripts: period?.transcriptsUsed ?? 0,
    scripts: period?.scriptsUsed ?? 0,
    insights: period?.insightsUsed ?? 0,
    tokens: period?.tokensUsed ?? 0,
    avatarVideos: period?.avatarVideosUsed ?? 0,
  };

  switch (action) {
    case "TRANSCRIPT":
      if (
        limits.transcriptsPerMonth > 0 &&
        used.transcripts >= limits.transcriptsPerMonth
      ) {
        throw new QuotaExceededError(
          action,
          used.transcripts,
          limits.transcriptsPerMonth,
        );
      }
      break;

    case "SCRIPT":
      if (
        limits.scriptsPerMonth > 0 &&
        used.scripts >= limits.scriptsPerMonth
      ) {
        throw new QuotaExceededError(
          action,
          used.scripts,
          limits.scriptsPerMonth,
        );
      }
      if (limits.scriptTokensMonthlyMax > 0 && tokens > 0) {
        const projectedTokens = used.tokens + tokens;
        if (projectedTokens > limits.scriptTokensMonthlyMax) {
          throw new QuotaExceededError(
            "SCRIPT",
            used.tokens,
            limits.scriptTokensMonthlyMax,
          );
        }
      }
      break;

    case "INSIGHT":
      if (limits.insightTokensMonthlyMax > 0 && tokens > 0) {
        const projectedTokens = used.tokens + tokens;
        if (projectedTokens > limits.insightTokensMonthlyMax) {
          throw new QuotaExceededError(
            "INSIGHT",
            used.tokens,
            limits.insightTokensMonthlyMax,
          );
        }
      }
      break;

    // Único limite DIÁRIO desta função. O contador de UsagePeriod é mensal e
    // por isso não serve aqui — a contagem vem dos UsageEvent do dia.
    case "SHOPEE_VIDEO_DOWNLOAD": {
      if (limits.shopeeDownloadsPerDay <= 0) break;

      const hoje = await contarDownloadsShopeeHoje(userId);
      if (hoje >= limits.shopeeDownloadsPerDay) {
        throw new QuotaExceededError(action, hoje, limits.shopeeDownloadsPerDay);
      }
      break;
    }

    case "AVATAR_VIDEO_GENERATION":
      if (
        limits.avatarVideoQuota > 0 &&
        used.avatarVideos >= limits.avatarVideoQuota
      ) {
        throw new QuotaExceededError(
          action,
          used.avatarVideos,
          limits.avatarVideoQuota,
        );
      }
      break;
  }
}
