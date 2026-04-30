/**
 * app/api/influencer-ia/usage/route.ts
 *
 * GET /api/influencer-ia/usage
 *
 * Returns the authenticated user's Influencer IA generation usage for today.
 *
 * Response: { usedToday: number; dailyLimit: number }
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import {
  getInfluencerGenerationsToday,
  getInfluencerDailyLimit,
} from "@/lib/influencer-ia/quota";

const log = createLogger("api/influencer-ia/usage");

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const [usedToday, dailyLimit] = await Promise.all([
      getInfluencerGenerationsToday(auth.userId),
      getInfluencerDailyLimit(),
    ]);
    return NextResponse.json({
      usedToday,
      dailyLimit,
    });
  } catch (err) {
    log.error("Failed to fetch influencer-ia usage", {
      userId: auth.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
