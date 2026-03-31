/**
 * app/api/admin/import-subscribers/route.ts
 *
 * Importa assinantes existentes do Hotmart para o banco local.
 * Útil para popular a base quando os webhooks não estavam configurados.
 *
 * POST /api/admin/import-subscribers
 *
 * Autenticação: sessão NextAuth com role ADMIN (via requireAdmin).
 */

import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importSubscribersFromHotmart } from "@/lib/hotmart/import-subscribers";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/admin/import-subscribers");

export async function POST() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const productIdSetting = await prisma.setting.findUnique({
    where: { key: "hotmart.product_id" },
  });
  const productId = productIdSetting?.value?.trim();

  if (!productId) {
    return NextResponse.json(
      {
        error:
          "hotmart.product_id não configurado. Defina na página de configuração.",
      },
      { status: 422 },
    );
  }

  try {
    const result = await importSubscribersFromHotmart(productId, log);
    return NextResponse.json({
      success: true,
      message: `Importação concluída: ${result.imported} importados, ${result.skipped} ignorados, ${result.errors} erros.`,
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Import failed", { error: message });
    return NextResponse.json(
      {
        success: false,
        error: "Importação falhou. Verifique as credenciais Hotmart.",
      },
      { status: 500 },
    );
  }
}
