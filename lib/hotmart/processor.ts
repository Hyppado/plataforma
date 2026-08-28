/**
 * lib/hotmart/processor.ts
 * Processa eventos Hotmart v2 e atualiza o estado interno.
 *
 * Exports:
 *  processHotmartEvent(webhookEventId, fields)  — entry point (retry wrapper)
 *  handleApproved(webhookEventId, fields)       — dedicated PURCHASE_APPROVED handler
 *
 * Eventos suportados:
 *  PURCHASE_APPROVED          — compra/renovação aprovada (recurrence_number > 1 = renovação)
 *  PURCHASE_COMPLETE          — compra concluída (após período antichargeback)
 *  PURCHASE_CANCELED          — compra cancelada
 *  PURCHASE_REFUNDED          — reembolso
 *  PURCHASE_CHARGEBACK        — chargeback
 *  PURCHASE_DELAYED           — renovação em atraso (grace period → PAST_DUE)
 *  PURCHASE_EXPIRED           — pagamento expirado (boleto/PIX não pago → EXPIRED)
 *  PURCHASE_PROTEST           — solicitação de reembolso/disputa (charge → REFUND_REQUEST)
 *  PURCHASE_BILLET_PRINTED    — boleto gerado (audit log + notificação admin apenas, sem criar usuário ou enviar email)
 *  PURCHASE_OUT_OF_SHOPPING_CART / CART_ABANDONMENT — carrinho abandonado (informacional)
 *  SUBSCRIPTION_CANCELLATION  — assinatura cancelada definitivamente
 *  SWITCH_PLAN                — mudança de plano
 *  UPDATE_SUBSCRIPTION_CHARGE_DATE — nova data de cobrança (notificação)
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
import { createNotificationIfNeeded } from "../admin/notifications";
import { createLogger } from "../logger";
import { resolveOrSyncPlan } from "./plans";
import { sendOnboardingEmail } from "../email/onboarding";

const log = createLogger("hotmart/processor");

// ---------------------------------------------------------------------------
// Tabelas de eventos
// ---------------------------------------------------------------------------

// PURCHASE_COMPLETE NÃO ativa.
//
// Ele marca o fim do período antichargeback da compra — chega cerca de uma
// semana DEPOIS do PURCHASE_APPROVED e não representa compra nova nem
// renovação. Enquanto estava aqui, ele ressuscitava assinatura cancelada:
//
//   PURCHASE_APPROVED         → ACTIVE
//   SUBSCRIPTION_CANCELLATION → CANCELLED (endedAt = fim do período pago)
//   PURCHASE_COMPLETE         → ACTIVE    ← desfazia o cancelamento
//
// E como a reativação não limpava o endedAt, sobrava uma assinatura ACTIVE com
// data de término no passado — que o resolver honra como acesso pleno para
// sempre, porque ACTIVE não olha endedAt. Medido: 35 assinaturas receberam
// COMPLETE depois de um cancelamento.
//
// O evento segue registrando a cobrança como PAID (CHARGE_STATUS_MAP), que é
// o que ele realmente comunica.
const ACTIVATION_EVENTS = new Set(["PURCHASE_APPROVED"]);

const CANCELLATION_EVENTS = new Set([
  "PURCHASE_CANCELED",
  "PURCHASE_CANCELLED", // variação ortográfica
  "PURCHASE_PROTEST", // PEDIDO de reembolso — ver IMMEDIATE_REVOCATION_EVENTS
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "SUBSCRIPTION_CANCELLATION",
]);

const DELAY_EVENTS = new Set(["PURCHASE_DELAYED"]);

const EXPIRY_EVENTS = new Set(["PURCHASE_EXPIRED"]);

// Eventos que revogam acesso IMEDIATAMENTE (sem honrar período pago)
//
// PURCHASE_PROTEST é o PEDIDO de reembolso, não a confirmação. Ele revoga
// junto: quem pediu o dinheiro de volta não deve seguir usando o produto
// enquanto a disputa corre. Antes ele só marcava a cobrança como
// REFUND_REQUEST e preservava o acesso — na prática, acesso gratuito durante
// todo o processamento do reembolso.
//
// Se o pedido for negado e a Hotmart mandar PURCHASE_APPROVED/COMPLETE
// depois, o acesso volta pelo caminho normal de ativação.
const IMMEDIATE_REVOCATION_EVENTS = new Set([
  "PURCHASE_PROTEST",
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
]);

// Eventos que não alteram estado de assinatura mas geram notificação + audit
// Charge status pode ser atualizado, mas subscription status permanece inalterado.
const STATUS_PRESERVING_EVENTS = new Set([
  "UPDATE_SUBSCRIPTION_CHARGE_DATE", // Nova data de cobrança
  // Fim do período antichargeback da compra. Confirma o pagamento (a cobrança
  // vira PAID por CHARGE_STATUS_MAP) mas não altera o estado da assinatura —
  // ver o comentário em ACTIVATION_EVENTS.
  "PURCHASE_COMPLETE",
]);

// Eventos puramente informativos com notificação admin — sem criação de usuário, sem email
const NOTIFICATION_ONLY_EVENTS = new Set([
  "PURCHASE_BILLET_PRINTED", // Boleto gerado (aguardando pagamento) — apenas notificação
]);

// Eventos puramente informativos — apenas audit log, sem notificação
const INFORMATIONAL_EVENTS = new Set([
  "PURCHASE_OUT_OF_SHOPPING_CART",
  "CART_ABANDONMENT",
  "CLUB_FIRST_ACCESS",
  "CLUB_MODULE_COMPLETED",
]);

// Evento → ChargeStatus
const CHARGE_STATUS_MAP: Record<string, string> = {
  PURCHASE_APPROVED: "PAID",
  PURCHASE_COMPLETE: "PAID",
  PURCHASE_REFUNDED: "REFUNDED",
  PURCHASE_CHARGEBACK: "CHARGEBACK",
  PURCHASE_DELAYED: "OVERDUE",
  PURCHASE_CANCELED: "CANCELLED",
  PURCHASE_CANCELLED: "CANCELLED",
  PURCHASE_PROTEST: "REFUND_REQUEST",
  PURCHASE_EXPIRED: "FAILED",
};

// ---------------------------------------------------------------------------
// Resolve plano interno para provisionamento
// ---------------------------------------------------------------------------
// Tenta resolver nesta ordem:
// 1. Busca por hotmartPlanCode (match exato do planCode do webhook)
// 2. Auto-sync da Hotmart API se não encontrou (via resolveOrSyncPlan)
// 3. Fallback: primeiro plano ativo (por sortOrder)
//
// Nunca bloqueia provisionamento — se nada funcionar, retorna null.

async function getProvisioningPlan(fields: HotmartWebhookFields) {
  // 1. Tenta match por ID numérico Hotmart (plan.id do webhook) e/ou planCode
  const numericPlanId = fields.planId ? parseInt(fields.planId, 10) : undefined;

  if (fields.planCode || numericPlanId != null) {
    const matched = await resolveOrSyncPlan(
      fields.planCode ?? "",
      fields.productId,
      Number.isNaN(numericPlanId) ? undefined : numericPlanId,
    );
    if (matched) return matched;
  }

  // 2. Fallback: primeiro plano ativo (por sortOrder)
  return prisma.plan.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Resolve/cria vínculo externo Hotmart → User interno
// ---------------------------------------------------------------------------
// O User é a entidade principal. Hotmart é apenas uma origem externa.
// Se o email já existe no sistema, vincula. Caso contrário, cria User novo.

async function resolveOrCreateIdentity(fields: HotmartWebhookFields) {
  const rawEmail = fields.buyerEmail ?? fields.subscriberEmail;
  const email = rawEmail ? rawEmail.toLowerCase().trim() : rawEmail;
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
  const isImmediateRevocation = IMMEDIATE_REVOCATION_EVENTS.has(
    fields.eventType,
  );
  const isExpiry = EXPIRY_EVENTS.has(fields.eventType);
  const isSwitchPlan = fields.eventType === "SWITCH_PLAN";

  // Para cancelamentos, usa cancellationDate (data efetiva) ou fallback para occurredAt
  const effectiveCancelledAt = isCancellation
    ? (fields.cancellationDate ?? occurredAt)
    : undefined;

  // Para reembolsos e chargebacks: acesso encerra IMEDIATAMENTE (occurredAt)
  // Para cancelamentos normais: acesso continua até date_next_charge (período já pago)
  const effectiveEndedAt = isCancellation
    ? isImmediateRevocation
      ? occurredAt
      : (fields.accessExpiresAt ?? effectiveCancelledAt ?? occurredAt)
    : (effectiveCancelledAt ?? occurredAt);

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
        // Ativação de verdade anula o cancelamento anterior: quem recomprou não
        // pode carregar a data de término da assinatura antiga. Sem esta
        // limpeza sobra uma ACTIVE com endedAt no passado — estado contraditório
        // que o resolver agora recusa, e que cortaria um cliente pagante.
        ...(isActivation && { endedAt: null, cancelledAt: null }),
        ...(isCancellation && { cancelledAt: effectiveCancelledAt }),
        ...((isExpiry || isCancellation) && {
          endedAt: effectiveEndedAt,
        }),
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
      ...(isCancellation && { cancelledAt: effectiveCancelledAt }),
      ...((isExpiry || isCancellation) && { endedAt: effectiveEndedAt }),
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
// Unresolved identity/plan — audit + admin notification
// ---------------------------------------------------------------------------

/**
 * Evento cujo tipo o código não classifica.
 *
 * Antes esses caíam no fallback "ACTIVE" do dispatch e ativavam a assinatura —
 * um tipo novo da Hotmart podia conceder acesso sem ninguém decidir isso.
 * Agora a assinatura fica intocada e o caso vira audit log + notificação ao
 * admin: nenhum evento é ignorado, mas nenhum evento desconhecido concede
 * acesso. Ao mapear o tipo, ele passa a ser tratado normalmente.
 */
async function logUnmapped(
  webhookEventId: string,
  fields: HotmartWebhookFields,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: "system",
      action: `WEBHOOK_${fields.eventType}_UNMAPPED`,
      entityType: "HotmartWebhookEvent",
      entityId: webhookEventId,
      after: {
        motivo:
          "Tipo de evento não classificado — assinatura preservada por segurança",
        eventType: fields.eventType,
        subscriberCode: fields.subscriberCode,
        buyerEmail: fields.buyerEmail ?? fields.subscriberEmail,
        subscriptionStatus: fields.subscriptionStatus,
      },
    },
  });

  await createNotificationIfNeeded({
    eventType: "EVENT_UNMAPPED",
    email: fields.buyerEmail ?? fields.subscriberEmail,
    reason: `Evento ${fields.eventType} não mapeado — nenhuma alteração de acesso aplicada`,
    eventId: webhookEventId,
    metadata: {
      eventType: fields.eventType,
      subscriberCode: fields.subscriberCode,
    },
  }).catch(() => {});
}

async function logUnresolved(
  webhookEventId: string,
  fields: HotmartWebhookFields,
  reason: string,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: "system",
      action: `WEBHOOK_${fields.eventType}_UNRESOLVED`,
      entityType: "HotmartWebhookEvent",
      entityId: webhookEventId,
      after: {
        reason,
        buyerEmail: fields.buyerEmail,
        subscriberCode: fields.subscriberCode,
        productId: fields.productId,
        planCode: fields.planCode,
      },
    },
  });

  await createNotificationIfNeeded({
    eventType: "IDENTITY_UNRESOLVED",
    email: fields.buyerEmail ?? fields.subscriberEmail,
    reason,
    eventId: webhookEventId,
    metadata: {
      eventType: fields.eventType,
      buyerEmail: fields.buyerEmail,
      subscriberCode: fields.subscriberCode,
      productId: fields.productId,
      planCode: fields.planCode,
    },
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// PURCHASE_APPROVED — dedicated provisioning handler
// ---------------------------------------------------------------------------

/**
 * Handles PURCHASE_APPROVED — the main provisioning event.
 *
 * Steps:
 *   A. Resolve or create the internal user + external account link
 *   B. Reactivate INACTIVE user; warn admin if SUSPENDED
 *   C. Get the internal provisioning plan (first active plan)
 *   D. Create or update Subscription + HotmartSubscription (via upsertSubscription)
 *   E. Create payment/charge record (PAID)
 *   F. Access is runtime-driven — no derived state to persist
 *   G. Create audit trail (distinct action for new vs renewal)
 *   H. Admin notification for first-time purchases only
 *
 * Idempotency:
 *   - Webhook event dedup at persistence layer (idempotencyKey unique)
 *   - Subscription upsert by external ID / subscriberCode
 *   - Charge upsert by transactionId
 *   - Notification dedup by SHA-256 dedupeKey
 *
 * Exported for testing and observability.
 */
export async function handleApproved(
  webhookEventId: string,
  fields: HotmartWebhookFields,
): Promise<void> {
  const isRenewal = (fields.recurrenceNumber ?? 1) > 1;

  // A. Resolve or create the internal user + external account link
  const identity = await resolveOrCreateIdentity(fields);
  if (!identity) {
    await logUnresolved(webhookEventId, fields, "identity_not_found");
    await markProcessed(webhookEventId);
    return;
  }

  // B. Reactivate INACTIVE user (purchasing implies intent to use)
  //    SUSPENDED stays — admin must review before reactivation
  if (identity.user.status === "INACTIVE") {
    await prisma.user.update({
      where: { id: identity.userId },
      data: { status: "ACTIVE" },
    });
    await prisma.auditLog.create({
      data: {
        userId: identity.userId,
        actorId: "system",
        action: "USER_REACTIVATED_BY_PURCHASE",
        entityType: "User",
        entityId: identity.userId,
        after: {
          previousStatus: "INACTIVE",
          newStatus: "ACTIVE",
          trigger: "PURCHASE_APPROVED",
          transactionId: fields.transactionId,
        },
      },
    });
  } else if (identity.user.status === "SUSPENDED") {
    // Subscription will be created but access remains blocked at runtime.
    // Notify admin to review.
    await createNotificationIfNeeded({
      eventType: "SUSPENDED_USER_PURCHASE",
      email: fields.buyerEmail ?? fields.subscriberEmail,
      transactionId: fields.transactionId,
      planCode: fields.planCode,
      userId: identity.userId,
      eventId: webhookEventId,
      metadata: {
        eventType: fields.eventType,
        amountCents: fields.amountCents,
        productId: fields.productId,
      },
    }).catch((err) => {
      log.warn("Failed to create suspended-user notification", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // C. Get the internal provisioning plan (matches by planCode → auto-sync → fallback)
  const plan = await getProvisioningPlan(fields);
  if (!plan) {
    await logUnresolved(webhookEventId, fields, "no_active_plan");
    await markProcessed(webhookEventId);
    return;
  }

  // D. Create or update Subscription + HotmartSubscription
  const subscriptionId = await upsertSubscription(
    fields,
    identity.userId,
    plan.id,
    "ACTIVE",
  );

  // E. Create payment/charge record
  if (fields.transactionId) {
    await prisma.subscriptionCharge.upsert({
      where: { transactionId: fields.transactionId },
      update: {
        status: "PAID" as never,
        amountCents: fields.amountCents,
        currency: fields.currency ?? "BRL",
        paidAt: fields.occurredAt ?? new Date(),
      },
      create: {
        subscriptionId,
        transactionId: fields.transactionId,
        amountCents: fields.amountCents,
        currency: fields.currency ?? "BRL",
        status: "PAID" as never,
        paidAt: fields.occurredAt ?? new Date(),
        chargeAt: fields.occurredAt,
      },
    });
  }

  // F. Courtesy grant cleanup — a paying subscription supersedes any admin
  //    courtesy grant. Revoke active grants so the account becomes a real
  //    subscriber (type derivation stops treating it as courtesy). Idempotent:
  //    on renewals the grant is already revoked, so count is 0 and we skip the log.
  const revokedGrants = await prisma.accessGrant.updateMany({
    where: { userId: identity.userId, isActive: true },
    data: { isActive: false, revokedAt: new Date(), revokedBy: "system" },
  });
  if (revokedGrants.count > 0) {
    await prisma.auditLog.create({
      data: {
        userId: identity.userId,
        actorId: "system",
        action: "ACCESS_GRANT_REVOKED_BY_SUBSCRIPTION",
        entityType: "User",
        entityId: identity.userId,
        after: {
          revokedGrants: revokedGrants.count,
          trigger: "PURCHASE_APPROVED",
          transactionId: fields.transactionId,
        },
      },
    });
  }

  // G. Access — runtime-driven via resolveUserAccess() in lib/access/resolver.ts
  //    Active subscription → FULL_ACCESS. No derived state to persist.

  // H. Audit trail
  await prisma.auditLog.create({
    data: {
      userId: identity.userId,
      actorId: "system",
      action: isRenewal
        ? "WEBHOOK_PURCHASE_RENEWED"
        : "WEBHOOK_PURCHASE_APPROVED",
      entityType: "Subscription",
      entityId: subscriptionId,
      after: {
        status: "ACTIVE",
        eventType: fields.eventType,
        transactionId: fields.transactionId,
        recurrenceNumber: fields.recurrenceNumber,
        planCode: fields.planCode,
        amountCents: fields.amountCents,
        isRenewal,
      },
    },
  });

  // H. Admin notification — first-time purchases only (renewals are routine)
  if (!isRenewal) {
    await createNotificationIfNeeded({
      eventType: "SUBSCRIPTION_ACTIVATED",
      email: fields.buyerEmail ?? fields.subscriberEmail,
      transactionId: fields.transactionId,
      planCode: fields.planCode,
      userId: identity.userId,
      subscriptionId,
      eventId: webhookEventId,
      metadata: {
        eventType: fields.eventType,
        recurrenceNumber: fields.recurrenceNumber,
        amountCents: fields.amountCents,
        productId: fields.productId,
      },
    }).catch((err) => {
      log.warn("Failed to create activation notification", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // I. Onboarding email — first-time purchases for users without a password.
  //    Sends a secure link to create password / first access.
  //    Skipped if user already has passwordHash (idempotent on duplicate webhooks).
  if (!isRenewal) {
    await sendOnboardingEmail({ userId: identity.userId }).catch((err) => {
      log.warn("Failed to send onboarding email", {
        userId: identity.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  await markProcessed(webhookEventId);
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
        log.warn("Retry failed, retrying", {
          label,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          delayMs: delay,
          error: lastErr.message,
        });
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
    log.error("Permanent failure processing event", {
      eventId: webhookEventId,
      error: message,
    });

    await prisma.hotmartWebhookEvent
      .update({
        where: { id: webhookEventId },
        data: {
          processingStatus: "FAILED",
          processedAt: new Date(),
          errorMessage: message.slice(0, 1000),
          retryCount: { increment: 1 },
        },
      })
      .catch(() => {});

    // Notifica admin sobre falha de processamento
    await createNotificationIfNeeded({
      eventType: "PROCESSING_FAILED",
      email: fields.buyerEmail ?? fields.subscriberEmail,
      reason: message.slice(0, 200),
      eventId: webhookEventId,
      metadata: { eventType: fields.eventType, webhookEventId },
    }).catch(() => {});
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

  // Eventos informativos — apenas audit log, sem notificação
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

  // Eventos informativos — apenas audit log + notificação admin, sem criação de usuário ou email
  if (NOTIFICATION_ONLY_EVENTS.has(eventType)) {
    await prisma.auditLog.create({
      data: {
        actorId: "system",
        action: `WEBHOOK_${eventType}`,
        entityType: "HotmartWebhookEvent",
        entityId: webhookEventId,
        after: {
          eventType,
          subscriberCode: fields.subscriberCode,
          transactionId: fields.transactionId,
          productId: fields.productId,
        },
      },
    });
    await createNotificationIfNeeded({
      eventType,
      email: fields.buyerEmail ?? fields.subscriberEmail,
      transactionId: fields.transactionId,
      planCode: fields.planCode,
      eventId: webhookEventId,
      metadata: { eventType },
    }).catch((err) => {
      log.warn("Failed to create notification-only notification", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
    await markProcessed(webhookEventId);
    return;
  }

  // Eventos que preservam status da assinatura (notificação + audit, sem mudança de estado)
  if (STATUS_PRESERVING_EVENTS.has(eventType)) {
    const identity = await resolveOrCreateIdentity(fields);

    let subscriptionId: string | undefined;

    if (identity) {
      // Busca HotmartSubscription existente (sem criar/modificar)
      const orWhere: {
        hotmartSubscriptionId?: string;
        subscriberCode?: string;
      }[] = [];
      if (fields.subscriptionExternalId)
        orWhere.push({ hotmartSubscriptionId: fields.subscriptionExternalId });
      if (fields.subscriberCode)
        orWhere.push({ subscriberCode: fields.subscriberCode });

      const hotmartSub = orWhere.length
        ? await prisma.hotmartSubscription.findFirst({ where: { OR: orWhere } })
        : null;

      subscriptionId = hotmartSub?.subscriptionId;

      // Atualiza externalStatus no HotmartSubscription
      if (hotmartSub) {
        await prisma.hotmartSubscription.update({
          where: { id: hotmartSub.id },
          data: {
            // Só sobrescreve com o que a Hotmart afirma sobre a assinatura.
            // Sem isso, um evento sem `subscriptionStatus` gravaria o próprio
            // nome do evento por cima de um "CANCELED" já conhecido — e a
            // divergência com a Hotmart deixaria de ser detectável.
            externalStatus:
              fields.subscriptionStatus ??
              hotmartSub.externalStatus ??
              fields.eventType,
          },
        });
      }

      // Cria charge record se aplicável
      const chargeStatus = CHARGE_STATUS_MAP[eventType];
      if (chargeStatus && fields.transactionId && subscriptionId) {
        await prisma.subscriptionCharge.upsert({
          where: { transactionId: fields.transactionId },
          update: {
            status: chargeStatus as never,
            amountCents: fields.amountCents,
            currency: fields.currency ?? "BRL",
          },
          create: {
            subscriptionId,
            transactionId: fields.transactionId,
            amountCents: fields.amountCents,
            currency: fields.currency ?? "BRL",
            status: chargeStatus as never,
            chargeAt: fields.occurredAt,
          },
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: identity?.userId,
        actorId: "system",
        action: `WEBHOOK_${eventType}`,
        entityType: subscriptionId ? "Subscription" : "HotmartWebhookEvent",
        entityId: subscriptionId ?? webhookEventId,
        after: {
          eventType,
          subscriberCode: fields.subscriberCode,
          transactionId: fields.transactionId,
          productId: fields.productId,
          amountCents: fields.amountCents,
        },
      },
    });

    // Notificação admin
    await createNotificationIfNeeded({
      eventType,
      email: fields.buyerEmail ?? fields.subscriberEmail,
      transactionId: fields.transactionId,
      planCode: fields.planCode,
      userId: identity?.userId,
      subscriptionId,
      eventId: webhookEventId,
      metadata: {
        eventType,
        amountCents: fields.amountCents,
      },
    }).catch((err) => {
      log.warn("Failed to create status-preserving notification", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    await markProcessed(webhookEventId);
    return;
  }

  // PURCHASE_APPROVED — dedicated provisioning handler
  if (eventType === "PURCHASE_APPROVED") {
    await handleApproved(webhookEventId, fields);
    return;
  }

  // 1. Resolve identidade
  const identity = await resolveOrCreateIdentity(fields);

  // 2. Get provisioning plan (matches by planCode → auto-sync → fallback)
  const plan = await getProvisioningPlan(fields);

  let subscriptionId: string | undefined;

  if (identity && plan) {
    const isActivation = ACTIVATION_EVENTS.has(eventType);
    const isRenewal = (fields.recurrenceNumber ?? 1) > 1;

    // Reativa usuário INACTIVE em eventos de ativação (mesmo comportamento que handleApproved)
    // SUSPENDED permanece — admin deve revisar antes da reativação
    if (isActivation && identity.user.status === "INACTIVE") {
      await prisma.user.update({
        where: { id: identity.userId },
        data: { status: "ACTIVE" },
      });
      await prisma.auditLog.create({
        data: {
          userId: identity.userId,
          actorId: "system",
          action: "USER_REACTIVATED_BY_PURCHASE",
          entityType: "User",
          entityId: identity.userId,
          after: {
            previousStatus: "INACTIVE",
            newStatus: "ACTIVE",
            trigger: eventType,
            transactionId: fields.transactionId,
          },
        },
      });
      // Atualiza referência local para que sendOnboardingEmail não pule por status
      identity.user.status = "ACTIVE";
    }

    // Determina status da assinatura.
    //
    // O fallback era "ACTIVE", então QUALQUER evento que chegasse aqui sem
    // classificação — inclusive um tipo novo que a Hotmart passasse a enviar —
    // ativava a assinatura. Concessão de acesso não pode ser o comportamento
    // padrão de um evento que o código não entende. Agora só SWITCH_PLAN ativa
    // por este caminho; `null` significa "não sei o que isso é" e cai no
    // logUnmapped logo abaixo, que preserva a assinatura.
    const newStatus = isActivation
      ? "ACTIVE"
      : CANCELLATION_EVENTS.has(eventType)
        ? "CANCELLED"
        : DELAY_EVENTS.has(eventType)
          ? "PAST_DUE"
          : EXPIRY_EVENTS.has(eventType)
            ? "EXPIRED"
            : eventType === "SWITCH_PLAN"
              ? "ACTIVE"
              : null;

    if (newStatus === null) {
      // Não classificado: registra e segue sem tocar na assinatura.
      // Nada é ignorado em silêncio — o admin é notificado para mapear o tipo.
      await logUnmapped(webhookEventId, fields);
    } else {
      subscriptionId = await upsertSubscription(
        fields,
        identity.userId,
        plan.id,
        newStatus,
      );
    }

    // 3. Cria SubscriptionCharge se houver transação.
    // Exige subscriptionId: evento não mapeado não cria assinatura, e a
    // cobrança precisa de dono.
    const chargeStatus = CHARGE_STATUS_MAP[eventType];
    if (chargeStatus && fields.transactionId && subscriptionId) {
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

    // 3b. Revoke AccessGrant on refund/chargeback — money returned means access ends immediately.
    if (IMMEDIATE_REVOCATION_EVENTS.has(eventType)) {
      await prisma.accessGrant.updateMany({
        where: { userId: identity.userId, isActive: true },
        data: { isActive: false },
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

    // 5. Notificação admin (cancelamentos, chargebacks, atrasos, etc.)
    await createNotificationIfNeeded({
      eventType,
      email: fields.buyerEmail ?? fields.subscriberEmail,
      transactionId: fields.transactionId,
      planCode: fields.planCode,
      userId: identity.userId,
      subscriptionId,
      eventId: webhookEventId,
      metadata: {
        eventType,
        recurrenceNumber: fields.recurrenceNumber,
        amountCents: fields.amountCents,
      },
    }).catch((err) => {
      log.warn("Failed to create notification", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // 6. Email de onboarding — primeira compra via evento de ativação (ex: PURCHASE_COMPLETE
    //    sem PURCHASE_APPROVED prévio, como ocorre em compras gratuitas/R$ 0,00).
    //    Idempotente: sendOnboardingEmail pula se usuário já tem senha.
    if (isActivation && !isRenewal) {
      await sendOnboardingEmail({ userId: identity.userId }).catch((err) => {
        log.warn("Failed to send onboarding email", {
          userId: identity.userId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // 7. Auto-suspensão em CHARGEBACK (proteção contra fraude)
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
    await logUnresolved(
      webhookEventId,
      fields,
      !identity ? "identity_not_found" : "no_active_plan",
    );
  }

  await markProcessed(webhookEventId);
}

async function markProcessed(id: string) {
  await prisma.hotmartWebhookEvent.update({
    where: { id },
    data: { processingStatus: "PROCESSED", processedAt: new Date() },
  });
}
