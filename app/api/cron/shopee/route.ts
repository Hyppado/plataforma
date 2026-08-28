/**
 * Cron Route: GET /api/cron/shopee
 *
 * Executed periodically by Vercel Cron.
 * Triggers Shopee rankings sync and "Achadinhos Shopee" AI pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runShopeeRankingsCron, runShopeeAchadinhosCron } from "@/lib/shopee/cron/syncShopee";
import { createLogger } from "@/lib/logger";
import { syncShopeeCategoriesIfStale } from "@/lib/shopee/categories-sync";
import { invalidarCacheCategorias } from "@/lib/shopee/shopee-categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 mins max limit

export async function GET(request: NextRequest) {
  const log = createLogger("cron/shopee");

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
  // 1. Validate CRON_SECRET (fail-closed — same pattern as other cron routes)
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

  const force = request.nextUrl.searchParams.get("force") === "true";
  const task = request.nextUrl.searchParams.get("task") ?? "all";

  // Quantidade dinâmica de vídeos para o pipeline de achadinhos (20-400).
  // O admin define via painel (Setting). Este query param permite
  // sobrescrever sob demanda (ex: /api/cron/shopee?task=achadinhos&count=300&force=true).
  // A paginação é feita em blocos de 20 com delay ~2s (evita Risk Control da EchoTik).
  const countParam = request.nextUrl.searchParams.get("count");
  const countOverride = countParam
    ? Math.min(400, Math.max(20, parseInt(countParam, 10) || 20))
    : undefined;

  try {
    const results: Record<string, any> = {};

    if (task === "ranking" || task === "all") {
      // A dimensão de categorias vem ANTES do ranking: é ela que traduz os
      // productCatIds do produto em nome. Vazia, os produtos entram sem
      // categoria e o filtro da tela fica cego.
      const categorias = await syncShopeeCategoriesIfStale(log, force);
      if (categorias) {
        results.categories = categorias;
        invalidarCacheCategorias();
      }

      log.info("Running Shopee Rankings Cron sync...");
      const syncedRankings = await runShopeeRankingsCron(force);
      results.rankings = syncedRankings;
    }

    if (task === "achadinhos" || task === "all") {
      log.info("Running Shopee Achadinhos Ingestion Cron sync...", {
        count: countOverride ?? "from-setting",
      });
      const syncedAchadinhos = await runShopeeAchadinhosCron(force, countOverride);
      results.achadinhos = syncedAchadinhos;
    }

    return NextResponse.json({
      ok: true,
      task,
      count: countOverride ?? null,
      results,
    });
  } catch (error) {
    log.error("Unhandled error in Shopee cron route", {
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
