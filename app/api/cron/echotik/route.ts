/**
 * Cron Route: GET /api/cron/echotik
 *
 * Executado 1×/dia (03:00 UTC) pelo Vercel Cron.
 * Valida CRON_SECRET e dispara a ingestão EchoTik com smart scheduling.
 *
 * Query params:
 *   ?force=true  — ignora intervalos e força todas as tarefas (útil em testes)
 *
 * Headers esperados (Vercel Cron envia automaticamente):
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Resposta:
 *   200 — { ok, runId, status, stats }
 *   401 — CRON_SECRET inválido
 *   500 — erro inesperado
 */

import { NextRequest, NextResponse } from "next/server";
import { runEchotikCron } from "@/lib/echotik/cron";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // segundos (Vercel Pro)

export async function GET(request: NextRequest) {
  const log = createLogger("cron/echotik");

  // -----------------------------------------------------------------------
  // 1. Validar CRON_SECRET
  // -----------------------------------------------------------------------
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    if (token !== cronSecret) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    log.error("CRON_SECRET not configured in production");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  // -----------------------------------------------------------------------
  // 2. Executar cron
  // -----------------------------------------------------------------------
  try {
    const force = request.nextUrl.searchParams.get("force") === "true";
    const result = await runEchotikCron(force);

    return NextResponse.json({
      ok: result.status !== "FAILED",
      runId: result.runId,
      status: result.status,
      stats: result.stats,
      ...(result.error ? { error: result.error } : {}),
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
