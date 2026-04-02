/**
 * app/api/admin/settings/openai/test/route.ts
 *
 * Tests the configured OpenAI API key by making a lightweight models.list call.
 * POST — validates key without consuming any Whisper credits.
 */

import { NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getSecretSetting, SETTING_KEYS } from "@/lib/settings";

export async function POST() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Chave OpenAI não configurada" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: `OpenAI retornou ${response.status}`,
          detail:
            response.status === 401
              ? "Chave inválida ou expirada"
              : body.slice(0, 200),
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, message: "Conexão com OpenAI OK" });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Erro ao testar conexão",
      },
      { status: 500 },
    );
  }
}
