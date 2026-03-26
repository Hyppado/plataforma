/**
 * app/api/admin/settings/route.ts
 *
 * CRUD de configurações dinâmicas.
 * GET  — lista todas as settings
 * POST — cria/atualiza um setting { key, value, label?, group?, type? }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getAllSettings, upsertSetting } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const settings = await getAllSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { key, value, label, group, type } = body;

  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "key e value são obrigatórios" },
      { status: 400 },
    );
  }

  const setting = await upsertSetting(key, String(value), {
    label,
    group,
    type,
  });
  return NextResponse.json({ setting });
}
