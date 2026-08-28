/**
 * GET /api/public/support-email
 *
 * Contatos de suporte para páginas públicas (login, landing, /suporte).
 * Sem autenticação — é informação de contato, feita para ser encontrada.
 *
 * O nome da rota é mantido por compatibilidade com quem já a consome; a
 * resposta agora traz e-mail e WhatsApp separados.
 */

import { NextResponse } from "next/server";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import {
  extrairEmail,
  whatsAppLink,
  formatWhatsApp,
} from "@/lib/support-contact";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [email, whatsapp] = await Promise.all([
      getSetting(SETTING_KEYS.SUPPORT_EMAIL),
      getSetting(SETTING_KEYS.SUPPORT_WHATSAPP),
    ]);

    return NextResponse.json({
      email: extrairEmail(email),
      // Enquanto o admin não separar, tenta o número que ficou no campo antigo.
      whatsapp: formatWhatsApp(whatsapp ?? email),
      // O link já sai pronto: montar wa.me no cliente duplicaria a
      // normalização do número em cada tela que oferece o botão.
      whatsappUrl: whatsAppLink(whatsapp ?? email),
    });
  } catch {
    return NextResponse.json({
      email: extrairEmail(null),
      whatsapp: "",
      whatsappUrl: null,
    });
  }
}
