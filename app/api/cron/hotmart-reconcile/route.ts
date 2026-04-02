/**
 * Cron Route: GET /api/cron/hotmart-reconcile
 *
 * Executado 1×/dia (06:00 UTC) pelo Vercel Cron.
 * Thin route handler — delegates to lib/hotmart/reconcile.ts.
 *
 * Headers esperados (Vercel Cron envia automaticamente):
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runHotmartReconcile } from "@/lib/hotmart/reconcile";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const log = createLogger("cron/hotmart-reconcile");

  // 1. Validate CRON_SECRET (fail-closed + timing-safe)
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    log.error("CRON_SECRET not configured — rejecting request");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";

  const bufToken = Buffer.from(token, "utf8");
  const bufSecret = Buffer.from(cronSecret, "utf8");
  const isValid =
    bufToken.length === bufSecret.length &&
    timingSafeEqual(bufToken, bufSecret);

  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // 2. Run reconciliation
  try {
    const result = await runHotmartReconcile(log);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, stats: result.stats },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, stats: result.stats });
  } catch (error) {
    log.error("Unhandled error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
