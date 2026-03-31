/**
 * lib/hotmart/import-subscribers.ts
 *
 * Importa assinantes existentes da Hotmart API e cria os registros
 * correspondentes no banco (User, ExternalAccountLink, Subscription,
 * HotmartSubscription).
 *
 * Endpoint Hotmart v2:
 *   GET /payments/api/v1/subscriptions?product_id={id}&status={status}
 *
 * Usado pelo admin para importar assinantes que existiam antes do webhook
 * ser configurado.
 */

import { hotmartRequest } from "./client";
import prisma from "../prisma";
import { createLogger, type Logger } from "../logger";

const log = createLogger("hotmart/import-subscribers");

// ---------------------------------------------------------------------------
// Hotmart API types
// ---------------------------------------------------------------------------

interface HotmartSubscriber {
  subscriber_code?: string | number;
  subscription_id?: string | number;
  status?: string; // "ACTIVE" | "INACTIVE" | "DELAYED" | "CANCELLED_BY_CUSTOMER" | "CANCELLED_BY_SELLER" | "CANCELLED_BY_ADMIN" | "EXPIRED" | "STARTED" | "OVERDUE"
  plan?: {
    name?: string;
    id?: number;
    recurrency_period?: string;
  };
  product?: {
    id?: number;
    name?: string;
  };
  accession_date?: number; // epoch ms
  end_date?: number;
  date_next_charge?: number;
  trial?: boolean;
  price?: {
    value?: number;
    currency_code?: string;
  };
  subscriber?: {
    name?: string;
    email?: string;
    ucode?: string;
  };
  request_date?: number;
}

interface HotmartSubscriptionsPage {
  items?: HotmartSubscriber[];
  page_info?: {
    total_results?: number;
    next_page_token?: string;
    results_per_page?: number;
  };
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function toSubscriptionStatus(
  hotmartStatus?: string,
): "ACTIVE" | "CANCELLED" | "PAST_DUE" | "EXPIRED" | "PENDING" {
  switch (hotmartStatus) {
    case "ACTIVE":
    case "STARTED":
      return "ACTIVE";
    case "CANCELLED_BY_CUSTOMER":
    case "CANCELLED_BY_SELLER":
    case "CANCELLED_BY_ADMIN":
    case "INACTIVE":
      return "CANCELLED";
    case "DELAYED":
    case "OVERDUE":
      return "PAST_DUE";
    case "EXPIRED":
      return "EXPIRED";
    default:
      return "PENDING";
  }
}

// ---------------------------------------------------------------------------
// Import result
// ---------------------------------------------------------------------------

export interface ImportSubscribersResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
  details: string[];
}

// ---------------------------------------------------------------------------
// Core import function
// ---------------------------------------------------------------------------

/**
 * Fetches all subscriptions from the Hotmart API for the given product
 * and imports them into the local database.
 *
 * Idempotent: if a HotmartSubscription with the same subscriber_code or
 * subscription_id already exists, the record is skipped.
 */
export async function importSubscribersFromHotmart(
  productId: string,
  parentLog?: Logger,
): Promise<ImportSubscribersResult> {
  const logger = parentLog ?? log;
  const result: ImportSubscribersResult = {
    imported: 0,
    skipped: 0,
    errors: 0,
    total: 0,
    details: [],
  };

  // Resolve plan by hotmartProductId (must exist from prior sync)
  const plan = await prisma.plan.findFirst({
    where: { hotmartProductId: productId, isActive: true },
  });

  if (!plan) {
    // Fallback: try any active plan
    const fallbackPlan = await prisma.plan.findFirst({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    if (!fallbackPlan) {
      result.details.push(
        "Nenhum plano encontrado. Execute a sincronização de planos primeiro.",
      );
      return result;
    }

    logger.warn("No plan linked to product, using fallback", {
      productId,
      fallbackPlan: fallbackPlan.code,
    });

    // Also link the fallback plan to this product so future syncs work
    await prisma.plan.update({
      where: { id: fallbackPlan.id },
      data: { hotmartProductId: productId },
    });

    return await fetchAndImportAll(productId, fallbackPlan.id, logger, result);
  }

  return await fetchAndImportAll(productId, plan.id, logger, result);
}

async function fetchAndImportAll(
  productId: string,
  planId: string,
  logger: Logger,
  result: ImportSubscribersResult,
): Promise<ImportSubscribersResult> {
  // Fetch all pages of subscriptions
  let pageToken: string | undefined;
  let page = 0;

  do {
    page++;
    logger.info("Fetching subscriptions page", { page, productId });

    const params: Record<string, string | number> = {
      product_id: productId,
      max_results: 50,
    };
    if (pageToken) params.page_token = pageToken;

    let data: HotmartSubscriptionsPage;
    try {
      data = await hotmartRequest<HotmartSubscriptionsPage>(
        "/payments/api/v1/subscriptions",
        { params },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to fetch subscriptions", { page, error: msg });
      result.details.push(`Erro ao buscar página ${page}: ${msg}`);
      result.errors++;
      break;
    }

    const items = data?.items ?? [];
    result.total += items.length;

    for (const sub of items) {
      try {
        await importSingleSubscriber(sub, productId, planId, logger, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Error importing subscriber", {
          subscriberCode: sub.subscriber_code,
          error: msg,
        });
        result.errors++;
        result.details.push(
          `Erro: ${sub.subscriber?.email ?? sub.subscriber_code} — ${msg}`,
        );
      }
    }

    pageToken = data?.page_info?.next_page_token;
    // Safety: if we got 0 items or no next_page_token, stop
    if (items.length === 0) break;
  } while (pageToken);

  logger.info("Import complete", {
    imported: result.imported,
    skipped: result.skipped,
    errors: result.errors,
    total: result.total,
  });

  return result;
}

async function importSingleSubscriber(
  sub: HotmartSubscriber,
  productId: string,
  planId: string,
  logger: Logger,
  result: ImportSubscribersResult,
): Promise<void> {
  const email = sub.subscriber?.email;
  const subscriberCode =
    sub.subscriber_code != null ? String(sub.subscriber_code) : undefined;
  const subscriptionId = String(
    sub.subscription_id ?? subscriberCode ?? `hotmart_${Date.now()}`,
  );

  if (!email) {
    result.skipped++;
    result.details.push(
      `Ignorado: subscriber_code=${subscriberCode} — sem email`,
    );
    return;
  }

  // Check if already imported (by hotmartSubscriptionId or subscriberCode)
  const existing = await prisma.hotmartSubscription.findFirst({
    where: {
      OR: [
        { hotmartSubscriptionId: subscriptionId },
        ...(subscriberCode ? [{ subscriberCode }] : []),
      ],
    },
  });

  if (existing) {
    result.skipped++;
    return;
  }

  // Resolve or create user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: sub.subscriber?.name ?? email.split("@")[0],
      role: "USER",
      status: "ACTIVE",
    },
  });

  // Ensure ExternalAccountLink exists
  const linkExists = await prisma.externalAccountLink.findFirst({
    where: { provider: "hotmart", externalEmail: email },
  });

  if (!linkExists) {
    await prisma.externalAccountLink.create({
      data: {
        userId: user.id,
        provider: "hotmart",
        externalCustomerId: subscriberCode ?? undefined,
        externalEmail: email,
        linkConfidence: "auto_email",
        linkMethod: "import",
      },
    });
  }

  // Determine status
  const status = toSubscriptionStatus(sub.status);

  // Create Subscription + HotmartSubscription
  const newSub = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId,
      status,
      source: "hotmart",
      startedAt: sub.accession_date ? new Date(sub.accession_date) : undefined,
      nextChargeAt: sub.date_next_charge
        ? new Date(sub.date_next_charge)
        : undefined,
      endedAt: sub.end_date ? new Date(sub.end_date) : undefined,
      cancelledAt:
        status === "CANCELLED" && sub.end_date
          ? new Date(sub.end_date)
          : undefined,
    },
  });

  await prisma.hotmartSubscription.create({
    data: {
      subscriptionId: newSub.id,
      hotmartSubscriptionId: subscriptionId,
      hotmartProductId: productId,
      hotmartPlanCode: sub.plan?.name ?? undefined,
      buyerEmail: email,
      subscriberCode: subscriberCode ?? undefined,
      externalStatus: sub.status ?? "UNKNOWN",
    },
  });

  result.imported++;
  logger.info("Subscriber imported", {
    email,
    status,
    subscriberCode,
  });
}
