/**
 * app/api/shopee/ranking/route.ts
 *
 * GET /api/shopee/ranking
 * Returns Shopee product ranking trends from database.
 * Protected by NextAuth.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const products = await prisma.shopeeProductTrend.findMany({
      orderBy: { rankPosition: "asc" },
    });

    return NextResponse.json({
      ok: true,
      products,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
