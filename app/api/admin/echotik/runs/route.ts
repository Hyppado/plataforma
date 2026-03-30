/**
 * app/api/admin/echotik/runs/route.ts
 *
 * GET — paginated execution history from IngestionRun
 *
 * Query params:
 *   ?page=1         — page number (default 1)
 *   ?limit=50       — page size (default 50, max 200)
 *   ?task=videos    — filter by task
 *   ?region=BR      — filter by region
 *   ?status=FAILED  — filter by status
 *   ?since=ISO      — filter runs after this timestamp
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { IngestionStatus } from "@prisma/client";
import type {
  IngestionRunRecord,
  IngestionRunsResponse,
} from "@/lib/types/echotik-admin";

const log = createLogger("api/admin/echotik/runs");

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
    );
    const taskFilter = searchParams.get("task");
    const regionFilter = searchParams.get("region");
    const validStatuses: IngestionStatus[] = ["RUNNING", "SUCCESS", "FAILED"];
    const statusFilterRaw = searchParams.get("status");
    const statusFilter =
      statusFilterRaw &&
      validStatuses.includes(statusFilterRaw as IngestionStatus)
        ? (statusFilterRaw as IngestionStatus)
        : undefined;
    const sinceRaw = searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : null;

    // Build source filter
    let sourceContains: string | undefined;
    if (taskFilter && regionFilter) {
      sourceContains = `echotik:${taskFilter}:${regionFilter}`;
    } else if (taskFilter) {
      sourceContains = `echotik:${taskFilter}`;
    } else if (regionFilter) {
      sourceContains = `:${regionFilter}`;
    }

    const where = {
      source: {
        startsWith: "echotik:",
        ...(sourceContains ? { contains: sourceContains } : {}),
      },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(since ? { startedAt: { gte: since } } : {}),
    };

    const [rawRuns, total] = await Promise.all([
      prisma.ingestionRun.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          source: true,
          status: true,
          startedAt: true,
          endedAt: true,
          statsJson: true,
          errorMessage: true,
        },
      }),
      prisma.ingestionRun.count({ where }),
    ]);

    const runs: IngestionRunRecord[] = rawRuns.map((r) => {
      // Parse task and region from source key
      const withoutPrefix = r.source.replace(/^echotik:(run:)?/, "");
      const parts = withoutPrefix.split(":");
      const task = parts[0] ?? r.source;
      const region = parts[1] ?? null;

      // Extract stats
      const stats =
        r.statsJson && typeof r.statsJson === "object"
          ? (r.statsJson as Record<string, unknown>)
          : null;
      const items = stats
        ? ((stats.videosSynced as number) ??
          (stats.productsSynced as number) ??
          (stats.creatorsSynced as number) ??
          (stats.categoriesSynced as number) ??
          null)
        : null;
      const pages =
        stats && typeof stats.pagesProcessed === "number"
          ? stats.pagesProcessed
          : null;
      const durationMs =
        r.startedAt && r.endedAt
          ? r.endedAt.getTime() - r.startedAt.getTime()
          : stats && typeof stats.durationMs === "number"
            ? stats.durationMs
            : null;

      return {
        id: r.id,
        source: r.source,
        task,
        region,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString() ?? null,
        durationMs,
        itemsProcessed: typeof items === "number" ? items : null,
        pagesProcessed: pages,
        errorMessage: r.errorMessage ?? null,
      };
    });

    const response: IngestionRunsResponse = { runs, total, page, limit };
    return NextResponse.json(response);
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load Echotik runs" },
      { status: 500 },
    );
  }
}
