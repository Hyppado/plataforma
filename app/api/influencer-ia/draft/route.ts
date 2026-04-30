/**
 * app/api/influencer-ia/draft/route.ts
 *
 * GET  /api/influencer-ia/draft  — load the current user's wizard draft
 * PUT  /api/influencer-ia/draft  — upsert (save) the draft
 * DELETE /api/influencer-ia/draft — delete (reset) the draft
 *
 * The draft stores arbitrary wizard state as JSON so the schema stays thin
 * and wizard fields can evolve without new migrations.
 *
 * Response (GET):  { draft: <json> | null }
 * Response (PUT):  { ok: true }
 * Response (DELETE): { ok: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/influencer-ia/draft");

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const row = await prisma.influencerIADraft.findUnique({
      where: { userId: auth.userId },
      select: { data: true },
    });
    return NextResponse.json({ draft: row?.data ?? null });
  } catch (err) {
    log.error("Failed to load draft", {
      userId: auth.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  try {
    await prisma.influencerIADraft.upsert({
      where: { userId: auth.userId },
      update: { data: data as never },
      create: { userId: auth.userId, data: data as never },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("Failed to save draft", {
      userId: auth.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    await prisma.influencerIADraft.deleteMany({
      where: { userId: auth.userId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("Failed to delete draft", {
      userId: auth.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
