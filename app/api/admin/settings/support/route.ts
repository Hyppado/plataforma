/**
 * GET  /api/admin/settings/support — read support email
 * POST /api/admin/settings/support — save support email
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getSetting, upsertSetting } from "@/lib/settings";

const KEY = "support.email";
const DEFAULT = "suporte@hyppado.com";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const value = (await getSetting(KEY)) ?? DEFAULT;
    return NextResponse.json({ email: value });
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

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    await upsertSetting(KEY, email.trim().toLowerCase(), {
      label: "Email de Suporte",
      group: "general",
      type: "text",
    });
    return NextResponse.json({ email: email.trim().toLowerCase() });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
