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
import { randomUUID } from "crypto";

export const INFLUENCER_IA_DAILY_LIMIT = 5;

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
 */
export async function assertInfluencerDailyQuota(
  userId: string,
): Promise<void> {
  const used = await getInfluencerGenerationsToday(userId);
  if (used >= INFLUENCER_IA_DAILY_LIMIT) {
    throw new DailyQuotaExceededError(used, INFLUENCER_IA_DAILY_LIMIT);
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
