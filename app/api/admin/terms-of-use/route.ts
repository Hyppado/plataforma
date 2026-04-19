/**
 * app/api/admin/terms-of-use/route.ts
 *
 * GET  — returns current terms of use text
 * POST — saves terms of use text
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getSetting, upsertSetting } from "@/lib/settings";

const SETTING_KEY = "terms_of_use";

export async function GET(_req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const text = await getSetting(SETTING_KEY);
    return NextResponse.json({ text: text ?? "" });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao carregar termos de uso" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const { text } = await req.json();
    if (typeof text !== "string") {
      return NextResponse.json(
        { error: "text é obrigatório" },
        { status: 400 },
      );
    }
    await upsertSetting(SETTING_KEY, text, {
      label: "Termos de Uso",
      group: "legal",
      type: "text",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao salvar termos de uso" },
      { status: 500 },
    );
  }
}
