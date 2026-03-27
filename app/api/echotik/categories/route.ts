import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Category } from "@/lib/categories";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/echotik/categories");

export const dynamic = "force-dynamic";

/**
 * API Route: GET /api/echotik/categories
 *
 * Retorna categorias do TikTok Shop direto do banco de dados.
 * Os dados são sincronizados pelo cron (/api/cron/echotik) via EchoTik L1/L2/L3.
 *
 * Query params opcionais:
 *   ?level=1       — filtrar por nível específico (1, 2 ou 3)
 *   ?maxLevel=2    — retornar até um nível máximo (padrão: 2)
 */

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const url = new URL(request.url);
    const levelParam = url.searchParams.get("level");
    const maxLevelParam = url.searchParams.get("maxLevel");

    let where: { level?: number | { lte: number } } = {};
    if (levelParam) {
      where = { level: Number(levelParam) };
    } else {
      // por padrão retornar L1 + L2 (L3 tem 2348 itens — muito granular para o filtro)
      const maxLevel = maxLevelParam ? Number(maxLevelParam) : 2;
      where = { level: { lte: maxLevel } };
    }

    const dbCategories = await prisma.echotikCategory.findMany({
      where,
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });

    // Mapear para o formato Category que o frontend espera
    const categories: Category[] = [
      // "Todas" sempre primeiro
      { id: "all", name: "Todas as Categorias", level: 0, slug: "all" },
      ...dbCategories.map((c) => ({
        id: c.externalId,
        name: c.name,
        parentId: c.parentExternalId,
        level: c.level,
        slug: c.slug ?? undefined,
      })),
    ];

    return NextResponse.json({
      categories,
      source: "database" as const,
      count: dbCategories.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        categories: [
          { id: "all", name: "Todas as Categorias", level: 0, slug: "all" },
        ],
        source: "error" as const,
        count: 0,
        timestamp: new Date().toISOString(),
        error: "Falha ao buscar categorias do banco",
      },
      { status: 500 },
    );
  }
}
