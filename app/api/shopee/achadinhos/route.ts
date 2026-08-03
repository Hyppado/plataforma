/**
 * app/api/shopee/achadinhos/route.ts
 *
 * GET /api/shopee/achadinhos
 * Retorna a lista de produtos "Achadinhos Shopee" com suporte a paginação,
 * ordenação e filtro por categoria.
 *
 * Query params:
 *   - page: número da página (default: 1)
 *   - pageSize: itens por página (default: 24)
 *   - sort: campo de ordenação (default: "saleCount" — Mais Vendidos)
 *   - order: "asc" | "desc" (default: "desc")
 *   - category: filtro por categoria (opcional)
 *   - search: termo de busca no nome do produto (opcional)
 *
 * Protegido por NextAuth.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import type { Prisma, ShopeeAchadinhoProduct } from "@prisma/client";

export const dynamic = "force-dynamic";

// Mapeamento de campos de ordenação válidos para evitar injeção
const SORT_FIELDS: Record<string, string> = {
  createdAt: "createdAt",
  price: "price",
  saleCount: "saleCount",
  productName: "productName",
  updatedAt: "updatedAt",
};

/**
 * Converte QUALQUER registro Prisma para JSON serializável.
 *
 * O NextResponse.json não consegue serializar BigInt nativamente
 * (erro: "Do not know how to serialize a BigInt"). Esta função percorre
 * TODOS os campos do registro e converte qualquer valor `bigint`
 * (ex: views, id, viewCount, playCount) para `Number` de forma defensiva,
 * garantindo que futuros campos BigInt também sejam serializados sem quebrar.
 */
function serializeAchadinho(achadinho: ShopeeAchadinhoProduct) {
  const serialized: Record<string, unknown> = { ...achadinho };

  for (const key of Object.keys(serialized)) {
    const value = serialized[key];
    if (typeof value === "bigint") {
      serialized[key] = Number(value);
    }
  }

  return serialized as ShopeeAchadinhoProduct & { [K in keyof ShopeeAchadinhoProduct]: ShopeeAchadinhoProduct[K] extends bigint ? number : ShopeeAchadinhoProduct[K] };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "24", 10)));
    // ORDENAÇÃO FINAL: por padrão, os achadinhos são ordenados pela
    // quantidade de vendas em ordem decrescente (os de maior sucesso no topo).
    // O usuário pode sobrescrever com ?sort=createdAt (Recentes) etc.
    const sortRaw = url.searchParams.get("sort") || "saleCount";
    const orderRaw = url.searchParams.get("order") || "desc";
    const category = url.searchParams.get("category") || undefined;
    const search = url.searchParams.get("search") || undefined;

    // Valida campos de ordenação
    const sortField = SORT_FIELDS[sortRaw] || "saleCount";
    const order: "asc" | "desc" = orderRaw === "asc" ? "asc" : "desc";

    // Monta o where dinâmico
    const where: Prisma.ShopeeAchadinhoProductWhereInput = {};
    if (category) where.category = category;
    if (search) where.productName = { contains: search, mode: "insensitive" };

    // Por padrão, filtra registros com FALHA para o usuário final.
    // Para debug completo, use `?status=all`.
    const statusFilter = url.searchParams.get("status");
    if (statusFilter !== "all") {
      where.status = { not: "FAILED" };
    }

    // Executa a query com paginação
    const [achadinhos, total] = await Promise.all([
      prisma.shopeeAchadinhoProduct.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.shopeeAchadinhoProduct.count({ where }),
    ]);

    // Retorna categorias disponíveis para o filtro
    const categorias = await prisma.shopeeAchadinhoProduct.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    });

    return NextResponse.json({
      ok: true,
      achadinhos: achadinhos.map(serializeAchadinho),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      categorias: categorias.map((c) => c.category).filter(Boolean) as string[],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}