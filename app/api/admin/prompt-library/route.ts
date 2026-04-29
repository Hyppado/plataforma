/**
 * app/api/admin/prompt-library/route.ts
 *
 * GET  — list all prompt library items (including inactive)
 *        ?category=<string>  filter by category
 *        ?status=active|inactive|all  filter by active state (default: all)
 * POST — create a new prompt library item
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import {
  listAllPromptLibraryItems,
  createPromptLibraryItem,
  PromptLibraryValidationError,
} from "@/lib/prompt-library/admin";

const log = createLogger("api/admin/prompt-library");

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const categoryFilter = searchParams.get("category")?.trim() || null;
    const statusFilter = searchParams.get("status") ?? "all";

    let items = await listAllPromptLibraryItems();

    if (categoryFilter) {
      items = items.filter(
        (i) => i.category.toLowerCase() === categoryFilter.toLowerCase(),
      );
    }

    if (statusFilter === "active") {
      items = items.filter((i) => i.isActive);
    } else if (statusFilter === "inactive") {
      items = items.filter((i) => !i.isActive);
    }

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to list prompt library items", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const item = await createPromptLibraryItem({
      title: typeof body.title === "string" ? body.title : "",
      category: typeof body.category === "string" ? body.category : "",
      description:
        typeof body.description === "string" ? body.description : null,
      videoBlobUrl:
        typeof body.videoBlobUrl === "string" ? body.videoBlobUrl : "",
      promptText:
        typeof body.promptText === "string" ? body.promptText : "",
      isActive:
        typeof body.isActive === "boolean" ? body.isActive : undefined,
      createdById: auth.userId,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof PromptLibraryValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to create prompt library item", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
