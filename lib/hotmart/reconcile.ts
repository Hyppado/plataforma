/**
 * lib/hotmart/reconcile.ts — Hotmart reconciliation service
 *
 * Extracted from app/api/cron/hotmart-reconcile/route.ts.
 * Testable independently; route handler stays thin.
 *
 * Responsibilities:
 *   1. Reprocess FAILED webhook events (up to MAX_RETRY_EVENTS with retryCount < MAX_RETRY_COUNT)
 *   2. Detect stale ACTIVE subscriptions (no update in STALE_SUBSCRIPTION_DAYS)
 *   3. Archive old ARCHIVED notifications (> ARCHIVE_NOTIFICATION_DAYS)
 *   4. Alert admins about permanently failed events
 */

import prisma from "@/lib/prisma";
import { extractWebhookFields } from "@/lib/hotmart/webhook";
import { processHotmartEvent } from "@/lib/hotmart/processor";
import { createDirectNotification } from "@/lib/admin/notifications";
import { createLogger, type Logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_RETRY_EVENTS = 50;
const MAX_RETRY_COUNT = 3;
const STALE_SUBSCRIPTION_DAYS = 35;
const ARCHIVE_NOTIFICATION_DAYS = 30;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ReconcileStats {
  retriedEvents: number;
  retriedSuccess: number;
  retriedFailed: number;
  staleSubscriptions: number;
  archivedNotifications: number;
}

export interface ReconcileResult {
  ok: boolean;
  stats: ReconcileStats;
  error?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Runs the full Hotmart reconciliation cycle.
 * Each step is isolated; a failure in one step does not skip subsequent steps.
 */
export async function runHotmartReconcile(
  parentLog?: Logger,
): Promise<ReconcileResult> {
  const log = parentLog ?? createLogger("hotmart-reconcile");

  const stats: ReconcileStats = {
    retriedEvents: 0,
    retriedSuccess: 0,
    retriedFailed: 0,
    staleSubscriptions: 0,
    archivedNotifications: 0,
  };

  try {
    // ----- 1. Reprocess FAILED events ----------------------------------
    const failedEvents = await prisma.hotmartWebhookEvent.findMany({
      where: {
        processingStatus: "FAILED",
        retryCount: { lt: MAX_RETRY_COUNT },
      },
      orderBy: { receivedAt: "asc" },
      take: MAX_RETRY_EVENTS,
    });

    stats.retriedEvents = failedEvents.length;
    log.info("Retrying failed events", { count: failedEvents.length });

    for (const event of failedEvents) {
      try {
        await prisma.hotmartWebhookEvent.update({
          where: { id: event.id },
          data: {
            processingStatus: "RECEIVED",
            retryCount: { increment: 1 },
            errorMessage: null,
          },
        });

        const fields = extractWebhookFields(
          event.payloadJson as Record<string, unknown>,
        );
        await processHotmartEvent(event.id, fields);
        stats.retriedSuccess++;
      } catch (err) {
        stats.retriedFailed++;
        log.error("Event reprocessing failed", {
          eventId: event.id,
          error: (err as Error).message,
        });
      }
    }

    // ----- 1b. Alert on permanently failed events ----------------------
    const permanentlyFailed = await prisma.hotmartWebhookEvent.count({
      where: {
        processingStatus: "FAILED",
        retryCount: { gte: MAX_RETRY_COUNT },
      },
    });

    if (permanentlyFailed > 0) {
      await createDirectNotification("PROCESSING_FAILED", {
        severity: "HIGH",
        title: `${permanentlyFailed} evento(s) falharam permanentemente`,
        message: `${permanentlyFailed} evento(s) falharam após ${MAX_RETRY_COUNT} tentativas. Verifique no painel de eventos.`,
        metadata: { permanentlyFailed },
      });
      log.warn("Permanently failed events detected", { permanentlyFailed });
    }

    // ----- 2. Detect stale ACTIVE subscriptions ------------------------
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - STALE_SUBSCRIPTION_DAYS);

    const staleSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        updatedAt: { lt: staleCutoff },
        hotmart: { isNot: null },
      },
      select: {
        id: true,
        userId: true,
        user: { select: { email: true } },
      },
      take: 20,
    });

    stats.staleSubscriptions = staleSubscriptions.length;

    if (staleSubscriptions.length > 0) {
      await createDirectNotification("IDENTITY_UNRESOLVED", {
        severity: "WARNING",
        source: "reconciliation",
        title: `${staleSubscriptions.length} assinatura(s) sem atualização recente`,
        message: `Assinaturas ACTIVE sem evento nos últimos ${STALE_SUBSCRIPTION_DAYS} dias. Verifique se estão sincronizadas com o Hotmart.`,
        metadata: {
          count: staleSubscriptions.length,
          subscriptionIds: staleSubscriptions.map((s) => s.id),
        },
      });
      log.warn("Stale subscriptions found", {
        count: staleSubscriptions.length,
      });
    }

    // ----- 3. Archive old notifications --------------------------------
    const archiveCutoff = new Date();
    archiveCutoff.setDate(archiveCutoff.getDate() - ARCHIVE_NOTIFICATION_DAYS);

    const archiveResult = await prisma.adminNotification.deleteMany({
      where: {
        status: "ARCHIVED",
        archivedAt: { lt: archiveCutoff },
      },
    });
    stats.archivedNotifications = archiveResult.count;

    log.info("Reconciliation completed", { stats });
    return { ok: true, stats };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("Reconciliation failed", { error: errorMessage, stats });
    return { ok: false, stats, error: errorMessage };
  }
}
