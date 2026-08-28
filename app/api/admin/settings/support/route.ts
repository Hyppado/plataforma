/**
 * GET  /api/admin/settings/support — lê e-mail e WhatsApp do suporte
 * POST /api/admin/settings/support — salva os dois
 *
 * Eram um campo só, preenchido como "email | whatsapp - (74) 99901-0441".
 * Dava para exibir, mas o `mailto:` levava a string inteira e não havia como
 * oferecer link de conversa. Agora são dois campos independentes.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getSetting, upsertSetting, SETTING_KEYS } from "@/lib/settings";
import {
  SUPPORT_EMAIL_DEFAULT,
  toWhatsAppNumber,
  formatWhatsApp,
} from "@/lib/support-contact";

export const dynamic = "force-dynamic";

/** Extrai só o e-mail de um valor legado que misturava os dois contatos. */
function apenasEmail(valor: string): string {
  const m = valor.match(/[^\s|,;]+@[^\s|,;]+/);
  return (m?.[0] ?? valor).trim().toLowerCase();
}

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const [emailRaw, whatsapp] = await Promise.all([
      getSetting(SETTING_KEYS.SUPPORT_EMAIL),
      getSetting(SETTING_KEYS.SUPPORT_WHATSAPP),
    ]);

    const email = emailRaw ? apenasEmail(emailRaw) : SUPPORT_EMAIL_DEFAULT;

    // Valor legado com o WhatsApp embutido: sugere o número já separado, para
    // o admin só conferir e salvar em vez de redigitar.
    const whatsappSugerido =
      whatsapp ??
      (emailRaw && emailRaw !== email
        ? (formatWhatsApp(emailRaw.replace(email, "")) ?? "")
        : "");

    return NextResponse.json({ email, whatsapp: whatsappSugerido });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const whatsapp =
      typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    // Número que não vira link é pior do que campo vazio: o botão apareceria
    // levando a uma conversa inexistente.
    if (whatsapp && !toWhatsAppNumber(whatsapp)) {
      return NextResponse.json(
        { error: "Número de WhatsApp inválido — informe com DDD" },
        { status: 400 },
      );
    }

    await Promise.all([
      upsertSetting(SETTING_KEYS.SUPPORT_EMAIL, email.toLowerCase(), {
        label: "E-mail de suporte",
        group: "general",
        type: "text",
      }),
      upsertSetting(SETTING_KEYS.SUPPORT_WHATSAPP, whatsapp, {
        label: "WhatsApp de suporte",
        group: "general",
        type: "text",
      }),
    ]);

    return NextResponse.json({ email: email.toLowerCase(), whatsapp });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
