/**
 * app/api/admin/settings/openai/route.ts
 *
 * Admin API for OpenAI configuration.
 * GET  — returns masked status (configured: true/false, model, language)
 * POST — saves/updates the OpenAI API key (encrypted) + model preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import {
  SETTING_KEYS,
  getSetting,
  upsertSetting,
  upsertSecretSetting,
  hasSecretSetting,
} from "@/lib/settings";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const [hasKey, model, language] = await Promise.all([
    hasSecretSetting(SETTING_KEYS.OPENAI_API_KEY),
    getSetting(SETTING_KEYS.OPENAI_WHISPER_MODEL),
    getSetting(SETTING_KEYS.OPENAI_WHISPER_LANGUAGE),
  ]);

  return NextResponse.json({
    configured: hasKey,
    model: model ?? "whisper-1",
    language: language ?? "auto",
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body = await req.json();
  const { apiKey, model, language } = body;

  if (apiKey !== undefined) {
    if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
      return NextResponse.json(
        { error: "API key inválida" },
        { status: 400 },
      );
    }
    await upsertSecretSetting(SETTING_KEYS.OPENAI_API_KEY, apiKey.trim(), {
      label: "OpenAI API Key",
      group: "openai",
    });
  }

  if (model !== undefined) {
    await upsertSetting(SETTING_KEYS.OPENAI_WHISPER_MODEL, String(model), {
      label: "Whisper Model",
      group: "openai",
      type: "text",
    });
  }

  if (language !== undefined) {
    await upsertSetting(
      SETTING_KEYS.OPENAI_WHISPER_LANGUAGE,
      String(language),
      {
        label: "Whisper Language",
        group: "openai",
        type: "text",
      },
    );
  }

  return NextResponse.json({ ok: true });
}
