/**
 * lib/hotmart/sync.ts
 *
 * Sincroniza Planos (Offers) e Cupons do produto Hotmart com o banco de dados.
 * Chamado pelo seed e pela rota /api/admin/sync-hotmart.
 *
 * Endpoints Hotmart v2:
 *   GET /payment/api/v1/offers?productId={id}
 *   GET /payment/api/v1/coupons?productId={id}
 */

import { PrismaClient, PlanCode, PlanPeriod } from "@prisma/client";
import { hotmartRequest } from "./client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Tipos da API Hotmart
// ---------------------------------------------------------------------------

interface HotmartOffer {
  offer_code: string;
  offer_key?: string;
  name?: string;
  payment_mode?: string; // "SUBSCRIPTION" | "SINGLE"
  currency_code?: string;
  price?: { value: number };
  plan?: {
    id?: string;
    name?: string;
    recurrency_period?:
      | "MONTHLY"
      | "YEARLY"
      | "BIMONTHLY"
      | "QUARTERLY"
      | "SEMIANNUAL";
  };
}

interface HotmartOffersResponse {
  items?: HotmartOffer[];
}

interface HotmartCoupon {
  coupon_code?: string;
  code?: string; // alias
  name?: string;
  discount_type?: string; // "PERCENTAGE" | "FIXED_VALUE"
  discount_value?: number;
  currency_code?: string;
  max_uses?: number;
  num_uses?: number;
  start_date?: number; // epoch ms
  end_date?: number; // epoch ms
  status?: string; // "ACTIVE" | "INACTIVE"
  offer_key?: string;
}

interface HotmartCouponsResponse {
  items?: HotmartCoupon[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converte recurrency_period da Hotmart para nosso PlanPeriod */
function toPlanPeriod(period?: string): PlanPeriod {
  if (!period) return PlanPeriod.MONTHLY;
  if (period === "YEARLY") return PlanPeriod.ANNUAL;
  return PlanPeriod.MONTHLY;
}

/** Resolve qual PlanCode usar com base no período do plano */
function toPlanCode(period?: string): PlanCode {
  return toPlanPeriod(period) === PlanPeriod.ANNUAL
    ? PlanCode.PREMIUM_ANUAL
    : PlanCode.PRO_MENSAL;
}

// ---------------------------------------------------------------------------
// Sync de Ofertas / Planos
// ---------------------------------------------------------------------------

export interface SyncOffersResult {
  upserted: string[];
  skipped: string[];
  raw: HotmartOffer[];
}

export async function syncHotmartOffers(
  productId: string,
): Promise<SyncOffersResult> {
  console.log(`[sync] Buscando offers para produto ${productId}...`);

  let data: HotmartOffersResponse;
  try {
    data = await hotmartRequest<HotmartOffersResponse>(
      "/payment/api/v1/offers",
      { params: { productId } },
    );
  } catch (err) {
    console.error("[sync] Erro ao buscar offers:", err);
    return { upserted: [], skipped: [], raw: [] };
  }

  const offers = data?.items ?? [];
  console.log(`[sync] ${offers.length} offer(s) encontrados.`);

  const upserted: string[] = [];
  const skipped: string[] = [];

  for (const offer of offers) {
    if (offer.payment_mode !== "SUBSCRIPTION") {
      skipped.push(offer.offer_code ?? "unknown");
      continue;
    }

    const period = offer.plan?.recurrency_period;
    const planCode = toPlanCode(period);
    const planPeriod = toPlanPeriod(period);
    const priceAmount = offer.price?.value
      ? Math.round(offer.price.value * 100) // Hotmart retorna em reais
      : planCode === PlanCode.PRO_MENSAL
        ? 5990
        : 64700;

    await prisma.plan.upsert({
      where: { code: planCode },
      update: {
        hotmartProductId: productId,
        hotmartPlanCode: offer.plan?.name ?? undefined,
        hotmartOfferCode: offer.offer_code,
        priceAmount,
        updatedAt: new Date(),
      },
      create: {
        code: planCode,
        name: planCode === PlanCode.PRO_MENSAL ? "Pro" : "Premium",
        priceAmount,
        currency: offer.currency_code ?? "BRL",
        periodicity: planPeriod,
        isActive: true,
        hotmartProductId: productId,
        hotmartPlanCode: offer.plan?.name ?? undefined,
        hotmartOfferCode: offer.offer_code,
      },
    });

    upserted.push(offer.offer_code ?? planCode);
  }

  return { upserted, skipped, raw: offers };
}

// ---------------------------------------------------------------------------
// Sync de Cupons
// ---------------------------------------------------------------------------

export interface SyncCouponsResult {
  upserted: string[];
  deactivated: string[];
  raw: HotmartCoupon[];
}

export async function syncHotmartCoupons(
  productId: string,
): Promise<SyncCouponsResult> {
  console.log(`[sync] Buscando cupons para produto ${productId}...`);

  let data: HotmartCouponsResponse;
  try {
    data = await hotmartRequest<HotmartCouponsResponse>(
      "/payment/api/v1/coupons",
      { params: { productId } },
    );
  } catch (err) {
    console.error("[sync] Erro ao buscar cupons:", err);
    return { upserted: [], deactivated: [], raw: [] };
  }

  const coupons = data?.items ?? [];
  console.log(`[sync] ${coupons.length} cupom(ns) encontrado(s).`);

  const upserted: string[] = [];
  const deactivated: string[] = [];
  const activeCodes = new Set<string>();

  for (const c of coupons) {
    const code = c.coupon_code ?? c.code;
    if (!code) continue;

    const isActive = (c.status ?? "ACTIVE") === "ACTIVE";
    activeCodes.add(code);

    await prisma.coupon.upsert({
      where: { hotmartCouponCode: code },
      update: {
        name: c.name ?? undefined,
        discountType: c.discount_type ?? "PERCENTAGE",
        discountValue: c.discount_value ?? 0,
        maxUses: c.max_uses ?? null,
        usedCount: c.num_uses ?? 0,
        startsAt: c.start_date ? new Date(c.start_date) : null,
        expiresAt: c.end_date ? new Date(c.end_date) : null,
        isActive,
        offerCode: c.offer_key ?? null,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        hotmartCouponCode: code,
        productId,
        name: c.name ?? undefined,
        discountType: c.discount_type ?? "PERCENTAGE",
        discountValue: c.discount_value ?? 0,
        currency: c.currency_code ?? "BRL",
        maxUses: c.max_uses ?? null,
        usedCount: c.num_uses ?? 0,
        startsAt: c.start_date ? new Date(c.start_date) : null,
        expiresAt: c.end_date ? new Date(c.end_date) : null,
        isActive,
        offerCode: c.offer_key ?? null,
      },
    });

    upserted.push(code);
  }

  // Desativa cupons que não vieram na resposta (removidos na Hotmart)
  if (activeCodes.size > 0) {
    const removed = await prisma.coupon.updateMany({
      where: {
        productId,
        isActive: true,
        NOT: { hotmartCouponCode: { in: Array.from(activeCodes) } },
      },
      data: { isActive: false, updatedAt: new Date() },
    });
    if (removed.count > 0) {
      deactivated.push(`${removed.count} desativados`);
    }
  }

  return { upserted, deactivated, raw: coupons };
}

// ---------------------------------------------------------------------------
// Sync completo
// ---------------------------------------------------------------------------

export async function syncAll(productId: string) {
  const offers = await syncHotmartOffers(productId);
  const coupons = await syncHotmartCoupons(productId);
  return { offers, coupons };
}
