/**
 * GET /api/regions
 *
 * Retorna as regiões/países ativos no banco de dados.
 * Usado pelo AppTopHeader para popular o seletor de país.
 * Rota pública — não requer autenticação.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.region.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, name: true },
    });

    const regions = rows.map((r) => r.code);

    return NextResponse.json({ regions }, { status: 200 });
  } catch (err) {
    console.error("[api/regions] Erro ao buscar regiões:", err);
    // Fallback: devolve ao menos BR para não quebrar o header
    return NextResponse.json({ regions: ["BR"] }, { status: 200 });
  }
}
