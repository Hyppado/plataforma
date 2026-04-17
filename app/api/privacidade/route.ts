/**
 * app/api/privacidade/route.ts
 *
 * Public GET — returns the privacy policy text (no auth required)
 */

import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    const text = await getSetting("privacy_policy");
    return NextResponse.json({ text: text ?? "" });
  } catch {
    return NextResponse.json(
      { error: "Erro ao carregar política" },
      { status: 500 },
    );
  }
}
