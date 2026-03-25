/**
 * Cron Route: GET /api/cron/hotmart-reconcile
 *
 * Executado 1×/dia (06:00 UTC) pelo Vercel Cron.
 * Responsabilidades:
 *  1. Reprocessa eventos FAILED (até 50) com retryCount < 3
 *  2. Detecta assinaturas ACTIVE sem evento recente (>35 dias) e cria notificação
 *  3. Arquiva notificações antigas (>30 dias, status ARCHIVED)
 *
 * Headers esperados (Vercel Cron envia automaticamente):
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { extractWebhookFields } from "@/lib/hotmart/webhook";
import { processHotmartEvent } from "@/lib/hotmart/processor";
import { createDirectNotification } from "@/lib/admin/notifications";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_RETRY_EVENTS = 50;
const MAX_RETRY_COUNT = 3;
const STALE_SUBSCRIPTION_DAYS = 35;
const ARCHIVE_NOTIFICATION_DAYS = 30;

export async function GET(request: NextRequest) {
  // 1. Validar CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (token !== cronSecret) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error(
      "[cron/hotmart-reconcile] CRON_SECRET não definido em produção",
    );
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const stats = {
    retriedEvents: 0,
    retriedSuccess: 0,
    retriedFailed: 0,
    staleSubscriptions: 0,
    archivedNotifications: 0,
  };

  try {
    // -----------------------------------------------------------------------
    // 2. Reprocessar eventos FAILED com retryCount < MAX_RETRY_COUNT
    // -----------------------------------------------------------------------
    const failedEvents = await prisma.hotmartWebhookEvent.findMany({
      where: {
        processingStatus: "FAILED",
        retryCount: { lt: MAX_RETRY_COUNT },
      },
      orderBy: { receivedAt: "asc" },
      take: MAX_RETRY_EVENTS,
    });

    stats.retriedEvents = failedEvents.length;

    for (const event of failedEvents) {
      try {
        // Incrementa retryCount
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
        console.error(
          `[cron/hotmart-reconcile] Reprocessamento falhou para ${event.id}:`,
          (err as Error).message,
        );
      }
    }

    // Se houver eventos que falharam 3x, notifica admin
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
    }

    // -----------------------------------------------------------------------
    // 3. Detectar assinaturas ACTIVE sem evento recente (stale)
    // -----------------------------------------------------------------------
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
        title: `${staleSubscriptions.length} assinatura(s) sem atualização recente`,
        message: `Assinaturas ACTIVE sem evento nos últimos ${STALE_SUBSCRIPTION_DAYS} dias. Verifique se estão sincronizadas com o Hotmart.`,
        metadata: {
          count: staleSubscriptions.length,
          subscriptionIds: staleSubscriptions.map((s) => s.id),
        },
      });
    }

    // -----------------------------------------------------------------------
    // 4. Limpar notificações ARCHIVED antigas (>30 dias)
    // -----------------------------------------------------------------------
    const archiveCutoff = new Date();
    archiveCutoff.setDate(archiveCutoff.getDate() - ARCHIVE_NOTIFICATION_DAYS);

    const archiveResult = await prisma.adminNotification.deleteMany({
      where: {
        status: "ARCHIVED",
        updatedAt: { lt: archiveCutoff },
      },
    });
    stats.archivedNotifications = archiveResult.count;

    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    console.error("[cron/hotmart-reconcile] Erro não tratado:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stats,
      },
      { status: 500 },
    );
  }
}
