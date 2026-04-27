import type { UsageEvent, UsageEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateUsagePeriod } from "./period";

export interface ConsumeOptions {
  /** Idempotency key — if the same key is seen again, the call is a no-op. */
  idempotencyKey: string;
  /** Reference table name, e.g. "Video" or "Script" */
  refTable?: string;
  /** ID of the related object */
  refId?: string;
}

export interface ConsumeResult {
  event: UsageEvent;
  /** true when the event was already recorded (idempotent replay) */
  duplicate: boolean;
}

/**
 * Records a usage event and increments the period counters atomically.
 * Idempotent: if `idempotencyKey` already exists the existing event is returned
 * and the counters are NOT incremented again.
 */
export async function consumeUsage(
  userId: string,
  action: UsageEventType,
  tokens = 0,
  opts: ConsumeOptions,
): Promise<ConsumeResult> {
  // Check for existing event (idempotency)
  const existing = await prisma.usageEvent.findUnique({
    where: { idempotencyKey: opts.idempotencyKey },
  });
  if (existing) {
    return { event: existing, duplicate: true };
  }

  // Ensure period exists
  const period = await getOrCreateUsagePeriod(userId);

  // Compute counter increments
  const transcriptsIncrement = action === "TRANSCRIPT" ? 1 : 0;
  const scriptsIncrement = action === "SCRIPT" ? 1 : 0;
  const insightsIncrement = action === "INSIGHT" ? 1 : 0;
  const avatarVideosIncrement = action === "AVATAR_VIDEO_GENERATION" ? 1 : 0;

  // Execute in a transaction: create event + update period counters
  const [, event] = await prisma.$transaction([
    prisma.usagePeriod.update({
      where: { id: period.id },
      data: {
        transcriptsUsed: { increment: transcriptsIncrement },
        scriptsUsed: { increment: scriptsIncrement },
        insightsUsed: { increment: insightsIncrement },
        tokensUsed: { increment: tokens },
        avatarVideosUsed: { increment: avatarVideosIncrement },
      },
    }),
    prisma.usageEvent.create({
      data: {
        userId,
        periodId: period.id,
        type: action,
        tokensUsed: tokens,
        refTable: opts.refTable ?? null,
        refId: opts.refId ?? null,
        idempotencyKey: opts.idempotencyKey,
      },
    }),
  ]);

  return { event, duplicate: false };
}
