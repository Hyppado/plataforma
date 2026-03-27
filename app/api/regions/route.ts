/**
 * GET /api/regions
 *
 * Retorna as regiões/países ativos no banco de dados.
 * Usado pelo AppTopHeader para popular o seletor de país.
 * Requer autenticação — disponível apenas para usuários com sessão ativa.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/regions");

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const rows = await prisma.region.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, name: true },
    });

    const regions = rows.map((r) => r.code);

    return NextResponse.json({ regions }, { status: 200 });
  } catch (err) {
    log.error("Failed to fetch regions, returning fallback", { error: err instanceof Error ? err.message : String(err) });
    // Fallback: devolve ao menos BR para não quebrar o header
    return NextResponse.json({ regions: ["BR"] }, { status: 200 });
  }
}
