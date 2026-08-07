/**
 * app/api/admin/settings/shopee/hashtags/route.ts
 *
 * GET /api/admin/settings/shopee/hashtags?q=<termo>
 *
 * Busca hashtags reais no EchoTik para o seletor do painel admin.
 *
 * POR QUE EXISTE
 * O campo de hashtag era um input numérico livre (ex: 1696392324325382).
 * Digitar um ID inexistente era possível e o efeito só apareceria horas
 * depois, como um cron que não encontra nenhum vídeo. Aqui o admin escolhe
 * de uma lista de hashtags que comprovadamente existem, com a contagem de
 * vídeos para decidir qual vale minerar.
 *
 * Somente ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { searchHashtags } from "@/lib/echotik/client";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("admin/shopee-hashtags");

/** Termo padrão quando o admin ainda não digitou nada. */
const DEFAULT_QUERY = "achadinhosshopee";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || DEFAULT_QUERY).trim();
  const region = url.searchParams.get("region") || "BR";

  if (q.length < 2) {
    return NextResponse.json({ ok: true, hashtags: [] });
  }

  try {
    const hashtags = await searchHashtags({ keyword: q, region, count: 20 });
    return NextResponse.json({ ok: true, hashtags });
  } catch (error) {
    // A EchoTik cai em risk control com alguma frequência. O seletor degrada
    // para lista vazia em vez de quebrar a tela de configuração inteira.
    log.warn("Busca de hashtags falhou", {
      q,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        hashtags: [],
        error: "Não foi possível consultar as hashtags na EchoTik agora.",
      },
      { status: 502 },
    );
  }
}
