/**
 * lib/influencer-ia/quota.ts
 *
 * Daily quota helpers for the Influencer IA image generation feature.
 * Hard limit: DAILY_LIMIT generations per calendar day (UTC).
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

/**
 * Throws `DailyQuotaExceededError` when the user has reached the daily limit.
 * Call this BEFORE invoking the AI generation pipeline.
 * Admins always pass (unlimited quota).
 */
export async function assertInfluencerDailyQuota(
  userId: string,
  role?: "ADMIN" | "USER",
): Promise<void> {
  if (role === "ADMIN") return; // admins are unlimited
  const [used, limit] = await Promise.all([
    getInfluencerGenerationsToday(userId),
    getInfluencerDailyLimit(userId),
  ]);
  if (used >= limit) {
    throw new DailyQuotaExceededError(used, limit);
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
