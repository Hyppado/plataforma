import { prisma } from "@/lib/prisma";
import type { UsagePeriod } from "@prisma/client";

/**
 * Returns the UTC start (first moment of the month) and end (last moment) for
 * the month containing `date`.
 */
export function getPeriodBounds(date: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { start, end };
}

/**
 * Fetches the UsagePeriod for `userId` for the month containing `date`.
 * Creates one (with zeroed counters) if it does not exist yet.
 */
export async function getOrCreateUsagePeriod(
  userId: string,
  date: Date = new Date(),
): Promise<UsagePeriod> {
  const { start, end } = getPeriodBounds(date);

  return prisma.usagePeriod.upsert({
    where: { userId_periodStart: { userId, periodStart: start } },
    update: {},
    create: {
      userId,
      periodStart: start,
      periodEnd: end,
    },
  });
}

/**
 * Returns the current UsagePeriod for `userId`, or null if none exists yet
 * (i.e. the user has not consumed anything this month).
 */
export async function getCurrentUsagePeriod(
  userId: string,
): Promise<UsagePeriod | null> {
  const { start } = getPeriodBounds();
  return prisma.usagePeriod.findUnique({
    where: { userId_periodStart: { userId, periodStart: start } },
  });
}
