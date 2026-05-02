/**
 * lib/influencer-ia/quota.ts
 *
 * Quota helpers for the Influencer IA image generation feature.
 *
 * Two independent caps apply:
 *   1. Daily cap  — `influencerIaDailyQuota` from the plan (pace limiter).
 *   2. Monthly cap — `avatarVideoQuota` from the plan (total for the month).
 *
 * If a user has a daily quota of 5 and a monthly quota of 25, they will
 * exhaust their monthly allowance in 5 days (5 × 5 = 25) and are blocked
 * for the rest of the calendar month.
 *
 * Uses UsageEvent with type=AVATAR_VIDEO_GENERATION and
 * refTable="InfluencerIAGeneration" to distinguish from Avatar Video events.
 */

import { prisma } from "@/lib/prisma";
import { consumeUsage } from "@/lib/usage";
import { getSetting } from "@/lib/settings";
import { getUserActivePlan } from "@/lib/usage/quota";
import { randomUUID } from "crypto";

/** Default daily limit — overridden by the DB setting `influencer_ia_daily_limit`. */
const DEFAULT_DAILY_LIMIT = 5;

/**
 * Returns the effective daily limit for a user's Influencer IA image generation.
 * Priority: plan's `influencerIaDailyQuota` → global DB setting → default 5.
 */
export async function getInfluencerDailyLimit(
  userId?: string,
): Promise<number> {
  // 1. Try the user's active plan
  if (userId) {
    const plan = await getUserActivePlan(userId);
    if (plan && plan.influencerIaDailyQuota > 0) {
      return plan.influencerIaDailyQuota;
    }
  }
  // 2. Fall back to global DB setting
  const val = await getSetting("influencer_ia_daily_limit");
  if (val) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return DEFAULT_DAILY_LIMIT;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the UTC start of the current day. */
function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Returns the UTC start of the current calendar month. */
function thisMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Returns the number of Influencer IA image generations performed by the user
 * today (UTC calendar day).
 */
export async function getInfluencerGenerationsToday(
  userId: string,
): Promise<number> {
  return prisma.usageEvent.count({
    where: {
      userId,
      type: "AVATAR_VIDEO_GENERATION",
      refTable: "InfluencerIAGeneration",
      occurredAt: { gte: todayUTC() },
    },
  });
}

/**
 * Returns the number of Influencer IA image generations performed by the user
 * this calendar month (UTC).
 */
export async function getInfluencerGenerationsThisMonth(
  userId: string,
): Promise<number> {
  return prisma.usageEvent.count({
    where: {
      userId,
      type: "AVATAR_VIDEO_GENERATION",
      refTable: "InfluencerIAGeneration",
      occurredAt: { gte: thisMonthUTC() },
    },
  });
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

export class DailyQuotaExceededError extends Error {
  public readonly used: number;
  public readonly limit: number;

  constructor(used: number, limit: number) {
    super(
      `Limite diário de gerações atingido: ${used} de ${limit} usados hoje.`,
    );
    this.name = "DailyQuotaExceededError";
    this.used = used;
    this.limit = limit;
  }
}

export class MonthlyQuotaExceededError extends Error {
  public readonly used: number;
  public readonly limit: number;

  constructor(used: number, limit: number) {
    super(
      `Limite mensal de gerações atingido: ${used} de ${limit} usados este mês.`,
    );
    this.name = "MonthlyQuotaExceededError";
    this.used = used;
    this.limit = limit;
  }
}

/**
 * Throws `MonthlyQuotaExceededError` or `DailyQuotaExceededError` when the
 * user has reached their monthly or daily Influencer IA quota.
 *
 * Monthly cap = plan's `avatarVideoQuota` (0 = unlimited for this check).
 * Daily cap   = plan's `influencerIaDailyQuota` (pace limiter).
 *
 * Admins always pass (unlimited quota).
 */
export async function assertInfluencerDailyQuota(
  userId: string,
  role?: "ADMIN" | "USER",
): Promise<void> {
  if (role === "ADMIN") return; // admins are unlimited

  const plan = await getUserActivePlan(userId);

  // ---- Monthly cap --------------------------------------------------------
  const monthlyLimit = plan?.avatarVideoQuota ?? 0;
  if (monthlyLimit > 0) {
    const usedThisMonth = await getInfluencerGenerationsThisMonth(userId);
    if (usedThisMonth >= monthlyLimit) {
      throw new MonthlyQuotaExceededError(usedThisMonth, monthlyLimit);
    }
  }

  // ---- Daily pace limiter -------------------------------------------------
  const dailyLimit =
    (plan?.influencerIaDailyQuota ?? 0) > 0
      ? plan!.influencerIaDailyQuota
      : await (async () => {
          const val = await getSetting("influencer_ia_daily_limit");
          if (val) {
            const n = parseInt(val, 10);
            if (!isNaN(n) && n > 0) return n;
          }
          return DEFAULT_DAILY_LIMIT;
        })();

  const usedToday = await getInfluencerGenerationsToday(userId);
  if (usedToday >= dailyLimit) {
    throw new DailyQuotaExceededError(usedToday, dailyLimit);
  }
}

// ---------------------------------------------------------------------------
// Consumption
// ---------------------------------------------------------------------------

/**
 * Records one Influencer IA generation event.
 * Each call is always unique (randomUUID suffix) — every generation charges.
 */
export async function consumeInfluencerGeneration(
  userId: string,
): Promise<void> {
  await consumeUsage(userId, "AVATAR_VIDEO_GENERATION", 0, {
    idempotencyKey: `influencer-ia:${userId}:${randomUUID()}`,
    refTable: "InfluencerIAGeneration",
  });
}
