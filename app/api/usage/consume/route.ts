import { NextRequest, NextResponse } from "next/server";
import { assertQuota, consumeUsage, QuotaExceededError } from "@/lib/usage";
import { requireAuth, isAuthed } from "@/lib/auth";
import type { UsageEventType } from "@prisma/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/usage/consume");

export const runtime = "nodejs";

/**
 * POST /api/usage/consume
 *
 * Body:
 * {
 *   action:          "TRANSCRIPT" | "SCRIPT" | "INSIGHT"
 *   tokens?:         number   — tokens consumed (for SCRIPT / INSIGHT)
 *   idempotencyKey:  string   — unique key; duplicate keys are no-ops
 *   refTable?:       string   — e.g. "Video"
 *   refId?:          string   — ID of the related object
 * }
 *
 * userId is derived from the authenticated session — never from the body.
 *
 * Responses:
 *  200 { event, duplicate }          — success or idempotent replay
 *  402 { error, used, limit }        — quota exceeded
 *  400 { error }                     — bad request
 *  401 { error }                     — unauthenticated
 *  500 { error }                     — internal error
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Body must be an object" },
      { status: 400 },
    );
  }

  const {
    action,
    tokens = 0,
    idempotencyKey,
    refTable,
    refId,
  } = body as Record<string, unknown>;

  const userId = auth.userId;

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
    const result = await consumeUsage(
      userId,
      action as UsageEventType,
      tokenCount,
      {
        idempotencyKey,
        refTable: typeof refTable === "string" ? refTable : undefined,
        refId: typeof refId === "string" ? refId : undefined,
      },
    );

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
    log.error("POST failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
