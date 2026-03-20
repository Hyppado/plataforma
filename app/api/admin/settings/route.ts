/**
 * app/api/admin/settings/route.ts
 *
 * CRUD de configurações dinâmicas.
 * GET  — lista todas as settings
 * POST — cria/atualiza um setting { key, value, label?, group?, type? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, upsertSetting } from "@/lib/settings";

function isAuthorized(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${adminSecret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getAllSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
