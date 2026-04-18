/**
 * Cron Route: GET /api/cron/exchange-rate
 *
 * Runs daily (13:30 UTC — after Brazilian market rate is published).
 * Fetches the latest USD→BRL PTAX rate from BCB and stores it in DB.
 *
 * If the fetch fails the existing stored value is preserved (fail-safe).
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { fetchAndStoreUsdRate } from "@/lib/exchange/fetchRate";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const log = createLogger("cron/exchange-rate");

export async function GET(request: NextRequest) {
  // Block in non-Vercel environments (local dev)
  if (!process.env.VERCEL) {
    return NextResponse.json(
      { error: "Not available locally" },
      { status: 403 },
    );
  }

  // Validate CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log.error("CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    valid = false;
  }

  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await fetchAndStoreUsdRate();
    log.info("Exchange rate cron completed", {
      rate: payload.rate,
      date: payload.date,
    });
    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Exchange rate cron failed — previous value preserved", {
      message,
    });
    // Return 200 so Vercel doesn't retry aggressively; existing DB value is intact
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
