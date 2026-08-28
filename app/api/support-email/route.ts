/**
 * GET /api/support-email
 *
 * Contatos de suporte para usuários autenticados (/dashboard/suporte).
 * Mesma forma da rota pública — ver app/api/public/support-email.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import {
  extrairEmail,
  whatsAppLink,
  formatWhatsApp,
} from "@/lib/support-contact";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!isAuthed(auth)) return auth;

    const [email, whatsapp] = await Promise.all([
      getSetting(SETTING_KEYS.SUPPORT_EMAIL),
      getSetting(SETTING_KEYS.SUPPORT_WHATSAPP),
    ]);

    return NextResponse.json({
      email: extrairEmail(email),
      // Enquanto o admin não separar, tenta o número que ficou no campo antigo.
      whatsapp: formatWhatsApp(whatsapp ?? email),
      whatsappUrl: whatsAppLink(whatsapp ?? email),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
