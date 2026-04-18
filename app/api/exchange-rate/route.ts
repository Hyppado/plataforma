/**
 * GET /api/exchange-rate
 *
 * Returns the latest stored USD→BRL exchange rate for the frontend.
 * Requires authentication.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { getStoredUsdRate } from "@/lib/exchange/fetchRate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!isAuthed(auth)) return auth;

    const payload = await getStoredUsdRate();

    if (!payload) {
      // No rate stored yet — return a sensible fallback so UI doesn't break
      return NextResponse.json({ rate: null, date: null, fetchedAt: null });
    }

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
