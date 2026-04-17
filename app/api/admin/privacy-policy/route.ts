/**
 * app/api/admin/privacy-policy/route.ts
 *
 * GET  — returns current privacy policy text
 * POST — saves privacy policy text
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getSetting, upsertSetting } from "@/lib/settings";

const SETTING_KEY = "privacy_policy";

export async function GET(_req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const text = await getSetting(SETTING_KEY);
    return NextResponse.json({ text: text ?? "" });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao carregar política" },
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
      label: "Política de Privacidade",
      group: "legal",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao salvar política" },
      { status: 500 },
    );
  }
}
