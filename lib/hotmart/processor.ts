/**
 * lib/hotmart/processor.ts
 * Processa eventos Hotmart v2 e atualiza o estado interno.
 *
 * Eventos suportados:
 *  PURCHASE_APPROVED          — compra/renovação aprovada (recurrence_number > 1 = renovação)
 *  PURCHASE_COMPLETE          — compra concluída (após período antichargeback)
 *  PURCHASE_CANCELED          — compra cancelada
 *  PURCHASE_REFUNDED          — reembolso
 *  PURCHASE_CHARGEBACK        — chargeback
 *  PURCHASE_DELAYED           — renovação em atraso (grace period → PAST_DUE)
 *  PURCHASE_BILLET_PRINTED    — boleto gerado (informacional)
 *  PURCHASE_OUT_OF_SHOPPING_CART / CART_ABANDONMENT — carrinho abandonado (informacional)
 *  SUBSCRIPTION_CANCELLATION  — assinatura cancelada definitivamente
 *  SWITCH_PLAN                — mudança de plano
 *  UPDATE_SUBSCRIPTION_CHARGE_DATE — nova data de cobrança (informacional)
 *  CLUB_FIRST_ACCESS          — 1º acesso ao clube (informacional)
 *  CLUB_MODULE_COMPLETED      — módulo concluído (informacional)
 *
 * Nota sobre recorrência:
 *   RECURRENCE_REBILLING_SUCCESS/FAILED NÃO existem como eventos separados.
 *   Renovação bem-sucedida = PURCHASE_APPROVED com recurrence_number > 1
 *   Renovação em atraso    = PURCHASE_DELAYED
 *   Cancelamento por falha = SUBSCRIPTION_CANCELLATION
 */

import prisma from "../prisma";
import type { HotmartWebhookFields } from "./webhook";

// ---------------------------------------------------------------------------
// Tabelas de eventos
// ---------------------------------------------------------------------------

const ACTIVATION_EVENTS = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);

const CANCELLATION_EVENTS = new Set([
  "PURCHASE_CANCELED",
  "PURCHASE_CANCELLED", // variação ortográfica
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "SUBSCRIPTION_CANCELLATION",
]);

const DELAY_EVENTS = new Set(["PURCHASE_DELAYED"]);

// Eventos que não alteram estado de assinatura — apenas auditados
const INFORMATIONAL_EVENTS = new Set([
  "PURCHASE_BILLET_PRINTED",
  "PURCHASE_OUT_OF_SHOPPING_CART",
  "CART_ABANDONMENT",
  "CLUB_FIRST_ACCESS",
  "CLUB_MODULE_COMPLETED",
  "UPDATE_SUBSCRIPTION_CHARGE_DATE",
]);

// Evento → ChargeStatus
const CHARGE_STATUS_MAP: Record<string, string> = {
  PURCHASE_APPROVED: "PAID",
  PURCHASE_COMPLETE: "PAID",
  PURCHASE_REFUNDED: "REFUNDED",
  PURCHASE_CHARGEBACK: "CHARGEBACK",
  PURCHASE_DELAYED: "FAILED",
};

// ---------------------------------------------------------------------------
// Resolve plano interno (PRO_MENSAL / PREMIUM_ANUAL)
// ---------------------------------------------------------------------------
// Edite hotmartProductId + hotmartPlanCode no seed dos planos para ligar ao produto real.

async function resolvePlan(fields: HotmartWebhookFields) {
  if (fields.productId) {
    const plan = await prisma.plan.findFirst({
      where: {
        hotmartProductId: fields.productId,
        isActive: true,
        ...(fields.planCode ? { hotmartPlanCode: fields.planCode } : {}),
      },
    });
    if (plan) return plan;

    // fallback: só productId
    const byProduct = await prisma.plan.findFirst({
      where: { hotmartProductId: fields.productId, isActive: true },
    });
    if (byProduct) return byProduct;
  }

  if (fields.offerCode) {
    return prisma.plan.findFirst({
      where: { hotmartOfferCode: fields.offerCode, isActive: true },
    });
  }

  return null;
}

// ---------------------------------------------------------------------------
// Resolve/cria vínculo externo Hotmart → User interno
// ---------------------------------------------------------------------------
// O User é a entidade principal. Hotmart é apenas uma origem externa.
// Se o email já existe no sistema, vincula. Caso contrário, cria User novo.

async function resolveOrCreateIdentity(fields: HotmartWebhookFields) {
  const email = fields.buyerEmail ?? fields.subscriberEmail;
  const { subscriberCode } = fields;
  if (!email && !subscriberCode) return null;

  // Busca vínculo existente por email ou subscriberCode
  const orConditions: {
    externalEmail?: string;
    externalCustomerId?: string;
  }[] = [];
  if (email) orConditions.push({ externalEmail: email });
  if (subscriberCode) orConditions.push({ externalCustomerId: subscriberCode });

  const existing = await prisma.externalAccountLink.findFirst({
    where: { provider: "hotmart", OR: orConditions },
    include: { user: true },
  });

  if (existing) {
    // Atualiza subscriberCode se chegou agora
    if (subscriberCode && !existing.externalCustomerId) {
      await prisma.externalAccountLink.update({
        where: { id: existing.id },
        data: { externalCustomerId: subscriberCode },
      });
    }
    return existing;
  }

  if (!email) return null;

  // Busca ou cria User pelo email (User é independente do Hotmart)
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: fields.buyerName ?? email.split("@")[0],
      role: "USER",
      status: "ACTIVE",
    },
  });

  return prisma.externalAccountLink.create({
    data: {
      userId: user.id,
      provider: "hotmart",
      externalCustomerId: subscriberCode ?? undefined,
      externalEmail: email,
      linkConfidence: "auto_email",
      linkMethod: "webhook",
    },
    include: { user: true },
  });
}

// ---------------------------------------------------------------------------
// Upsert Subscription + HotmartSubscription
// ---------------------------------------------------------------------------

async function upsertSubscription(
  fields: HotmartWebhookFields,
  userId: string,
  planId: string,
  newStatus: string,
): Promise<string> {
  const occurredAt = fields.occurredAt ?? new Date();
  const isActivation = ACTIVATION_EVENTS.has(fields.eventType);
  const isCancellation = CANCELLATION_EVENTS.has(fields.eventType);
  const isSwitchPlan = fields.eventType === "SWITCH_PLAN";

  // Busca HotmartSubscription existente por id externo ou subscriberCode
  const orWhere: { hotmartSubscriptionId?: string; subscriberCode?: string }[] =
    [];
  if (fields.subscriptionExternalId)
    orWhere.push({ hotmartSubscriptionId: fields.subscriptionExternalId });
  if (fields.subscriberCode)
    orWhere.push({ subscriberCode: fields.subscriberCode });

  const hotmartSub = orWhere.length
    ? await prisma.hotmartSubscription.findFirst({ where: { OR: orWhere } })
    : null;

  if (hotmartSub) {
    const subscriptionId = hotmartSub.subscriptionId;

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: newStatus as never,
        ...(isSwitchPlan && { planId }),
        ...(isActivation && { renewedAt: occurredAt }),
        ...(isActivation &&
          fields.recurrenceNumber === 1 && { startedAt: occurredAt }),
        ...(isCancellation && { cancelledAt: occurredAt }),
        ...(newStatus === "EXPIRED" && { endedAt: occurredAt }),
      },
    });

    await prisma.hotmartSubscription.update({
      where: { id: hotmartSub.id },
      data: {
        externalStatus: fields.subscriptionStatus ?? fields.eventType,
        subscriberCode: fields.subscriberCode ?? hotmartSub.subscriberCode,
        hotmartPlanCode: fields.planCode ?? hotmartSub.hotmartPlanCode,
        hotmartOfferCode: fields.offerCode ?? hotmartSub.hotmartOfferCode,
      },
    });

    return subscriptionId;
  }

  // Cria nova Subscription + HotmartSubscription
  const newSub = await prisma.subscription.create({
    data: {
      userId,
      planId,
      status: newStatus as never,
      startedAt: isActivation ? occurredAt : undefined,
    },
  });

  await prisma.hotmartSubscription.create({
    data: {
      subscriptionId: newSub.id,
      hotmartSubscriptionId:
        fields.subscriptionExternalId ?? `hotmart_${Date.now()}`,
      hotmartProductId: fields.productId,
      hotmartPlanCode: fields.planCode,
      hotmartOfferCode: fields.offerCode,
      buyerEmail: fields.buyerEmail ?? fields.subscriberEmail,
      subscriberCode: fields.subscriberCode,
      externalStatus: fields.subscriptionStatus ?? fields.eventType,
    },
  });

  return newSub.id;
}

// ---------------------------------------------------------------------------
// Retry helper com backoff exponencial
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 2000, 5000]; // ms

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt] ?? 5000;
        console.warn(
          `[Hotmart Processor] ${label} tentativa ${attempt + 1}/${MAX_RETRIES} falhou, retry em ${delay}ms:`,
          lastErr.message,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Processador principal
// ---------------------------------------------------------------------------

export async function processHotmartEvent(
  webhookEventId: string,
  fields: HotmartWebhookFields,
): Promise<void> {
  // Marca como PROCESSING
  await prisma.hotmartWebhookEvent
    .update({
      where: { id: webhookEventId },
      data: { processingStatus: "PROCESSING" },
    })
    .catch(() => {});

  try {
    await withRetry(
      () => _processEvent(webhookEventId, fields),
      `evento ${webhookEventId}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Hotmart Processor] Falha definitiva:", message);

    await prisma.hotmartWebhookEvent
      .update({
        where: { id: webhookEventId },
        data: {
          processingStatus: "FAILED",
          processedAt: new Date(),
          errorMessage: message.slice(0, 1000),
        },
      })
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Lógica de processamento (chamada com retry)
// ---------------------------------------------------------------------------

async function _processEvent(
  webhookEventId: string,
  fields: HotmartWebhookFields,
): Promise<void> {
  const { eventType } = fields;

  // Eventos informativos — apenas audit log
  if (INFORMATIONAL_EVENTS.has(eventType)) {
    await prisma.auditLog.create({
      data: {
        actorId: "system",
        action: `WEBHOOK_${eventType}`,
        entityType: "HotmartWebhookEvent",
        entityId: webhookEventId,
        after: {
          eventType,
          subscriberCode: fields.subscriberCode,
          productId: fields.productId,
        },
      },
    });
    await markProcessed(webhookEventId);
    return;
  }

  // 1. Resolve identidade
  const identity = await resolveOrCreateIdentity(fields);

  // 2. Resolve plano
  const plan = await resolvePlan(fields);

  let subscriptionId: string | undefined;

  if (identity && plan) {
    // Determina status da assinatura
    const newStatus = ACTIVATION_EVENTS.has(eventType)
      ? "ACTIVE"
      : CANCELLATION_EVENTS.has(eventType)
        ? "CANCELLED"
        : DELAY_EVENTS.has(eventType)
          ? "PAST_DUE"
          : "ACTIVE"; // SWITCH_PLAN e outros

    subscriptionId = await upsertSubscription(
      fields,
      identity.userId,
      plan.id,
      newStatus,
    );

    // 3. Cria SubscriptionCharge se houver transação
    const chargeStatus = CHARGE_STATUS_MAP[eventType];
    if (chargeStatus && fields.transactionId) {
      await prisma.subscriptionCharge.upsert({
        where: { transactionId: fields.transactionId },
        update: {
          status: chargeStatus as never,
          amountCents: fields.amountCents,
          currency: fields.currency ?? "BRL",
          paidAt:
            chargeStatus === "PAID"
              ? (fields.occurredAt ?? new Date())
              : undefined,
        },
        create: {
          subscriptionId,
          transactionId: fields.transactionId,
          amountCents: fields.amountCents,
          currency: fields.currency ?? "BRL",
          status: chargeStatus as never,
          paidAt:
            chargeStatus === "PAID"
              ? (fields.occurredAt ?? new Date())
              : undefined,
          chargeAt: fields.occurredAt,
        },
      });
    }

    // 4. Audit log
    await prisma.auditLog.create({
      data: {
        userId: identity.userId,
        actorId: "system",
        action: `WEBHOOK_${eventType}`,
        entityType: "Subscription",
        entityId: subscriptionId,
        after: {
          status: newStatus,
          eventType,
          transactionId: fields.transactionId,
          recurrenceNumber: fields.recurrenceNumber,
          planCode: fields.planCode,
          amountCents: fields.amountCents,
        },
      },
    });

    // 5. Auto-suspensão em CHARGEBACK (proteção contra fraude)
    if (eventType === "PURCHASE_CHARGEBACK") {
      await prisma.user.update({
        where: { id: identity.userId },
        data: { status: "SUSPENDED" },
      });
      await prisma.auditLog.create({
        data: {
          userId: identity.userId,
          actorId: "system",
          action: "AUTO_SUSPENSION_CHARGEBACK",
          entityType: "User",
          entityId: identity.userId,
          after: {
            reason: "Chargeback detectado — conta suspensa automaticamente",
            transactionId: fields.transactionId,
            webhookEventId,
          },
        },
      });
    }
  } else {
    // Sem identidade ou plano resolvido — loga para investigação
    await prisma.auditLog.create({
      data: {
        actorId: "system",
        action: `WEBHOOK_${eventType}_UNRESOLVED`,
        entityType: "HotmartWebhookEvent",
        entityId: webhookEventId,
        after: {
          reason: !identity ? "identity_not_found" : "plan_not_found",
          buyerEmail: fields.buyerEmail,
          subscriberCode: fields.subscriberCode,
          productId: fields.productId,
          planCode: fields.planCode,
        },
      },
    });
  }

  await markProcessed(webhookEventId);
}

async function markProcessed(id: string) {
  await prisma.hotmartWebhookEvent.update({
    where: { id },
    data: { processingStatus: "PROCESSED", processedAt: new Date() },
  });
}
