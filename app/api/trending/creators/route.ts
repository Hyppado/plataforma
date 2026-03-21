import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/trending/creators
 *
 * Placeholder — creators will come from DB once cron populates data.
 * Returns empty array for now.
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: { items: [], total: 0, range: "7d" },
  });
}
