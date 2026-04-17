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

  try {
    const settings = await getAllSettings();
    const masked = settings.map((s) => ({
      ...s,
      value: s.type === "secret" ? "••••••••" : s.value,
    }));
    return NextResponse.json({ settings: masked });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

  try {
    const setting = await upsertSetting(key, String(value), {
      label,
      group,
      type,
    });
    return NextResponse.json({ setting });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
