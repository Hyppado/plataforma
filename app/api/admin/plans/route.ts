/**
 * app/api/admin/plans/route.ts
 *
 * CRUD de planos via admin.
 * GET    — lista todos os planos
 * POST   — cria um plano novo
 * PUT    — atualiza plano existente (requer id no body)
 * DELETE — desativa plano (soft delete, requer id no body)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const plans = await prisma.plan.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const {
    code,
    name,
    description,
    displayPrice,
    priceAmount,
    currency,
    periodicity,
    highlight,
    badge,
    sortOrder,
    features,
    transcriptsPerMonth,
    scriptsPerMonth,
    insightTokensMonthlyMax,
    scriptTokensMonthlyMax,
    insightMaxOutputTokens,
    scriptMaxOutputTokens,
    hotmartProductId,
    hotmartPlanCode,
    hotmartOfferCode,
  } = body;

  if (!code || !name || priceAmount === undefined || !periodicity) {
    return NextResponse.json(
      { error: "code, name, priceAmount e periodicity são obrigatórios" },
      { status: 400 },
    );
  }

  try {
    const plan = await prisma.plan.create({
      data: {
        code,
        name,
        description,
        displayPrice,
        priceAmount,
        currency: currency ?? "BRL",
        periodicity,
        highlight: highlight ?? false,
        badge,
        sortOrder: sortOrder ?? 0,
        features: features ?? [],
        transcriptsPerMonth: transcriptsPerMonth ?? 40,
        scriptsPerMonth: scriptsPerMonth ?? 70,
        insightTokensMonthlyMax: insightTokensMonthlyMax ?? 50000,
        scriptTokensMonthlyMax: scriptTokensMonthlyMax ?? 20000,
        insightMaxOutputTokens: insightMaxOutputTokens ?? 800,
        scriptMaxOutputTokens: scriptMaxOutputTokens ?? 1500,
        hotmartProductId,
        hotmartPlanCode,
        hotmartOfferCode,
      },
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: `Plano com code "${code}" já existe` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  try {
    const plan = await prisma.plan.update({
      where: { id },
      data,
    });
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json(
      { error: "Plano não encontrado" },
      { status: 404 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  await prisma.plan.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ status: "deactivated" });
}
