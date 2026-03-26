/**
 * GET  /api/admin/webhook-events — Lista eventos webhook com filtros
 * POST /api/admin/webhook-events — Replay de evento webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { extractWebhookFields } from "@/lib/hotmart/webhook";
import { processHotmartEvent } from "@/lib/hotmart/processor";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — Lista webhook events
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
  const status = searchParams.get("status"); // RECEIVED, PROCESSED, FAILED, etc.
  const eventType = searchParams.get("eventType");
  const subscriberCode = searchParams.get("subscriberCode");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.processingStatus = status;
  if (eventType) where.eventType = eventType;
  if (subscriberCode) where.subscriberCode = subscriberCode;

  const [events, total] = await Promise.all([
    prisma.hotmartWebhookEvent.findMany({
      where: where as never,
      select: {
        id: true,
        eventType: true,
        processingStatus: true,
        buyerEmail: true,
        subscriberCode: true,
        productId: true,
        transactionId: true,
        amountCents: true,
        occurredAt: true,
        receivedAt: true,
        processedAt: true,
        errorMessage: true,
      },
      orderBy: { receivedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.hotmartWebhookEvent.count({ where: where as never }),
  ]);

  return NextResponse.json({
    events,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ---------------------------------------------------------------------------
// POST — Replay webhook event
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { eventId } = body as { eventId?: string };

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const event = await prisma.hotmartWebhookEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const adminId = auth.userId;

  // Reset status to RECEIVED for reprocessing
  await prisma.hotmartWebhookEvent.update({
    where: { id: eventId },
    data: {
      processingStatus: "RECEIVED",
      processedAt: null,
      errorMessage: null,
    },
  });

  // Re-extract fields from stored payload
  const payload = event.payloadJson as Record<string, unknown>;
  const fields = extractWebhookFields(payload);

  // Audit log before replay
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "WEBHOOK_REPLAY",
      entityType: "HotmartWebhookEvent",
      entityId: eventId,
      after: {
        eventType: event.eventType,
        subscriberCode: event.subscriberCode,
        previousStatus: event.processingStatus,
      },
    },
  });

  // Re-process
  try {
    await processHotmartEvent(eventId, fields);

    const updated = await prisma.hotmartWebhookEvent.findUnique({
      where: { id: eventId },
      select: { processingStatus: true, processedAt: true, errorMessage: true },
    });

    return NextResponse.json({
      success: true,
      result: updated,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
