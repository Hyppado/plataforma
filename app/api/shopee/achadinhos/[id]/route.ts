/**
 * app/api/shopee/achadinhos/[id]/route.ts
 *
 * Endpoint para operações em um produto achadinho específico.
 * Atualmente suporta:
 *
 * PATCH /api/shopee/achadinhos/[id]
 *   - Atualiza o link de afiliado de um produto achadinho.
 *   - Apenas administradores podem usar este endpoint.
 *   - Salva o link original em originalAffLink na primeira alteração.
 *   - Body: { affiliateLink: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import type { ShopeeAchadinhoProduct } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Valida se uma string é uma URL HTTP/HTTPS válida.
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

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

/**
 * PATCH /api/shopee/achadinhos/[id]
 *
 * Permite que um administrador sobrescreva o link de afiliado de um produto
 * achadinho. O link original é preservado em originalAffLink para referência.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  // Apenas administradores podem editar links de afiliado
  if (auth.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Apenas administradores podem editar links de afiliado" },
      { status: 403 },
    );
  }

  try {
    const { id } = params;
    const body = await req.json();
    const { affiliateLink } = body;

    if (!affiliateLink || typeof affiliateLink !== "string") {
      return NextResponse.json(
        { ok: false, error: "Link de afiliado é obrigatório" },
        { status: 400 },
      );
    }

    // Valida se é uma URL HTTP/HTTPS válida
    if (!isValidUrl(affiliateLink)) {
      return NextResponse.json(
        { ok: false, error: "Link de afiliado inválido. Deve ser uma URL HTTP/HTTPS válida." },
        { status: 400 },
      );
    }

    // Busca o registro atual para preservar o link original
    const current = await prisma.shopeeAchadinhoProduct.findUnique({
      where: { id },
    });

    if (!current) {
      return NextResponse.json(
        { ok: false, error: "Produto achadinho não encontrado" },
        { status: 404 },
      );
    }

    // Se ainda não temos um link original salvo, guarda o atual antes de sobrescrever
    const originalAffLink = current.originalAffLink || current.affiliateLink || null;

    // Atualiza o link de afiliado
    const updated = await prisma.shopeeAchadinhoProduct.update({
      where: { id },
      data: {
        affiliateLink,
        originalAffLink,
      },
    });

    return NextResponse.json({
      ok: true,
      achadinho: serializeAchadinho(updated),
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