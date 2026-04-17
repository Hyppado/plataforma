/**
 * lib/hotmart/webhook.ts
 * Parse e extração de campos do payload Hotmart v2.
 * Geração determinística de idempotencyKey.
 * Validação de assinatura via X-Hotmart-Hottok.
 *
 * Estrutura v2 de referência:
 *   body.event                                   → tipo do evento
 *   body.id                                      → UUID do evento
 *   body.version                                 → "2.0.0"
 *   body.creation_date                           → epoch ms
 *   body.data.buyer.email/name                   → comprador
 *   body.data.product.id/name                    → produto
 *   body.data.purchase.transaction               → id da transação
 *   body.data.purchase.status                    → APPROVED/CANCELED/etc.
 *   body.data.purchase.is_subscription           → boolean
 *   body.data.purchase.recurrence_number         → 1=novo, >1=renovação
 *   body.data.purchase.offer.code                → código da oferta
 *   body.data.purchase.price.value/currency_value → valor e moeda
 *   body.data.purchase.payment.type              → CREDIT_CARD/PIX/BILLET
 *   body.data.subscription.id                    → id da assinatura
 *   body.data.subscription.plan.name/id          → plano
 *   body.data.subscription.subscriber.code/email → assinante
 *   body.data.subscription.status                → ACTIVE/CANCELED/DELAYED/EXPIRED
 */

import { createHash, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface HotmartWebhookFields {
  payloadVersion?: string;
  eventType: string;
  eventExternalId?: string;

  // Compra
  transactionId?: string;
  purchaseStatus?: string;
  isSubscription?: boolean;
  recurrenceNumber?: number;
  amountCents?: number;
  currency?: string;
  paymentType?: string;
  offerCode?: string;

  // Assinatura
  subscriptionExternalId?: string;
  subscriberCode?: string;
  subscriberEmail?: string;
  planCode?: string;
  planId?: string;
  subscriptionStatus?: string;

  // Comprador
  buyerEmail?: string;
  buyerName?: string;

  // Boleto
  /** URL de pagamento do boleto (data.purchase.sckPaymentLink) */
  billetUrl?: string;

  // Produto
  productId?: string;
  productName?: string;

  // Datas
  occurredAt?: Date;
  /** Data efetiva de cancelamento (epoch ms enviado pela Hotmart em data.cancellation_date) */
  cancellationDate?: Date;
  /** Data até quando o acesso permanece válido (epoch ms enviado pela Hotmart em data.date_next_charge) */
  accessExpiresAt?: Date;
}

// ---------------------------------------------------------------------------
// Validação de assinatura — token estático com comparação timing-safe
// ---------------------------------------------------------------------------

/**
 * Compara dois strings com tempo constante, prevenindo timing attacks.
 * Rejeita imediatamente se os comprimentos forem diferentes (sem vazar timing).
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Executa comparação dummy para manter constância de tempo
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida o token HOTTOK enviado pela Hotmart no header X-Hotmart-Hottok.
 *
 * O Hotmart envia um token estático configurado no painel Developers → Webhooks.
 * A validação usa comparação timing-safe para prevenir timing attacks.
 *
 * O secret deve ser carregado pelo caller a partir do banco (via painel admin).
 * Nunca lê variáveis de ambiente — falha fechado se secret não for fornecido.
 *
 * Lança Error se: token ausente, incorreto, ou secret não fornecido.
 *
 * @param headers — headers da requisição recebida
 * @param _rawBody — corpo bruto (reservado para validação futura se Hotmart adotar HMAC)
 * @param secret — webhook secret carregado do banco pelo caller (obrigatório)
 */
export function verifySignature(
  headers: Headers,
  _rawBody: Buffer,
  secret: string,
): void {
  // Fail closed: sem secret = rejeita tudo
  if (!secret) {
    throw new Error(
      "[Hotmart Webhook] Webhook secret não configurado. Configure via painel admin.",
    );
  }

  const received = headers.get("x-hotmart-hottok") ?? "";

  if (!timingSafeStringEqual(received, secret)) {
    throw new Error("[Hotmart Webhook] Token inválido.");
  }
}

// ---------------------------------------------------------------------------
// Extração de campos — estrutura Hotmart v2 (resiliente a v1)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function str(v: any): string | undefined {
  return v != null ? String(v) : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number | undefined {
  const n = Number(v);
  return v != null && !isNaN(n) ? n : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bool(v: any): boolean | undefined {
  return v != null ? Boolean(v) : undefined;
}

function parseDate(raw: unknown): Date | undefined {
  if (raw == null) return undefined;
  let ms: number;
  if (typeof raw === "number") {
    // Hotmart sometimes sends timestamps in seconds (10 digits) instead of ms (13 digits).
    // A 10-digit Unix timestamp represents dates ~2001-2286; 13-digit is ms since epoch.
    // Threshold: values < 10_000_000_000 are treated as seconds.
    ms = raw < 10_000_000_000 ? raw * 1000 : raw;
  } else {
    ms = new Date(raw as string).getTime();
  }
  return isNaN(ms) ? undefined : new Date(ms);
}

/**
 * Extrai campos padronizados de um payload Hotmart v2.
 * Mantém fallbacks para v1 (root-level subscriber, etc.).
 * O payload bruto é sempre salvo integralmente.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractWebhookFields(
  payload: Record<string, any>,
): HotmartWebhookFields {
  const d = payload?.data ?? {};

  // event
  const eventType: string =
    payload?.event ?? payload?.type ?? payload?.name ?? "UNKNOWN";
  const eventExternalId = str(payload?.id ?? payload?.event_id);
  const payloadVersion = str(payload?.version);

  // purchase
  const purchase = d?.purchase ?? payload?.purchase ?? {};
  const transactionId = str(purchase?.transaction ?? payload?.transaction);
  const purchaseStatus = str(purchase?.status);
  const isSubscription = bool(purchase?.is_subscription);
  const recurrenceNumber = num(purchase?.recurrence_number);
  const amountCents = num(purchase?.price?.value);
  const currency = str(purchase?.price?.currency_value ?? purchase?.currency);
  const paymentType = str(purchase?.payment?.type);
  const offerCode = str(
    purchase?.offer?.code ?? payload?.offer?.code ?? payload?.offer_code,
  );

  // subscription
  const sub = d?.subscription ?? payload?.subscription ?? {};
  const subscriptionExternalId = str(sub?.id);
  const planCode = str(
    sub?.plan?.name ?? payload?.plan?.name ?? payload?.plan_name,
  );
  const planId = str(sub?.plan?.id);
  const subscriptionStatus = str(sub?.status);

  // subscriber — v2: data.subscription.subscriber | v1: data.subscriber / root subscriber
  const subscriber =
    sub?.subscriber ?? d?.subscriber ?? payload?.subscriber ?? {};
  const subscriberCode = str(subscriber?.code ?? payload?.subscriber_code);
  const subscriberEmail = str(subscriber?.email);

  // buyer
  const buyer = d?.buyer ?? payload?.buyer ?? {};
  const buyerEmail = str(
    buyer?.email ??
      purchase?.buyer?.email ??
      // se subscriber_email vier sem buyer (alguns eventos de club)
      subscriberEmail,
  );
  const buyerName = str(buyer?.name ?? buyer?.full_name ?? subscriber?.name);

  // product
  const product = d?.product ?? payload?.product ?? {};
  const productId = str(product?.id);
  const productName = str(product?.name);

  // occurred_at — creation_date é epoch ms no root level
  const occurredAt = parseDate(
    payload?.creation_date ??
      d?.creation_date ??
      payload?.event_date ??
      payload?.occurred_at,
  );

  // cancellation_date — epoch ms específico de SUBSCRIPTION_CANCELLATION
  const cancellationDate = parseDate(d?.cancellation_date);

  // date_next_charge — fim do período pago (quando o acesso expira após cancelamento)
  const accessExpiresAt = parseDate(d?.date_next_charge);

  // billet payment link
  const billetUrl = str(purchase?.sckPaymentLink);

  return {
    payloadVersion,
    eventType,
    eventExternalId,
    billetUrl,
    transactionId,
    purchaseStatus,
    isSubscription,
    recurrenceNumber,
    amountCents,
    currency,
    paymentType,
    offerCode,
    subscriptionExternalId,
    subscriberCode,
    subscriberEmail,
    planCode,
    planId,
    subscriptionStatus,
    buyerEmail,
    buyerName,
    productId,
    productName,
    occurredAt,
    cancellationDate,
    accessExpiresAt,
  };
}

// ---------------------------------------------------------------------------
// Idempotency key
// ---------------------------------------------------------------------------

/**
 * Gera chave SHA-256 determinística para idempotência.
 * Usa apenas campos imutáveis do evento — NÃO o payload completo
 * (que pode variar em whitespace/ordem entre tentativas duplicadas).
 *
 * Composição: eventType + eventExternalId + anchor(sub|transaction) + occurredAt
 */
export function buildIdempotencyKey(
  fields: HotmartWebhookFields,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _payload: Record<string, any>,
): string {
  // Âncora preferencial: UUID do evento (mais estável), depois sub/transação
  const anchor =
    fields.eventExternalId ??
    fields.subscriptionExternalId ??
    fields.transactionId ??
    fields.subscriberCode ??
    "no-id";

  const canonical = [
    fields.eventType,
    anchor,
    fields.occurredAt?.toISOString() ?? "no-date",
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}
