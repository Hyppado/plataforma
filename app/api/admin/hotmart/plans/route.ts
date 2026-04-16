/**
 * app/api/admin/hotmart/plans/route.ts
 *
 * GET  — lista planos da Hotmart API para o product configurado
 * POST — sincroniza planos da Hotmart → tabela Plan local
 *
 * Necessita que o Hotmart Product ID esteja configurado (via /api/admin/hotmart/product).
 */

import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import {
  getProductByNumericId,
  listPlansForProduct,
  syncPlansFromHotmart,
} from "@/lib/hotmart/plans";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const productIdStr = await getSetting(SETTING_KEYS.HOTMART_PRODUCT_ID);
  if (!productIdStr) {
    return NextResponse.json(
      { error: "Hotmart Product ID não configurado" },
      { status: 400 },
    );
  }

  const numericId = parseInt(productIdStr, 10);

  try {
    // Busca product para obter o ucode
    const product = await getProductByNumericId(numericId);
    if (!product) {
      return NextResponse.json(
        { error: `Produto ${productIdStr} não encontrado na Hotmart` },
        { status: 404 },
      );
    }

    // Busca planos via API
    const hotmartPlans = await listPlansForProduct(product.ucode);

    return NextResponse.json({
      product: {
        id: product.id,
        ucode: product.ucode,
        name: product.name,
        status: product.status,
      },
      plans: hotmartPlans,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao buscar planos na Hotmart: ${message}` },
      { status: 502 },
    );
  }
}

export async function POST() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const productIdStr = await getSetting(SETTING_KEYS.HOTMART_PRODUCT_ID);
  if (!productIdStr) {
    return NextResponse.json(
      { error: "Hotmart Product ID não configurado" },
      { status: 400 },
    );
  }

  const numericId = parseInt(productIdStr, 10);

  try {
    const product = await getProductByNumericId(numericId);
    if (!product) {
      return NextResponse.json(
        { error: `Produto ${productIdStr} não encontrado na Hotmart` },
        { status: 404 },
      );
    }

    const result = await syncPlansFromHotmart(product.ucode);

    return NextResponse.json({
      created: result.created,
      updated: result.updated,
      deactivated: result.deactivated,
      plans: result.plans,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao sincronizar planos: ${message}` },
      { status: 502 },
    );
  }
}
