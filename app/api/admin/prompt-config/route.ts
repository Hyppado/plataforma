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

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const config = await getPromptConfigFromDB();
    return NextResponse.json(config);
  } catch (error) {
    console.error("[admin/prompt-config] GET error:", error);
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

    await savePromptConfigToDB(body);
    return NextResponse.json(body);
  } catch (error) {
    console.error("[admin/prompt-config] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save prompt config" },
      { status: 500 },
    );
  }
}
