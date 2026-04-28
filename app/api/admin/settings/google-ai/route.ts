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
  upsertSecretSetting,
  hasSecretSetting,
} from "@/lib/settings";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const configured = await hasSecretSetting(SETTING_KEYS.GOOGLE_AI_API_KEY);
    return NextResponse.json({ configured });
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

  const body = (await req.json()) as { apiKey?: unknown };
  const { apiKey } = body;

  if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return NextResponse.json({ error: "API key inválida" }, { status: 400 });
  }

  try {
    await upsertSecretSetting(
      SETTING_KEYS.GOOGLE_AI_API_KEY,
      apiKey.trim(),
      { label: "Google AI Studio API Key", group: "google_ai" },
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
