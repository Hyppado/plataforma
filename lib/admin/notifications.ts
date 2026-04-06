/**
 * lib/admin/notifications.ts
 * Serviço de notificações para o painel admin.
 *
 * Gera notificações automaticamente com base em eventos de webhook,
 * falhas de processamento e ações que requerem atenção do admin.
 * Dedup determinístico via SHA-256 dedupeKey (DB-enforced unique).
 */

import { createHash } from "crypto";
import prisma from "../prisma";
import { Prisma } from "@prisma/client";
import type { NotificationSeverity } from "@prisma/client";

// ---------------------------------------------------------------------------
// Regras de notificação por evento
// ---------------------------------------------------------------------------

export interface NotificationRule {
  severity: NotificationSeverity;
  title: string;
  /** Template de mensagem — placeholders: {email}, {name}, {transactionId}, {planCode}, {reason} */
  messageTemplate: string;
}

/**
 * Mapa de tipo de notificação → regra.
 * Tipos que NÃO aparecem aqui NÃO geram notificação (info-only → audit log).
 */
export const NOTIFICATION_RULES: Record<string, NotificationRule> = {
  // Cancelamentos
  SUBSCRIPTION_CANCELED: {
    severity: "WARNING",
    title: "Assinatura cancelada",
    messageTemplate: "Assinatura de {email} foi cancelada ({eventType}).",
  },

  // Reembolso
  SUBSCRIPTION_REFUNDED: {
    severity: "HIGH",
    title: "Reembolso processado",
    messageTemplate: "Reembolso para {email} — transação {transactionId}.",
  },

  // Chargeback — mais crítico
  SUBSCRIPTION_CHARGEBACK: {
    severity: "CRITICAL",
    title: "Chargeback detectado",
    messageTemplate:
      "Chargeback de {email} — transação {transactionId}. Conta suspensa automaticamente.",
  },

  // Atraso de pagamento
  SUBSCRIPTION_DELAYED: {
    severity: "WARNING",
    title: "Pagamento em atraso",
    messageTemplate:
      "Pagamento de {email} está em atraso (grace period). Plano: {planCode}.",
  },

  // Assinatura cancelada definitivamente
  SUBSCRIPTION_CANCELLATION: {
    severity: "WARNING",
    title: "Cancelamento definitivo",
    messageTemplate:
      "Assinatura de {email} cancelada definitivamente pelo Hotmart.",
  },

  // Segurança — HOTTOK inválido
  WEBHOOK_INVALID: {
    severity: "CRITICAL",
    title: "Webhook não autorizado",
    messageTemplate: "Tentativa de webhook com HOTTOK inválido. IP: {reason}.",
  },

  // Falha de processamento após 3 tentativas
  PROCESSING_FAILED: {
    severity: "HIGH",
    title: "Falha no processamento",
    messageTemplate:
      "Evento {eventType} falhou após tentativas. Erro: {reason}.",
  },

  // Identidade não resolvida
  IDENTITY_UNRESOLVED: {
    severity: "WARNING",
    title: "Identidade não resolvida",
    messageTemplate:
      "Evento {eventType} de {email}: não foi possível resolver identidade ou plano.",
  },

  // Nova compra aprovada (primeira aquisição — provisioning event)
  SUBSCRIPTION_ACTIVATED: {
    severity: "INFO",
    title: "Nova assinatura ativada",
    messageTemplate:
      "Compra aprovada para {email} — plano {planCode}. Transação {transactionId}.",
  },

  // Compra aprovada para usuário suspenso (requer atenção do admin)
  SUSPENDED_USER_PURCHASE: {
    severity: "WARNING",
    title: "Compra de usuário suspenso",
    messageTemplate:
      "Compra aprovada para {email} (conta suspensa). Transação {transactionId}. Verificar situação.",
  },
};

// Mapeamento eventType do Hotmart → tipo de notificação
const EVENT_TO_NOTIFICATION_TYPE: Record<string, string> = {
  PURCHASE_CANCELED: "SUBSCRIPTION_CANCELED",
  PURCHASE_CANCELLED: "SUBSCRIPTION_CANCELED",
  PURCHASE_REFUNDED: "SUBSCRIPTION_REFUNDED",
  PURCHASE_CHARGEBACK: "SUBSCRIPTION_CHARGEBACK",
  PURCHASE_DELAYED: "SUBSCRIPTION_DELAYED",
  SUBSCRIPTION_CANCELLATION: "SUBSCRIPTION_CANCELLATION",
};

// ---------------------------------------------------------------------------
// Deterministic dedup key — SHA-256
// ---------------------------------------------------------------------------

/**
 * Builds a deterministic dedup key for a notification.
 * - If eventId present: SHA-256(type:evt:{eventId}) — one notification per webhook event
 * - If transactionId present (no eventId): SHA-256(type:txn:{transactionId})
 * - Otherwise: null — no dedup, always creates
 */
export function buildDedupeKey(
  type: string,
  eventId?: string | null,
  transactionId?: string | null,
): string | null {
  let raw: string | null = null;

  if (eventId) {
    raw = `${type}:evt:${eventId}`;
  } else if (transactionId) {
    raw = `${type}:txn:${transactionId}`;
  }

  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Criação de notificação com dedup
// ---------------------------------------------------------------------------

export interface NotificationContext {
  eventType: string;
  email?: string | null;
  transactionId?: string | null;
  planCode?: string | null;
  reason?: string | null;
  userId?: string | null;
  subscriptionId?: string | null;
  eventId?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Cria uma notificação admin se as regras indicam que o evento é relevante,
 * e se não houver uma notificação duplicada (deterministic dedupeKey).
 *
 * @returns ID da notificação criada, ou null se dedup/regra não aplicável
 */
export async function createNotificationIfNeeded(
  ctx: NotificationContext,
): Promise<string | null> {
  // Determina o tipo de notificação
  const notificationType =
    EVENT_TO_NOTIFICATION_TYPE[ctx.eventType] ?? ctx.eventType;
  const rule = NOTIFICATION_RULES[notificationType];

  // Sem regra = evento info-only → não notifica
  if (!rule) return null;

  // Build deterministic dedup key
  const dedupeKey = buildDedupeKey(
    notificationType,
    ctx.eventId,
    ctx.transactionId,
  );

  // If we have a dedup key, check if it already exists
  if (dedupeKey) {
    const existing = await prisma.adminNotification.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });
    if (existing) return null;
  }

  // Preenche template
  const message = rule.messageTemplate
    .replace("{email}", ctx.email ?? "desconhecido")
    .replace("{transactionId}", ctx.transactionId ?? "N/A")
    .replace("{planCode}", ctx.planCode ?? "N/A")
    .replace("{reason}", ctx.reason ?? "N/A")
    .replace("{eventType}", ctx.eventType)
    .replace("{name}", ctx.email?.split("@")[0] ?? "desconhecido");

  try {
    const notification = await prisma.adminNotification.create({
      data: {
        source: ctx.source ?? "hotmart",
        type: notificationType,
        severity: rule.severity,
        title: rule.title,
        message,
        status: "UNREAD",
        dedupeKey,
        userId: ctx.userId ?? undefined,
        subscriptionId: ctx.subscriptionId ?? undefined,
        eventId: ctx.eventId ?? undefined,
        metadata: (ctx.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });

    return notification.id;
  } catch (error) {
    // P2002 = unique constraint violation (race condition on dedupeKey)
    // Another concurrent request already created this notification — safe to ignore.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Cria notificação diretamente por tipo (para uso em cron/reconciliation).
 * dedupeKey = null → sempre cria (sem dedup).
 */
export async function createDirectNotification(
  type: string,
  overrides?: Partial<{
    severity: NotificationSeverity;
    title: string;
    message: string;
    source: string;
    userId: string;
    subscriptionId: string;
    eventId: string;
    metadata: Record<string, unknown>;
  }>,
): Promise<string> {
  const rule = NOTIFICATION_RULES[type];
  const notification = await prisma.adminNotification.create({
    data: {
      source: overrides?.source ?? "system",
      type,
      severity: overrides?.severity ?? rule?.severity ?? "WARNING",
      title: overrides?.title ?? rule?.title ?? type,
      message: overrides?.message ?? rule?.messageTemplate ?? type,
      status: "UNREAD",
      userId: overrides?.userId,
      subscriptionId: overrides?.subscriptionId,
      eventId: overrides?.eventId,
      metadata: (overrides?.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
  return notification.id;
}
