/**
 * app/api/admin/sync-hotmart/route.ts
 *
 * Dispara a sincronização de planos (offers) e cupons do produto Hotmart
 * com o banco de dados.
 *
 * POST /api/admin/sync-hotmart
 *
 * Autenticação: sessão NextAuth com role ADMIN (via requireAdmin).
 * O segredo ADMIN_SECRET NÃO é utilizado aqui — a autorização é feita
 * exclusivamente por sessão, tanto no middleware quanto nesta rota.
 */

import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncAll } from "@/lib/hotmart/sync";

export async function POST() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  // Lê o productId da tabela de settings (mesma fonte usada pelo seed)
  const productIdSetting = await prisma.setting.findUnique({
    where: { key: "hotmart.product_id" },
  });
  const productId = productIdSetting?.value?.trim();

  if (!productId) {
    return NextResponse.json(
      {
        error:
          "hotmart.product_id não configurado. Defina em Settings ou via HOTMART_PRODUCT_ID no ambiente.",
      },
      { status: 422 },
    );
  }

  try {
    const result = await syncAll(productId);
    return NextResponse.json({
      success: true,
      message: "Sync concluído",
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-hotmart] Erro durante sync:", message);
    return NextResponse.json(
      {
        success: false,
        error: "Sync falhou. Verifique as credenciais Hotmart.",
      },
      { status: 500 },
    );
  }
}
