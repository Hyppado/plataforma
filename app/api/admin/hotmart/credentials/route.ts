/**
 * app/api/admin/hotmart/credentials/route.ts
 *
 * Gerencia as credenciais da Hotmart armazenadas no banco.
 *
 * GET  — retorna estado atual (secrets mascarados, client_id plaintext)
 * PUT  — salva credenciais (secrets encriptados)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import {
  getSetting,
  hasSecretSetting,
  upsertSetting,
  upsertSecretSetting,
  SETTING_KEYS,
} from "@/lib/settings";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const [clientId, hasClientSecret, hasBasicToken, hasWebhookSecret, sandbox] =
      await Promise.all([
        getSetting(SETTING_KEYS.HOTMART_CLIENT_ID),
        hasSecretSetting(SETTING_KEYS.HOTMART_CLIENT_SECRET),
        hasSecretSetting(SETTING_KEYS.HOTMART_BASIC_TOKEN),
        hasSecretSetting(SETTING_KEYS.HOTMART_WEBHOOK_SECRET),
        getSetting(SETTING_KEYS.HOTMART_SANDBOX),
      ]);

    return NextResponse.json({
      clientId: clientId ?? "",
      hasClientSecret,
      hasBasicToken,
      hasWebhookSecret,
      sandbox: sandbox === "true",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const body: {
    clientId?: string;
    clientSecret?: string;
    basicToken?: string;
    webhookSecret?: string;
    sandbox?: boolean;
  } = await req.json();

  try {
    const ops: Promise<unknown>[] = [];

    if (body.clientId !== undefined) {
      ops.push(
        upsertSetting(SETTING_KEYS.HOTMART_CLIENT_ID, body.clientId.trim(), {
          label: "Hotmart Client ID",
          group: "hotmart",
          type: "text",
        }),
      );
    }

    if (body.clientSecret !== undefined && body.clientSecret.trim()) {
      ops.push(
        upsertSecretSetting(
          SETTING_KEYS.HOTMART_CLIENT_SECRET,
          body.clientSecret.trim(),
          { label: "Hotmart Client Secret", group: "hotmart" },
        ),
      );
    }

    if (body.basicToken !== undefined && body.basicToken.trim()) {
      ops.push(
        upsertSecretSetting(
          SETTING_KEYS.HOTMART_BASIC_TOKEN,
          body.basicToken.trim(),
          { label: "Hotmart Basic Token", group: "hotmart" },
        ),
      );
    }

    if (body.webhookSecret !== undefined && body.webhookSecret.trim()) {
      ops.push(
        upsertSecretSetting(
          SETTING_KEYS.HOTMART_WEBHOOK_SECRET,
          body.webhookSecret.trim(),
          { label: "Hotmart Webhook Secret", group: "hotmart" },
        ),
      );
    }

    if (body.sandbox !== undefined) {
      ops.push(
        upsertSetting(
          SETTING_KEYS.HOTMART_SANDBOX,
          body.sandbox ? "true" : "false",
          { label: "Hotmart Sandbox", group: "hotmart", type: "text" },
        ),
      );
    }

    await Promise.all(ops);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
