/**
 * app/api/admin/echotik/estimate/route.ts
 *
 * POST — calculate Echotik API request volume estimate
 *
 * Body: EstimationInput (full or partial — missing fields use current config as base)
 *
 * GET  — calculate estimate from current saved config
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import {
  estimateEchotikRequests,
  configToEstimationInput,
} from "@/lib/echotik/admin/estimation";
import { getEchotikConfig } from "@/lib/echotik/cron/config";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { EstimationInput } from "@/lib/types/echotik-admin";

const log = createLogger("api/admin/echotik/estimate");

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const [config, regions] = await Promise.all([
      getEchotikConfig(),
      prisma.region.findMany({ where: { isActive: true } }),
    ]);

    const input = configToEstimationInput(config, regions.length);
    const result = estimateEchotikRequests(input);
    return NextResponse.json(result);
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to calculate estimate" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await req.json();

    // Load current config as base, then apply overrides from body
    const [currentConfig, regions] = await Promise.all([
      getEchotikConfig(),
      prisma.region.findMany({ where: { isActive: true } }),
    ]);

    const base = configToEstimationInput(currentConfig, regions.length);

    // Merge body overrides — only accept known numeric/array fields
    const input: EstimationInput = {
      ...base,
      ...(typeof body.activeRegions === "number"
        ? { activeRegions: body.activeRegions }
        : {}),
      ...(typeof body.videoPages === "number"
        ? { videoPages: body.videoPages }
        : {}),
      ...(typeof body.productPages === "number"
        ? { productPages: body.productPages }
        : {}),
      ...(typeof body.creatorPages === "number"
        ? { creatorPages: body.creatorPages }
        : {}),
      ...(typeof body.detailBatchSize === "number"
        ? { detailBatchSize: body.detailBatchSize }
        : {}),
      ...(typeof body.categoriesIntervalHours === "number"
        ? { categoriesIntervalHours: body.categoriesIntervalHours }
        : {}),
      ...(typeof body.videosIntervalHours === "number"
        ? { videosIntervalHours: body.videosIntervalHours }
        : {}),
      ...(typeof body.productsIntervalHours === "number"
        ? { productsIntervalHours: body.productsIntervalHours }
        : {}),
      ...(typeof body.creatorsIntervalHours === "number"
        ? { creatorsIntervalHours: body.creatorsIntervalHours }
        : {}),
      ...(Array.isArray(body.enabledTasks)
        ? { enabledTasks: body.enabledTasks }
        : {}),
    };

    const result = estimateEchotikRequests(input);
    return NextResponse.json(result);
  } catch (error) {
    log.error("POST failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to calculate estimate" },
      { status: 500 },
    );
  }
}
