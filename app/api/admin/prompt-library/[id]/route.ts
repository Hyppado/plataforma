/**
 * app/api/admin/prompt-library/[id]/route.ts
 *
 * PATCH  — update an existing prompt library item
 * DELETE — soft-delete (deactivate) by default;
 *          pass ?hard=true to permanently delete
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import {
  updatePromptLibraryItem,
  deactivatePromptLibraryItem,
  deletePromptLibraryItem,
  PromptLibraryValidationError,
} from "@/lib/prompt-library/admin";

const log = createLogger("api/admin/prompt-library/[id]");

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const patch: Parameters<typeof updatePromptLibraryItem>[1] = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.category === "string") patch.category = body.category;
    if (body.description === null || typeof body.description === "string")
      patch.description = body.description as string | null;
    if (typeof body.videoBlobUrl === "string")
      patch.videoBlobUrl = body.videoBlobUrl;
    if (typeof body.promptText === "string") patch.promptText = body.promptText;
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

    const item = await updatePromptLibraryItem(params.id, patch);
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof PromptLibraryValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to update prompt library item", {
      id: params.id,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const hardDelete = new URL(req.url).searchParams.get("hard") === "true";

  try {
    if (hardDelete) {
      await deletePromptLibraryItem(params.id);
      return NextResponse.json({ deleted: true });
    }

    const item = await deactivatePromptLibraryItem(params.id);
    return NextResponse.json({ deleted: false, deactivated: true, item });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to delete prompt library item", {
      id: params.id,
      hard: hardDelete,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
