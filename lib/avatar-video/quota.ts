/**
 * lib/avatar-video/quota.ts
 *
 * Quota helpers specific to the avatar video generation domain.
 * Wraps the generic lib/usage helpers with avatar-video semantics.
 *
 * Rule: 1 completed generation = 1 AVATAR_VIDEO_GENERATION event.
 * The idempotency key is scoped to the AvatarVideoCreation id so that
 * regenerating inside the same creation does not consume extra credits.
 */

import { assertQuota, consumeUsage } from "@/lib/usage";
import { QuotaExceededError } from "@/lib/usage";
import { randomUUID } from "crypto";
import type { ServiceErr } from "./types";

// ---------------------------------------------------------------------------
// Pre-generation guard
// ---------------------------------------------------------------------------

/**
 * Checks whether the user still has available avatar video generation quota.
 * Throws `QuotaExceededError` if the monthly limit is reached.
 *
 * Call this BEFORE starting the generation pipeline — fail fast, before any
 * external service is invoked.
 */
export async function assertAvatarVideoQuota(userId: string): Promise<void> {
  await assertQuota(userId, "AVATAR_VIDEO_GENERATION");
}

/**
 * Converts a `QuotaExceededError` into the standard `ServiceErr` shape.
 * Use when callers prefer returned errors over thrown exceptions.
 */
export function quotaExceededToServiceErr(err: QuotaExceededError): ServiceErr {
  return {
    ok: false,
    error: `Limite de gerações de vídeo com avatar atingido: ${err.used} de ${err.limit} usados neste mês.`,
    code: "quota_exceeded",
  };
}

// ---------------------------------------------------------------------------
// Post-generation consumption
// ---------------------------------------------------------------------------

/**
 * Records one AVATAR_VIDEO_GENERATION usage event for the user.
 * Each call produces a distinct event — regenerating the same creation
 * counts as a new generation and consumes another credit.
 *
 * @param userId     User being charged.
 * @param creationId AvatarVideoCreation.id — used for reference tracking only.
 */
export async function consumeAvatarVideoQuota(
  userId: string,
  creationId: string,
): Promise<void> {
  await consumeUsage(userId, "AVATAR_VIDEO_GENERATION", 0, {
    idempotencyKey: `avatar-video:${creationId}:${randomUUID()}`,
    refTable: "AvatarVideoCreation",
    refId: creationId,
  });
}
