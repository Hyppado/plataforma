/**
 * lib/hotmart/subscribers.ts
 *
 * Busca assinantes da API Hotmart e sincroniza com o banco de dados local.
 * Usa o endpoint de subscriptions da Hotmart v2:
 *   GET /payments/api/v1/subscriptions?product_id={id}
 *
 * Isso complementa o fluxo de webhook — webhooks capturam eventos em tempo real,
 * enquanto este sync puxar o estado atual de todas as assinaturas.
 */

import { PrismaClient } from "@prisma/client";
import { hotmartRequest } from "./client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Tipos da API Hotmart — Subscriptions
// ---------------------------------------------------------------------------

interface HotmartSubscriber {
  subscriber_code?: string;
  subscription_id?: string | number;
  status?: string; // "ACTIVE" | "INACTIVE" | "CANCELLED_BY_CUSTOMER" | "CANCELLED_BY_SELLER" | "CANCELLED_BY_ADMIN" | "OVERDUE" | "EXPIRED"
  plan?: {
    id?: string | number;
    name?: string;
  };
  accession_date?: number; // epoch ms — data de adesão
  end_date?: number; // epoch ms — data de fim (se cancelada)
  trial?: {
    end_date?: number;
  };
  price?: {
    value?: number;
    currency_value?: string;
  };
  subscriber?: {
    email?: string;
    name?: string;
    ucode?: string;
  };
  date_next_charge?: number; // epoch ms
  recurrency_period?: string;
}

interface HotmartSubscriptionsPage {
  items?: HotmartSubscriber[];
  page_info?: {
    total_results?: number;
    next_page_token?: string;
    items_per_page?: number;
    results_per_page?: number;
  };
}

// ---------------------------------------------------------------------------
// Mapeamento de status Hotmart → interno
// ---------------------------------------------------------------------------

function mapHotmartStatus(
  externalStatus?: string,
): "ACTIVE" | "CANCELLED" | "PAST_DUE" | "EXPIRED" | "PENDING" {
  if (!externalStatus) return "PENDING";
  const s = externalStatus.toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s.startsWith("CANCELLED") || s === "INACTIVE") return "CANCELLED";
  if (s === "OVERDUE" || s === "DELAYED") return "PAST_DUE";
  if (s === "EXPIRED") return "EXPIRED";
  return "PENDING";
}

// ---------------------------------------------------------------------------
// Sync de Assinantes da Hotmart
// ---------------------------------------------------------------------------

export interface SyncSubscribersResult {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
  total: number;
}

/**
 * Puxa todas as assinaturas do produto na Hotmart e sincroniza com o DB local.
 * Cria User + HotmartIdentity + Subscription + HotmartSubscription conforme necessário.
 */
export async function syncHotmartSubscribers(
  productId: string,
): Promise<SyncSubscribersResult> {
  console.log(`[sync-subscribers] Iniciando sync para produto ${productId}...`);

  const result: SyncSubscribersResult = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: [],
    total: 0,
  };

  let pageToken: string | undefined;
  let pageCount = 0;
  const maxPages = 50; // Safety limit

  do {
    pageCount++;
    if (pageCount > maxPages) {
      result.errors.push(`Limite de ${maxPages} páginas atingido`);
      break;
    }

    try {
      const params: Record<string, string | number | boolean> = {
        product_id: productId,
      };
      if (pageToken) {
        params.page_token = pageToken;
      }

      const data = await hotmartRequest<HotmartSubscriptionsPage>(
        "/payments/api/v1/subscriptions",
        { params },
      );

      const items = data?.items ?? [];
      result.total += items.length;

      for (const item of items) {
        try {
          await syncOneSubscriber(item, productId);
          result.synced++;
          if (item.subscriber_code) {
            // Check if it was a new creation or update
            const existing = await prisma.hotmartSubscription.findFirst({
              where: { subscriberCode: item.subscriber_code },
            });
            if (existing) {
              result.updated++;
            } else {
              result.created++;
            }
          }
        } catch (err) {
          const msg = `Erro sync subscriber ${item.subscriber_code ?? item.subscription_id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[sync-subscribers] ${msg}`);
          result.errors.push(msg);
        }
      }

      pageToken = data?.page_info?.next_page_token ?? undefined;
    } catch (err) {
      const msg = `Erro ao buscar página ${pageCount}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[sync-subscribers] ${msg}`);
      result.errors.push(msg);
      break;
    }
  } while (pageToken);

  console.log(
    `[sync-subscribers] Sync concluído: ${result.synced} sincronizados, ${result.created} criados, ${result.updated} atualizados, ${result.errors.length} erros`,
  );

  return result;
}

/**
 * Sincroniza um assinante individual da Hotmart com o DB local.
 */
async function syncOneSubscriber(
  item: HotmartSubscriber,
  productId: string,
): Promise<void> {
  const email = item.subscriber?.email;
  const subscriberCode = item.subscriber_code;
  const subscriptionExternalId = item.subscription_id
    ? String(item.subscription_id)
    : undefined;

  if (!email && !subscriberCode) {
    throw new Error("Sem email ou subscriber_code");
  }

  // 1. Resolve ou cria User
  let userId: string;
  if (email) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: item.subscriber?.name || undefined,
      },
      create: {
        email,
        name: item.subscriber?.name ?? email.split("@")[0],
        role: "USER",
        status: "ACTIVE",
      },
    });
    userId = user.id;

    // 2. Resolve ou cria HotmartIdentity
    const existingIdentity = await prisma.hotmartIdentity.findFirst({
      where: {
        OR: [
          ...(email ? [{ buyerEmail: email }] : []),
          ...(subscriberCode ? [{ subscriberCode }] : []),
        ],
      },
    });

    if (existingIdentity) {
      if (existingIdentity.userId !== userId) {
        // Identity exists for different user — skip to avoid conflicts
        userId = existingIdentity.userId;
      }
      // Update subscriberCode if needed
      if (subscriberCode && !existingIdentity.subscriberCode) {
        await prisma.hotmartIdentity.update({
          where: { id: existingIdentity.id },
          data: { subscriberCode },
        });
      }
    } else {
      await prisma.hotmartIdentity.create({
        data: {
          userId,
          buyerEmail: email,
          subscriberCode: subscriberCode ?? undefined,
        },
      });
    }
  } else {
    // Only subscriberCode, find existing identity
    const identity = await prisma.hotmartIdentity.findFirst({
      where: { subscriberCode },
    });
    if (!identity) {
      throw new Error(
        `Identity não encontrada para subscriberCode: ${subscriberCode}`,
      );
    }
    userId = identity.userId;
  }

  // 3. Resolve Plan
  const plan = await prisma.plan.findFirst({
    where: { hotmartProductId: productId, isActive: true },
  });
  if (!plan) {
    throw new Error(`Plano não encontrado para productId: ${productId}`);
  }

  const internalStatus = mapHotmartStatus(item.status);
  const accessionDate = item.accession_date
    ? new Date(item.accession_date)
    : undefined;
  const endDate = item.end_date ? new Date(item.end_date) : undefined;
  const nextCharge = item.date_next_charge
    ? new Date(item.date_next_charge)
    : undefined;

  // 4. Find or create HotmartSubscription + Subscription
  const hotmartSubId =
    subscriptionExternalId ?? subscriberCode ?? `sync_${Date.now()}`;

  const existingHotmartSub = await prisma.hotmartSubscription.findFirst({
    where: {
      OR: [
        ...(subscriptionExternalId
          ? [{ hotmartSubscriptionId: subscriptionExternalId }]
          : []),
        ...(subscriberCode ? [{ subscriberCode }] : []),
      ],
    },
  });

  if (existingHotmartSub) {
    // Update existing
    await prisma.subscription.update({
      where: { id: existingHotmartSub.subscriptionId },
      data: {
        status: internalStatus,
        planId: plan.id,
        startedAt: accessionDate ?? undefined,
        cancelledAt: internalStatus === "CANCELLED" ? endDate : undefined,
        endedAt: internalStatus === "EXPIRED" ? endDate : undefined,
        nextChargeAt: nextCharge,
      },
    });

    await prisma.hotmartSubscription.update({
      where: { id: existingHotmartSub.id },
      data: {
        externalStatus: item.status,
        hotmartPlanCode: item.plan?.name ?? undefined,
        buyerEmail: email ?? undefined,
        subscriberCode: subscriberCode ?? undefined,
      },
    });
  } else {
    // Create new
    const newSub = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: internalStatus,
        startedAt: accessionDate,
        cancelledAt: internalStatus === "CANCELLED" ? endDate : undefined,
        endedAt: internalStatus === "EXPIRED" ? endDate : undefined,
        nextChargeAt: nextCharge,
      },
    });

    await prisma.hotmartSubscription.create({
      data: {
        subscriptionId: newSub.id,
        hotmartSubscriptionId: hotmartSubId,
        hotmartProductId: productId,
        hotmartPlanCode: item.plan?.name ?? undefined,
        buyerEmail: email ?? undefined,
        subscriberCode: subscriberCode ?? undefined,
        externalStatus: item.status,
      },
    });
  }
}
