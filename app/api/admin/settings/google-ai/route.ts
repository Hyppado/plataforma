/**
 * app/api/admin/settings/google-ai/route.ts
 *
 * Admin API for Google AI Studio configuration.
 * GET  — returns masked status (configured: true/false)
 * POST — saves/updates the Google AI Studio API key (encrypted)
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

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const [configured, model] = await Promise.all([
      hasSecretSetting(SETTING_KEYS.GOOGLE_AI_API_KEY),
      getSetting(SETTING_KEYS.GOOGLE_AI_MODEL),
    ]);
    return NextResponse.json({ configured, model: model ?? "" });
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

  const body = (await req.json()) as { apiKey?: unknown; model?: unknown };
  const { apiKey, model } = body;

  if (apiKey !== undefined && (typeof apiKey !== "string" || apiKey.trim().length < 10)) {
    return NextResponse.json({ error: "API key inválida" }, { status: 400 });
  }

  try {
    const ops: Promise<unknown>[] = [];

    if (typeof apiKey === "string" && apiKey.trim()) {
      ops.push(
        upsertSecretSetting(SETTING_KEYS.GOOGLE_AI_API_KEY, apiKey.trim(), {
          label: "Google AI Studio API Key",
          group: "google_ai",
        }),
      );
    }

    if (typeof model === "string") {
      ops.push(
        upsertSetting(SETTING_KEYS.GOOGLE_AI_MODEL, model.trim(), {
          label: "Google AI Model ID",
          group: "google_ai",
        }),
      );
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
