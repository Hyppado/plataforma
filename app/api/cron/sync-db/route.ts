/**
 * Cron Route: GET /api/cron/sync-db
 *
 * Daily prod→preview database sync (06:00 UTC = 03:00 BRT).
 * Copies Echotik data as-is and user/billing data with PII masking.
 *
 * Vercel only triggers cron jobs on the production deployment, so this
 * route runs IN production and writes TO the preview database using
 * PREVIEW_DATABASE_URL (configured as env var in Vercel → Production).
 *
 * Required env vars (Production scope):
 *   CRON_SECRET           — bearer token for cron auth
 *   PREVIEW_DATABASE_URL  — unpooled connection string to the preview/dev Neon DB
 *   DATABASE_URL          — used as the production source (already set by Vercel)
 *
 * Auth: CRON_SECRET via Bearer token (same pattern as other cron routes).
 *
 * Response:
 *   200 — { ok: true, summary: { ... } }
 *   401 — CRON_SECRET invalid
 *   500 — error
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runSync } from "@/lib/sync/service";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const log = createLogger("cron/sync-db");

  // -----------------------------------------------------------------------
  // 0a. Block execution in local environment
  // -----------------------------------------------------------------------
  if (!process.env.VERCEL) {
    log.warn("Cron jobs are disabled in local environment");
    return NextResponse.json(
      { ok: false, error: "Cron jobs are disabled in local environment" },
      { status: 403 },
    );
  }

  // -----------------------------------------------------------------------
  // 0b. Guard: PREVIEW_DATABASE_URL must be configured
  // -----------------------------------------------------------------------
  if (!process.env.PREVIEW_DATABASE_URL) {
    log.error("PREVIEW_DATABASE_URL not configured — cannot sync");
    return NextResponse.json(
      { ok: false, error: "PREVIEW_DATABASE_URL not configured" },
      { status: 500 },
    );
  }

  // -----------------------------------------------------------------------
  // 1. Validate CRON_SECRET
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // 2. Run sync
  // -----------------------------------------------------------------------
  try {
    const summary = await runSync({ logger: log });

    const ok = summary.tablesFailed === 0;
    return NextResponse.json({ ok, summary });
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
