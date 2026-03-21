import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Category } from "@/lib/categories";

/**
 * API Route: GET /api/echotik/categories
 *
 * Retorna categorias do TikTok Shop direto do banco de dados.
 * Os dados são sincronizados pelo cron (/api/cron/echotik).
 *
 * Query params opcionais:
 *   ?level=1  — filtrar por nível de hierarquia
 */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const level = url.searchParams.get("level");

    const where = level ? { level: Number(level) } : {};

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
    console.error("[categories] Erro na rota:", error);

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
