/**
 * GET /api/maintenance-banner
 *
 * Estado da faixa de aviso exibida no topo da plataforma.
 *
 * Aberta a qualquer usuário autenticado, não só admin: quem precisa ver o
 * aviso é justamente quem está usando o produto.
 *
 * Quando o aviso está desligado, devolve `message` vazia — a mensagem
 * configurada não vaza para quem não deveria vê-la.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import {
  getSetting,
  SETTING_KEYS,
  MAINTENANCE_BANNER_DEFAULT_MESSAGE,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const [enabledRaw, message] = await Promise.all([
      getSetting(SETTING_KEYS.MAINTENANCE_BANNER_ENABLED),
      getSetting(SETTING_KEYS.MAINTENANCE_BANNER_MESSAGE),
    ]);

    const enabled = enabledRaw === "true";

    return NextResponse.json({
      enabled,
      message: enabled
        ? (message?.trim() || MAINTENANCE_BANNER_DEFAULT_MESSAGE)
        : "",
    });
  } catch {
    // Falha ao ler a configuração não pode derrubar a plataforma: sem
    // resposta útil, o aviso simplesmente não aparece.
    return NextResponse.json({ enabled: false, message: "" });
  }
}
