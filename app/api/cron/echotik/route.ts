/**
 * Cron Route: GET /api/cron/echotik
 *
 * Executado 1×/dia (03:00 UTC) pelo Vercel Cron.
 * Valida CRON_SECRET e dispara a ingestão EchoTik com smart scheduling.
 *
 * Query params:
 *   ?force=true          — ignora intervalos e força todas as tarefas (útil em testes)
 *   ?task=videos         — executa apenas esta tarefa
 *   ?region=BR           — região alvo para tarefas de ranklist (ex: BR, US, MX, GB)
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
import type { CronTask } from "@/lib/echotik/cron";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_TASKS = new Set<CronTask>([
  "categories",
  "videos",
  "products",
  "creators",
  "details",
  "auto",
]);

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
  // 2. Parse params
  // -----------------------------------------------------------------------
  const force = request.nextUrl.searchParams.get("force") === "true";
  const taskParam = request.nextUrl.searchParams.get("task") ?? "auto";
  const regionParam = request.nextUrl.searchParams.get("region") ?? undefined;

  if (!VALID_TASKS.has(taskParam as CronTask)) {
    return NextResponse.json(
      { ok: false, error: `Invalid task: ${taskParam}` },
      { status: 400 },
    );
  }

  // -----------------------------------------------------------------------
  // 3. Executar tarefa
  // -----------------------------------------------------------------------
  try {
    const result = await runEchotikCron({
      task: taskParam as CronTask,
      region: regionParam,
      force,
    });

    return NextResponse.json({
      ok: result.status !== "FAILED",
      runId: result.runId,
      status: result.status,
      task: taskParam,
      region: regionParam ?? null,
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
