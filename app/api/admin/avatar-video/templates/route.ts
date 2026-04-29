/**
 * app/api/admin/avatar-video/templates/route.ts
 *
 * GET — read concept + VEO prompt + image templates from settings.
 * PUT — save them.
 *
 * Settings keys:
 *   - avatar_video.concept_template
 *   - avatar_video.prompt_template
 *   - avatar_video.image_template
 *
 * If a template is empty, runtime continues to use embedded safe defaults.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { getSetting, upsertSetting, SETTING_KEYS } from "@/lib/settings";

const log = createLogger("api/admin/avatar-video/templates");

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const [conceptTemplate, promptTemplate, imageTemplate] = await Promise.all([
      getSetting(SETTING_KEYS.AVATAR_VIDEO_CONCEPT_TEMPLATE),
      getSetting(SETTING_KEYS.AVATAR_VIDEO_PROMPT_TEMPLATE),
      getSetting(SETTING_KEYS.AVATAR_VIDEO_IMAGE_TEMPLATE),
    ]);

    return NextResponse.json({
      conceptTemplate: conceptTemplate ?? "",
      promptTemplate: promptTemplate ?? "",
      imageTemplate: imageTemplate ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("GET failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (typeof body.conceptTemplate === "string") {
      await upsertSetting(
        SETTING_KEYS.AVATAR_VIDEO_CONCEPT_TEMPLATE,
        body.conceptTemplate,
        {
          label: "Avatar Video — Concept Template",
          group: "avatar_video",
        },
      );
    }

    if (typeof body.promptTemplate === "string") {
      await upsertSetting(
        SETTING_KEYS.AVATAR_VIDEO_PROMPT_TEMPLATE,
        body.promptTemplate,
        {
          label: "Avatar Video — VEO Prompt Template",
          group: "avatar_video",
        },
      );
    }

    if (typeof body.imageTemplate === "string") {
      await upsertSetting(
        SETTING_KEYS.AVATAR_VIDEO_IMAGE_TEMPLATE,
        body.imageTemplate,
        {
          label: "Avatar Video — Image Generation Template",
          group: "avatar_video",
        },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("PUT failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
