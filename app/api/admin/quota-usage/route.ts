import { NextResponse } from "next/server";
import type { QuotaUsage } from "@/lib/types/admin";

/**
 * GET /api/admin/quota-usage
 * Retorna uso de quotas atual.
 * TODO: implementar tracking real de uso por período quando quota enforcement existir.
 */
export async function GET() {
  // Tracking de uso ainda não implementado — retorna valores nulos
  // Quando implementado, deve consultar uma tabela de usage por período
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const usage: QuotaUsage = {
    transcriptsUsed: null,
    scriptsUsed: null,
    insightTokensUsed: null,
    scriptTokensUsed: null,
    periodStart: startOfMonth.toISOString(),
    periodEnd: endOfMonth.toISOString(),
    lastUpdatedAt: null,
  };

  return NextResponse.json(usage);
}
