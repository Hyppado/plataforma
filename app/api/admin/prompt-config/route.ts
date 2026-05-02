/**
 * app/api/admin/prompt-config/route.ts
 *
 * GET  — read current prompt config from DB (falls back to defaults)
 * PUT  — update prompt config in DB
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import {
  getPromptConfigFromDB,
  savePromptConfigToDB,
} from "@/lib/admin/config";
import {
  AVATAR_IMAGE_VARIABLES,
  VEO_USER_VARIABLES,
  VEO_SYSTEM_VARIABLES,
} from "@/lib/admin/config-defaults";
import { findMissingRequiredVariables } from "@/lib/admin/template";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/admin/prompt-config");

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const config = await getPromptConfigFromDB();
    return NextResponse.json(config);
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load prompt config" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await req.json();

    // Basic validation: must have insight and script with template + settings
    if (!body.insight?.template || !body.script?.template) {
      return NextResponse.json(
        { error: "insight.template and script.template are required" },
        { status: 400 },
      );
    }

    if (!body.insight?.settings || !body.script?.settings) {
      return NextResponse.json(
        { error: "insight.settings and script.settings are required" },
        { status: 400 },
      );
    }

    // avatarVideo is optional in the request — when provided, every required
    // variable must remain in each template so the runtime substitution
    // does not break the generation flow.
    if (body.avatarVideo) {
      const checks: {
        label: string;
        template: string | undefined;
        vars: readonly { variable: string; required: boolean }[];
      }[] = [
        {
          label: "avatarVideo.image",
          template: body.avatarVideo.image,
          vars: AVATAR_IMAGE_VARIABLES,
        },
        {
          label: "avatarVideo.veoSystem",
          template: body.avatarVideo.veoSystem,
          vars: VEO_SYSTEM_VARIABLES,
        },
        {
          label: "avatarVideo.veoUser",
          template: body.avatarVideo.veoUser,
          vars: VEO_USER_VARIABLES,
        },
      ];

      for (const check of checks) {
        if (typeof check.template !== "string" || !check.template.trim()) {
          return NextResponse.json(
            { error: `${check.label} não pode ficar vazio` },
            { status: 400 },
          );
        }
        const missing = findMissingRequiredVariables(
          check.template,
          check.vars,
        );
        if (missing.length > 0) {
          return NextResponse.json(
            {
              error: `${check.label}: variáveis obrigatórias ausentes: ${missing.join(", ")}`,
            },
            { status: 400 },
          );
        }
      }
    }

    await savePromptConfigToDB(body);
    return NextResponse.json(body);
  } catch (error) {
    log.error("PUT failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to save prompt config" },
      { status: 500 },
    );
  }
}
