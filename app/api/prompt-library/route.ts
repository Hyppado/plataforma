/**
 * app/api/prompt-library/route.ts
 *
 * GET /api/prompt-library — Return active prompt library items to authenticated users.
 *
 * Supports optional query params:
 *   ?category=<string>  — filter by category (case-insensitive)
 *
 * Response: { items, categories }
 *   items      — active items only; admin-only fields excluded
 *   categories — unique sorted categories from the full active set (before filter)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/prompt-library");

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const categoryFilter = searchParams.get("category")?.trim() || null;

    const rows = await prisma.promptLibraryItem.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        category: true,
        description: true,
        videoBlobUrl: true,
        promptText: true,
      },
    });

    // Derive categories before applying filter
    const categories = Array.from(new Set(rows.map((r) => r.category))).sort();

    const allItems = rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      description: r.description,
      videoBlobUrl: r.videoBlobUrl,
      promptText: r.promptText,
    }));

    const items = categoryFilter
      ? allItems.filter(
          (r) => r.category.toLowerCase() === categoryFilter.toLowerCase(),
        )
      : allItems;

    return NextResponse.json({ items, categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to list prompt library items", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
