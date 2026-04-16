/**
 * lib/hotmart/plans.ts
 *
 * Funções para consulta de planos e produtos na Hotmart API.
 * Utiliza o client genérico de lib/hotmart/client.ts.
 *
 * Endpoints consumidos:
 *   GET /products/api/v1/products             — lista produtos
 *   GET /products/api/v1/products/:ucode/plans — lista planos do produto
 */

import { hotmartRequest } from "./client";
import { createLogger } from "../logger";

const log = createLogger("hotmart/plans");

// ---------------------------------------------------------------------------
// Types — Hotmart API responses
// ---------------------------------------------------------------------------

export interface HotmartProduct {
  id: number; // numeric product ID (same as webhook productId)
  ucode: string; // UUID needed for plans endpoint
  name: string;
  status: string; // "ACTIVE", etc.
  is_subscription: boolean;
  format: string;
}

interface HotmartProductListResponse {
  items: HotmartProduct[];
  page_info?: {
    total_results: number;
    next_page_token?: string;
  };
}

export interface HotmartPlanPrice {
  value: number; // centavos
  currency_code: string; // "BRL", "USD", etc.
}

export interface HotmartPlan {
  code: string; // plan code (matches webhook planCode)
  name: string;
  description?: string;
  periodicity: string; // "MONTHLY", "BIMONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL"
  price: HotmartPlanPrice;
  payment_mode: string;
  max_installments?: number;
  trial_period?: number;
  is_switch_plan_enabled?: boolean;
  is_subscription_recovery_enabled?: boolean;
}

interface HotmartPlanListResponse {
  items: HotmartPlan[];
  page_info?: {
    total_results: number;
    next_page_token?: string;
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Lista produtos da Hotmart.
 * Opcionalmente filtra por id numérico ou status.
 */
export async function listProducts(filters?: {
  id?: number;
  status?: string;
}): Promise<HotmartProduct[]> {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (filters?.id) params.id = filters.id;
  if (filters?.status) params.status = filters.status;

  const response = await hotmartRequest<HotmartProductListResponse>(
    "/products/api/v1/products",
    { params },
  );

  return response.items ?? [];
}

/**
 * Busca um produto pelo ID numérico (o mesmo que chega no webhook productId).
 * Retorna o produto (com ucode) ou null se não encontrado.
 */
export async function getProductByNumericId(
  productId: number,
): Promise<HotmartProduct | null> {
  const products = await listProducts({ id: productId });
  return products[0] ?? null;
}

/**
 * Lista todos os planos de um produto Hotmart (por ucode).
 */
export async function listPlansForProduct(
  productUcode: string,
): Promise<HotmartPlan[]> {
  const response = await hotmartRequest<HotmartPlanListResponse>(
    `/products/api/v1/products/${productUcode}/plans`,
  );

  return response.items ?? [];
}

// ---------------------------------------------------------------------------
// Sync — fetch Hotmart plans → upsert local Plan records
// ---------------------------------------------------------------------------

/**
 * Mapeia periodicidade Hotmart para o enum PlanPeriod do Prisma.
 * Hotmart pode enviar: MONTHLY, BIMONTHLY, QUARTERLY, BIANNUAL, ANNUAL.
 * O sistema suporta MONTHLY e ANNUAL — outros mapeiam para MONTHLY como fallback.
 */
function mapPeriodicity(hotmartPeriod: string): "MONTHLY" | "ANNUAL" {
  if (hotmartPeriod === "ANNUAL") return "ANNUAL";
  return "MONTHLY";
}

/**
 * Gera um slug determinístico a partir do plan code da Hotmart.
 * Ex: "tz12qeev" → "hotmart_tz12qeev"
 */
function planCodeToSlug(hotmartCode: string): string {
  return `hotmart_${hotmartCode}`;
}

import prisma from "../prisma";

/**
 * Sincroniza planos da Hotmart API → tabela Plan local.
 *
 * Regras:
 * - Planos existentes (por hotmartPlanCode) têm nome/preço/periodicidade atualizados
 * - Planos novos são criados com quotas default
 * - Quotas existentes NÃO são sobrescritas (o admin ajusta localmente)
 * - Retorna array de planos locais (criados ou atualizados)
 */
export async function syncPlansFromHotmart(productUcode: string): Promise<{
  created: number;
  updated: number;
  deactivated: number;
  plans: { id: string; code: string; name: string; hotmartPlanCode: string }[];
}> {
  const hotmartPlans = await listPlansForProduct(productUcode);

  let created = 0;
  let updated = 0;
  const results: {
    id: string;
    code: string;
    name: string;
    hotmartPlanCode: string;
  }[] = [];

  // Deactivate local plans whose hotmartPlanCode no longer exists in Hotmart
  const activeCodes = new Set(hotmartPlans.map((hp) => hp.code));
  const deactivatedResult = await prisma.plan.updateMany({
    where: {
      hotmartPlanCode: { not: null },
      isActive: true,
      NOT: { hotmartPlanCode: { in: Array.from(activeCodes) } },
    },
    data: { isActive: false },
  });
  const deactivated = deactivatedResult.count;
  if (deactivated > 0) {
    log.info("Deactivated plans no longer in Hotmart", { deactivated });
  }

  for (const hp of hotmartPlans) {
    const existing = await prisma.plan.findUnique({
      where: { hotmartPlanCode: hp.code },
    });

    if (existing) {
      // Atualiza metadata da Hotmart (nunca toca em quotas ou campos locais do admin)
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          name: hp.name,
          priceAmount: Math.round(hp.price.value * 100),
          currency: hp.price.currency_code,
          periodicity: mapPeriodicity(hp.periodicity),
          displayPrice: formatDisplayPrice(
            hp.price.value * 100,
            hp.price.currency_code,
          ),
          description: hp.description ?? existing.description,
          isActive: true, // reactivate if it was previously deactivated
        },
      });
      updated++;
      results.push({
        id: existing.id,
        code: existing.code,
        name: hp.name,
        hotmartPlanCode: hp.code,
      });
      log.info("Hotmart plan updated locally", {
        planCode: hp.code,
        planId: existing.id,
      });
    } else {
      // Cria novo plano local com dados Hotmart + quotas default
      const slug = planCodeToSlug(hp.code);
      const plan = await prisma.plan.create({
        data: {
          code: slug,
          name: hp.name,
          description: hp.description,
          displayPrice: formatDisplayPrice(
            hp.price.value * 100,
            hp.price.currency_code,
          ),
          priceAmount: Math.round(hp.price.value * 100),
          currency: hp.price.currency_code,
          periodicity: mapPeriodicity(hp.periodicity),
          hotmartPlanCode: hp.code,
          isActive: true,
          sortOrder: 0,
          features: [],
          // Quotas default (admin ajusta depois)
          transcriptsPerMonth: 40,
          scriptsPerMonth: 70,
          insightTokensMonthlyMax: 50000,
          scriptTokensMonthlyMax: 20000,
          insightMaxOutputTokens: 800,
          scriptMaxOutputTokens: 1500,
        },
      });
      created++;
      results.push({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        hotmartPlanCode: hp.code,
      });
      log.info("Hotmart plan created locally", {
        planCode: hp.code,
        planId: plan.id,
      });
    }
  }

  log.info("Hotmart plan sync complete", {
    created,
    updated,
    deactivated,
    total: hotmartPlans.length,
  });
  return { created, updated, deactivated, plans: results };
}

/**
 * Busca ou cria automaticamente um plano local pelo planCode da Hotmart.
 *
 * Usado pelo processador de webhook para auto-provisionar:
 * 1. Busca Plan com hotmartPlanCode = planCode
 * 2. Se não existe, tenta sincronizar da API e busca de novo
 * 3. Se ainda não existe, retorna null (fallback do caller)
 *
 * O productId numérico do webhook é necessário para descobrir o product ucode.
 */
export async function resolveOrSyncPlan(
  planCode: string,
  productId?: string,
): Promise<{ id: string } | null> {
  try {
    // 1. Busca plano existente
    const existing = await prisma.plan.findUnique({
      where: { hotmartPlanCode: planCode },
      select: { id: true },
    });
    if (existing) return existing;

    // 2. Tenta sincronizar da Hotmart API
    if (productId) {
      const numericId = parseInt(productId, 10);
      if (!isNaN(numericId)) {
        const product = await getProductByNumericId(numericId);
        if (product) {
          await syncPlansFromHotmart(product.ucode);

          // Busca de novo após sync
          const synced = await prisma.plan.findUnique({
            where: { hotmartPlanCode: planCode },
            select: { id: true },
          });
          if (synced) return synced;
        }
      }
    }
  } catch (err) {
    log.warn("Failed to resolve or sync Hotmart plan for provisioning", {
      planCode,
      productId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDisplayPrice(valueCents: number, currency: string): string {
  const value = valueCents / 100;
  if (currency === "BRL") {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
  if (currency === "USD") {
    return `$ ${value.toFixed(2)}`;
  }
  return `${currency} ${value.toFixed(2)}`;
}
