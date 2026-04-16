/**
 * app/api/plans/route.ts
 *
 * GET /api/plans — Public endpoint that returns active plans for display.
 * Used by the landing page pricing section (unauthenticated visitors).
 *
 * Returns only fields needed for public display — no internal/sensitive data.
 * Plans are sorted by sortOrder asc.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true, showOnLanding: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      displayPrice: true,
      priceAmount: true,
      currency: true,
      periodicity: true,
      description: true,
      features: true,
      highlight: true,
      badge: true,
      checkoutUrl: true,
      showOnLanding: true,
    },
  });

  return NextResponse.json({ plans });
}
