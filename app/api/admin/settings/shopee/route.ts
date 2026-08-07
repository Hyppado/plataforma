/**
 * app/api/admin/settings/shopee/route.ts
 *
 * Admin API for Shopee Affiliate configuration.
 * GET  — returns configured status + current settings
 * POST — saves/updates Shopee Affiliate credentials (encrypted) + settings
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import {
  SETTING_KEYS,
  upsertSetting,
  upsertSecretSetting,
  hasSecretSetting,
  getSetting,
} from "@/lib/settings";
import {
  ACHADINHOS_MAX_HASHTAGS,
  parseAchadinhoHashtags,
  serializeAchadinhoHashtags,
} from "@/lib/shopee/types";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const [
      hasAppId,
      hasSecret,
      rankingLimit,
      rankingFreq,
      achadinhosFreq,
      achadinhosCount,
      achadinhosHashtagId,
    ] = await Promise.all([
      hasSecretSetting(SETTING_KEYS.SHOPEE_AFFILIATE_APP_ID),
      hasSecretSetting(SETTING_KEYS.SHOPEE_AFFILIATE_API_SECRET),
      getSetting(SETTING_KEYS.SHOPEE_RANKING_LIMIT),
      getSetting(SETTING_KEYS.SHOPEE_RANKING_FREQUENCY),
      getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_FREQUENCY),
      getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_COUNT),
      getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_HASHTAG_ID),
    ]);

    return NextResponse.json({
      configured: hasAppId && hasSecret,
      rankingLimit: rankingLimit ?? "50",
      rankingFrequency: rankingFreq ?? "24",
      achadinhosFrequency: achadinhosFreq ?? "12",
      achadinhosCount: achadinhosCount ?? "50",
      // ID numérico da hashtag de achadinhos da Shopee (default padrão)
      achadinhosHashtagId: achadinhosHashtagId ?? "1696392324325382",
      // Seleção já resolvida em {id, name}. É isto que a tela usa para
      // desenhar os chips — sem depender de uma busca na EchoTik, que falha
      // com frequência e fazia a configuração parecer ter sumido.
      achadinhosHashtags: parseAchadinhoHashtags(
        achadinhosHashtagId ?? "1696392324325382",
      ),
    });
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

  const body = (await req.json()) as {
    affiliateAppId?: unknown;
    affiliateSecret?: unknown;
    rankingLimit?: unknown;
    rankingFrequency?: unknown;
    achadinhosFrequency?: unknown;
    achadinhosCount?: unknown;
    achadinhosHashtagId?: unknown;
  };

  try {
    const ops: Promise<unknown>[] = [];

    // Credenciais (secret — criptografado)
    if (typeof body.affiliateAppId === "string" && body.affiliateAppId.trim()) {
      ops.push(
        upsertSecretSetting(SETTING_KEYS.SHOPEE_AFFILIATE_APP_ID, body.affiliateAppId.trim(), {
          label: "Shopee Affiliate App ID",
          group: "shopee",
        }),
      );
    }
    if (typeof body.affiliateSecret === "string" && body.affiliateSecret.trim()) {
      ops.push(
        upsertSecretSetting(SETTING_KEYS.SHOPEE_AFFILIATE_API_SECRET, body.affiliateSecret.trim(), {
          label: "Shopee Affiliate API Secret",
          group: "shopee",
        }),
      );
    }

    // Parâmetros de sincronização
    if (typeof body.rankingLimit === "string" && body.rankingLimit.trim()) {
      ops.push(
        upsertSetting(SETTING_KEYS.SHOPEE_RANKING_LIMIT, body.rankingLimit.trim(), {
          label: "Limite do Ranking Shopee",
          group: "shopee",
          type: "number",
        }),
      );
    }
    if (typeof body.rankingFrequency === "string" && body.rankingFrequency.trim()) {
      ops.push(
        upsertSetting(SETTING_KEYS.SHOPEE_RANKING_FREQUENCY, body.rankingFrequency.trim(), {
          label: "Frequência do Ranking (horas)",
          group: "shopee",
          type: "number",
        }),
      );
    }
    if (typeof body.achadinhosFrequency === "string" && body.achadinhosFrequency.trim()) {
      ops.push(
        upsertSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_FREQUENCY, body.achadinhosFrequency.trim(), {
          label: "Frequência Achadinhos (horas)",
          group: "shopee",
          type: "number",
        }),
      );
    }
    if (typeof body.achadinhosCount === "string" && body.achadinhosCount.trim()) {
      const parsedCount = parseInt(body.achadinhosCount, 10);
      if (!isNaN(parsedCount)) {
        // Clamp 20-400 — quantidade dinâmica de vídeos a processar.
        // A paginação é feita em blocos de 20 com delay ~2s.
        const clampedCount = Math.min(400, Math.max(20, parsedCount));
        ops.push(
          upsertSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_COUNT, String(clampedCount), {
            label: "Quantidade de Achadinhos por Sincronização",
            group: "shopee",
            type: "number",
          }),
        );
      }
    }
    // Aceita uma ou várias hashtags, no formato "id|nome,id|nome". O nome é
    // gravado junto para que a tela desenhe a seleção salva sem consultar a
    // EchoTik. O formato antigo (só IDs) continua sendo aceito.
    if (typeof body.achadinhosHashtagId === "string" && body.achadinhosHashtagId.trim()) {
      const tags = parseAchadinhoHashtags(body.achadinhosHashtagId);

      // Teto derivado do orçamento de descoberta. Rejeitamos em vez de cortar
      // a lista em silêncio: o admin precisa saber que a escolha não coube.
      if (tags.length > ACHADINHOS_MAX_HASHTAGS) {
        return NextResponse.json(
          {
            error:
              `Máximo de ${ACHADINHOS_MAX_HASHTAGS} hashtags — ` +
              `${tags.length} foram enviadas. Acima disso a varredura não ` +
              `termina dentro do orçamento e as últimas hashtags nunca são lidas.`,
          },
          { status: 400 },
        );
      }

      if (tags.length > 0) {
        ops.push(
          upsertSetting(
            SETTING_KEYS.SHOPEE_ACHADINHOS_HASHTAG_ID,
            serializeAchadinhoHashtags(tags),
            {
              label: "Hashtags dos Achadinhos",
              group: "shopee",
              type: "text",
            },
          ),
        );
      }
    }

    await Promise.all(ops);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}