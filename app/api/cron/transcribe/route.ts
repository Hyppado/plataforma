/**
 * app/api/cron/transcribe/route.ts
 *
 * Cron Route: GET /api/cron/transcribe
 *
 * Processes pending video transcripts.
 * Authenticated by CRON_SECRET (same pattern as echotik cron).
 *
 * Intended to run every 15 minutes via Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processPendingTranscripts } from "@/lib/transcription/service";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const log = createLogger("cron/transcribe");

  // -----------------------------------------------------------------------
  // 0. Block execution in local environment
  // -----------------------------------------------------------------------
  if (!process.env.VERCEL) {
    log.warn("Cron jobs are disabled in local environment");
    return NextResponse.json(
      { ok: false, error: "Cron jobs are disabled in local environment" },
      { status: 403 },
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
  // 2. Process pending transcripts
  // -----------------------------------------------------------------------
  try {
    const stats = await processPendingTranscripts();

    return NextResponse.json({
      ok: true,
      ...stats,
    });
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
