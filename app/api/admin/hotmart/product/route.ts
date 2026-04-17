/**
 * app/api/admin/hotmart/product/route.ts
 *
 * GET  — retorna o Hotmart product ID configurado
 * POST — salva o Hotmart product ID (numérico)
 *
 * O product ID é a âncora: a partir dele o sistema descobre o ucode
 * e consegue listar planos via Hotmart API.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getSetting, upsertSetting, SETTING_KEYS } from "@/lib/settings";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const productId = await getSetting(SETTING_KEYS.HOTMART_PRODUCT_ID);
    return NextResponse.json({ productId });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { productId } = body;

  if (!productId || typeof productId !== "string") {
    return NextResponse.json(
      { error: "productId é obrigatório (string numérica)" },
      { status: 400 },
    );
  }

  try {
    // Valida que é um número
    if (isNaN(parseInt(productId, 10))) {
      return NextResponse.json(
        { error: "productId deve ser numérico" },
        { status: 400 },
      );
    }

    await upsertSetting(SETTING_KEYS.HOTMART_PRODUCT_ID, productId, {
      label: "Hotmart Product ID",
      group: "hotmart",
      type: "text",
    });

    return NextResponse.json({ productId });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
