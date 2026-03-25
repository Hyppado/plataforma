/**
 * lib/admin/notifications.ts
 * Serviço de notificações para o painel admin.
 *
 * Gera notificações automaticamente com base em eventos de webhook,
 * falhas de processamento e ações que requerem atenção do admin.
 * Implementa dedup por tipo + userId + janela de 1h.
 */

import prisma from "../prisma";
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
// Janela de dedup (1 hora)
// ---------------------------------------------------------------------------
const DEDUP_WINDOW_MS = 60 * 60 * 1000;

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
  metadata?: Record<string, unknown>;
}

/**
 * Cria uma notificação admin se as regras indicam que o evento é relevante,
 * e se não houver uma notificação duplicada na janela de 1h.
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

  // Dedup: verifica se já existe notificação do mesmo tipo + userId na última hora
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS);
  const existing = await prisma.adminNotification.findFirst({
    where: {
      type: notificationType,
      userId: ctx.userId ?? undefined,
      createdAt: { gte: dedupSince },
    },
    select: { id: true },
  });

  if (existing) return null;

  // Preenche template
  const message = rule.messageTemplate
    .replace("{email}", ctx.email ?? "desconhecido")
    .replace("{transactionId}", ctx.transactionId ?? "N/A")
    .replace("{planCode}", ctx.planCode ?? "N/A")
    .replace("{reason}", ctx.reason ?? "N/A")
    .replace("{eventType}", ctx.eventType)
    .replace("{name}", ctx.email?.split("@")[0] ?? "desconhecido");

  const notification = await prisma.adminNotification.create({
    data: {
      type: notificationType,
      severity: rule.severity,
      title: rule.title,
      message,
      status: "UNREAD",
      userId: ctx.userId ?? undefined,
      subscriptionId: ctx.subscriptionId ?? undefined,
      eventId: ctx.eventId ?? undefined,
      metadata: ctx.metadata ?? undefined,
    },
  });

  return notification.id;
}

/**
 * Cria notificação diretamente por tipo (para uso em cron/reconciliation).
 * Ignora dedup — uso interno.
 */
export async function createDirectNotification(
  type: string,
  overrides?: Partial<{
    severity: NotificationSeverity;
    title: string;
    message: string;
    userId: string;
    subscriptionId: string;
    eventId: string;
    metadata: Record<string, unknown>;
  }>,
): Promise<string> {
  const rule = NOTIFICATION_RULES[type];
  const notification = await prisma.adminNotification.create({
    data: {
      type,
      severity: overrides?.severity ?? rule?.severity ?? "WARNING",
      title: overrides?.title ?? rule?.title ?? type,
      message: overrides?.message ?? rule?.messageTemplate ?? type,
      status: "UNREAD",
      userId: overrides?.userId,
      subscriptionId: overrides?.subscriptionId,
      eventId: overrides?.eventId,
      metadata: overrides?.metadata ?? undefined,
    },
  });
  return notification.id;
}
