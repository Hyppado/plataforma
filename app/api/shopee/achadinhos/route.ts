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
 *   - status: SOMENTE ADMIN — "all" ou um status específico
 *
 * VISIBILIDADE (gate de aprovação):
 * Usuários finais veem apenas achadinhos APROVADOS (status READY). O pipeline
 * grava tudo como PENDING; um admin precisa aprovar antes de publicar.
 * O parâmetro `status` é ignorado para não-admins — não é possível escapar do
 * filtro de visibilidade pela query string.
 *
 * Protegido por NextAuth.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import type {
  Prisma,
  ShopeeAchadinhoProduct,
  ShopeeAchadinhoStatus,
} from "@prisma/client";

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

/** Status que um admin pode inspecionar via ?status= */
const INSPECTABLE_STATUSES: ShopeeAchadinhoStatus[] = [
  "PENDING",
  "PROCESSING",
  "READY",
  "FAILED",
  "REJECTED",
];

/** Type guard — valida a query string contra o enum do banco. */
function isInspectableStatus(value: string): value is ShopeeAchadinhoStatus {
  return (INSPECTABLE_STATUSES as string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const isAdmin = auth.role === "ADMIN";

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

    // ── Gate de aprovação ────────────────────────────────────────────
    // Usuário final: apenas READY (aprovado por um admin).
    // Admin: pode inspecionar qualquer status via ?status=all|PENDING|...
    // Sem o parâmetro, o admin também vê apenas READY — o mesmo que o usuário.
    const statusParam = url.searchParams.get("status");
    const statusWhere: Prisma.ShopeeAchadinhoProductWhereInput = {};

    if (isAdmin && statusParam) {
      if (statusParam !== "all") {
        if (!isInspectableStatus(statusParam)) {
          return NextResponse.json(
            { ok: false, error: `Status inválido: ${statusParam}` },
            { status: 400 },
          );
        }
        statusWhere.status = statusParam;
      }
      // "all" — sem filtro de status
    } else {
      statusWhere.status = "READY";
      // Um card sem capa aparece como um retângulo vazio no feed. Isso
      // acontece quando o vídeo sai da hashtag e não há de onde rebaixar a
      // imagem. O admin continua vendo o registro (via ?status=) para poder
      // rejeitá-lo; o usuário final não vê um card quebrado.
      statusWhere.coverUrl = { not: null };
    }

    // Monta o where dinâmico
    const where: Prisma.ShopeeAchadinhoProductWhereInput = { ...statusWhere };
    if (category) where.category = category;
    if (search) where.productName = { contains: search, mode: "insensitive" };

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

    // Categorias disponíveis para o filtro — respeitam a mesma visibilidade,
    // senão o usuário veria categorias de achadinhos que não pode abrir.
    const categorias = await prisma.shopeeAchadinhoProduct.findMany({
      where: { ...statusWhere, category: { not: null } },
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