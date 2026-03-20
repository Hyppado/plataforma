import { NextRequest, NextResponse } from "next/server";
import { assertQuota, consumeUsage, QuotaExceededError } from "@/lib/usage";
import type { UsageEventType } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/usage/consume
 *
 * Body:
 * {
 *   userId:          string   — internal User ID (required)
 *   action:          "TRANSCRIPT" | "SCRIPT" | "INSIGHT"
 *   tokens?:         number   — tokens consumed (for SCRIPT / INSIGHT)
 *   idempotencyKey:  string   — unique key; duplicate keys are no-ops
 *   refTable?:       string   — e.g. "Video"
 *   refId?:          string   — ID of the related object
 * }
 *
 * Responses:
 *  200 { event, duplicate }          — success or idempotent replay
 *  402 { error, used, limit }        — quota exceeded
 *  400 { error }                     — bad request
 *  500 { error }                     — internal error
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const {
    userId,
    action,
    tokens = 0,
    idempotencyKey,
    refTable,
    refId,
  } = body as Record<string, unknown>;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    return NextResponse.json(
      { error: "idempotencyKey is required" },
      { status: 400 },
    );
  }

  const VALID_ACTIONS: UsageEventType[] = ["TRANSCRIPT", "SCRIPT", "INSIGHT"];
  if (!action || !VALID_ACTIONS.includes(action as UsageEventType)) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const tokenCount = typeof tokens === "number" ? tokens : 0;

  try {
    // 1. Check quota
    await assertQuota(userId, action as UsageEventType, tokenCount);

    // 2. Record consumption
    const result = await consumeUsage(userId, action as UsageEventType, tokenCount, {
      idempotencyKey,
      refTable: typeof refTable === "string" ? refTable : undefined,
      refId: typeof refId === "string" ? refId : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: err.message,
          action: err.action,
          used: err.used,
          limit: err.limit,
        },
        { status: 402 },
      );
    }
    console.error("[POST /api/usage/consume]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
