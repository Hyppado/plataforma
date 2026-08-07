/**
 * app/api/shopee/achadinhos/[id]/route.ts
 *
 * Endpoint para operações em um produto achadinho específico.
 * Atualmente suporta:
 *
 * PATCH /api/shopee/achadinhos/[id]
 *   - Atualiza o link do produto e/ou o status de revisão de um achadinho.
 *   - Apenas administradores podem usar este endpoint.
 *   - Salva o link original em originalAffLink na primeira alteração.
 *   - Body: { affiliateLink?: string, action?: "approve" | "reject" | "reset" }
 *
 * GATE DE APROVAÇÃO:
 *   O pipeline grava achadinhos como PENDING e eles NÃO aparecem para o
 *   usuário final. Um admin precisa aprovar (PENDING -> READY) para publicar.
 *   - approve -> READY     (publicado)
 *   - reject  -> REJECTED  (arquivado, nunca publicado)
 *   - reset   -> PENDING   (volta para a fila de revisão)
 *
 *   Registros FAILED/PROCESSING não são revisáveis: o pipeline ainda é dono
 *   deles e pode sobrescrever o status a qualquer momento.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import type {
  ShopeeAchadinhoProduct,
  ShopeeAchadinhoStatus,
} from "@prisma/client";

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

/** Ação de revisão -> status resultante */
const REVIEW_ACTIONS: Record<string, ShopeeAchadinhoStatus> = {
  approve: "READY",
  reject: "REJECTED",
  reset: "PENDING",
};

/**
 * Status que um admin pode revisar. PROCESSING e FAILED pertencem ao pipeline:
 * revisá-los criaria uma corrida em que o cron sobrescreve a decisão do admin.
 */
const REVIEWABLE_STATUSES: ShopeeAchadinhoStatus[] = [
  "PENDING",
  "READY",
  "REJECTED",
];

/**
 * PATCH /api/shopee/achadinhos/[id]
 *
 * Permite que um administrador sobrescreva o link do produto e/ou avance o
 * achadinho no gate de aprovação. O link original é preservado em
 * originalAffLink para referência.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  // Apenas administradores podem editar o link do produto ou revisar
  if (auth.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Apenas administradores podem editar ou revisar achadinhos" },
      { status: 403 },
    );
  }

  try {
    const { id } = params;
    const body = await req.json();
    const { affiliateLink, action } = body;

    const hasLink = affiliateLink !== undefined;
    const hasAction = action !== undefined;

    if (!hasLink && !hasAction) {
      return NextResponse.json(
        { ok: false, error: "Informe affiliateLink e/ou action" },
        { status: 400 },
      );
    }

    if (hasLink) {
      if (!affiliateLink || typeof affiliateLink !== "string") {
        return NextResponse.json(
          { ok: false, error: "Link do produto é obrigatório" },
          { status: 400 },
        );
      }

      // Valida se é uma URL HTTP/HTTPS válida
      if (!isValidUrl(affiliateLink)) {
        return NextResponse.json(
          { ok: false, error: "Link do produto inválido. Deve ser uma URL HTTP/HTTPS válida." },
          { status: 400 },
        );
      }
    }

    if (hasAction && !REVIEW_ACTIONS[action as string]) {
      return NextResponse.json(
        { ok: false, error: `Ação inválida: ${action}. Use approve, reject ou reset.` },
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

    const data: {
      affiliateLink?: string;
      originalAffLink?: string | null;
      status?: ShopeeAchadinhoStatus;
    } = {};

    if (hasLink) {
      // Se ainda não temos um link original salvo, guarda o atual antes de sobrescrever
      data.affiliateLink = affiliateLink;
      data.originalAffLink = current.originalAffLink || current.affiliateLink || null;
    }

    if (hasAction) {
      // Só revisa registros que o pipeline já soltou. PROCESSING/FAILED
      // continuam sob controle do cron.
      if (!REVIEWABLE_STATUSES.includes(current.status)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Achadinho com status ${current.status} não pode ser revisado`,
          },
          { status: 409 },
        );
      }
      data.status = REVIEW_ACTIONS[action as string];
    }

    const updated = await prisma.shopeeAchadinhoProduct.update({
      where: { id },
      data,
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