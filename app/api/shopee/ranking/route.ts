/**
 * app/api/shopee/ranking/route.ts
 *
 * GET /api/shopee/ranking
 * Returns Shopee product ranking trends from database.
 * Protected by NextAuth.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import { buildShopeeCategoryTree } from "@/lib/shopee/shopee-categories";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const products = await prisma.shopeeProductTrend.findMany({
      orderBy: { rankPosition: "asc" },
    });

    // A árvore vem da dimensão oficial, não dos produtos carregados.
    // Derivá-la do conjunto exibido limitava o dropdown ao que por acaso
    // estivesse nos 100 primeiros — quatro categorias, das 27 que existem.
    // Restringimos às que têm produto para não oferecer filtro que dá vazio.
    const comProdutos = new Set(
      products.map((p) => p.categoryId).filter((id): id is string => !!id),
    );
    const categories = await buildShopeeCategoryTree(comProdutos);

    return NextResponse.json({
      ok: true,
      products,
      categories,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
