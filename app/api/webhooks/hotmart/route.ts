/**
 * app/api/webhooks/hotmart/route.ts
 * Endpoint: POST /api/webhooks/hotmart
 *
 * Responsabilidades:
 *  1. Lê o body bruto — necessário para comparação de token e eventual HMAC
 *  2. Valida assinatura via HOTMART_WEBHOOK_SECRET (timing-safe, fail closed)
 *  3. Extrai campos do payload
 *  4. Gera idempotencyKey determinística
 *  5. Persiste evento bruto na tabela HotmartWebhookEvent
 *     - Se UNIQUE constraint falhar → evento duplicado → retorna 200
 *  6. Chama processHotmartEvent em background (não bloqueia resposta)
 *  7. Retorna 200 rapidamente (Hotmart exige resposta < 5s)
 *
 * Autenticação: token estático X-Hotmart-Hottok (não usa sessão NextAuth).
 * Exceção documentada: webhook externo autenticado por token compartilhado.
 */

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import {
  verifySignature,
  extractWebhookFields,
  buildIdempotencyKey,
} from "@/lib/hotmart/webhook";
import { processHotmartEvent } from "@/lib/hotmart/processor";
import { createNotificationIfNeeded } from "@/lib/admin/notifications";
import { getSecretSetting, SETTING_KEYS } from "@/lib/settings";

export const dynamic = "force-dynamic";

const log = createLogger("webhooks/hotmart");

// Hotmart precisa de resposta em < 5s. Persistimos o evento e processamos depois.
export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Lê body bruto (Buffer) — necessário para validação de assinatura futura
  const rawBuffer = Buffer.from(await req.arrayBuffer());
  const rawText = rawBuffer.toString("utf-8");

  // 2. Valida assinatura — timing-safe, fail closed
  // Carrega webhook secret do banco (DB tem prioridade); fallback para env var tratado dentro de verifySignature
  const dbWebhookSecret = await getSecretSetting(
    SETTING_KEYS.HOTMART_WEBHOOK_SECRET,
  ).catch(() => null);
  try {
    verifySignature(req.headers, rawBuffer, dbWebhookSecret ?? undefined);
  } catch (err) {
    log.warn("Token inválido", { error: (err as Error).message });

    // Notifica admin sobre tentativa com token inválido
    waitUntil(
      createNotificationIfNeeded({
        eventType: "WEBHOOK_INVALID",
        reason: req.headers.get("x-forwarded-for") ?? "IP desconhecido",
        metadata: { error: (err as Error).message },
      }).catch(() => {}),
    );

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse do JSON
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 4. Extrai campos padronizados
  const fields = extractWebhookFields(payload);

  // 5. Gera idempotencyKey
  const idempotencyKey = buildIdempotencyKey(fields, payload);

  // 6. Tenta persistir evento bruto
  let eventId: string;
  try {
    const event = await prisma.hotmartWebhookEvent.create({
      data: {
        // metadados do evento
        payloadVersion: fields.payloadVersion,
        eventType: fields.eventType,
        eventExternalId: fields.eventExternalId,

        // compra
        transactionId: fields.transactionId,
        purchaseStatus: fields.purchaseStatus,
        isSubscription: fields.isSubscription,
        recurrenceNumber: fields.recurrenceNumber,
        amountCents: fields.amountCents,
        currency: fields.currency,
        paymentType: fields.paymentType,
        offerCode: fields.offerCode,

        // assinatura
        subscriptionExternalId: fields.subscriptionExternalId,
        subscriberCode: fields.subscriberCode,
        subscriberEmail: fields.subscriberEmail,
        planCode: fields.planCode,
        planId: fields.planId,
        subscriptionStatus: fields.subscriptionStatus,

        // comprador e produto
        buyerEmail: fields.buyerEmail,
        buyerName: fields.buyerName,
        productId: fields.productId,
        productName: fields.productName,

        occurredAt: fields.occurredAt,
        payloadJson: payload as Prisma.InputJsonValue,
        idempotencyKey,
        processingStatus: "RECEIVED",
      },
      select: { id: true },
    });
    eventId = event.id;
  } catch (err: unknown) {
    // Unique constraint violation → evento duplicado (Prisma error code P2002)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      // Idempotência: já recebemos este evento, retorna 200 sem reprocessar
      return NextResponse.json(
        { status: "duplicate", message: "Evento já recebido." },
        { status: 200 },
      );
    }

    log.error("Erro ao salvar evento", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // 7. Processa via waitUntil — garante execução após resposta no Vercel
  waitUntil(
    processHotmartEvent(eventId, fields).catch((err) => {
      log.error(`Falha ao processar evento ${eventId}`, {
        error: (err as Error).message,
      });
    }),
  );

  // 8. Responde 200 imediatamente (Hotmart considera sucesso)
  return NextResponse.json({ status: "received", eventId }, { status: 200 });
}
