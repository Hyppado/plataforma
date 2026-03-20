/**
 * app/api/admin/sync-hotmart/route.ts
 *
 * Rota protegida para disparar sync de planos e cupons da Hotmart manualmente.
 * Método: POST /api/admin/sync-hotmart
 * Header: Authorization: Bearer <ADMIN_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAll } from "@/lib/hotmart/sync";
import { getSettingOrEnv, SETTING_KEYS } from "@/lib/settings";

function isAuthorized(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  // Se ADMIN_SECRET não estiver configurado, rejeita em produção
  if (!adminSecret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${adminSecret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productId = await getSettingOrEnv(
    SETTING_KEYS.HOTMART_PRODUCT_ID,
    "HOTMART_PRODUCT_ID",
  );

  if (!productId) {
    return NextResponse.json(
      { error: "Product ID não configurado. Configure em Admin → Settings." },
      { status: 400 },
    );
  }

  try {
    const { offers, coupons } = await syncAll(productId);

    return NextResponse.json({
      status: "ok",
      productId,
      offers: {
        upserted: offers.upserted,
        skipped: offers.skipped,
        total: offers.raw.length,
      },
      coupons: {
        upserted: coupons.upserted,
        deactivated: coupons.deactivated,
        total: coupons.raw.length,
      },
    });
  } catch (err) {
    console.error("[sync-hotmart] Erro:", err);
    return NextResponse.json(
      { error: "Sync falhou", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productId = await getSettingOrEnv(
    SETTING_KEYS.HOTMART_PRODUCT_ID,
    "HOTMART_PRODUCT_ID",
  );

  return NextResponse.json({
    status: productId ? "ready" : "not_configured",
    productId: productId || null,
    hint: productId
      ? "Envie POST para disparar o sync."
      : "Configure o Product ID em Admin → Settings.",
  });
}
