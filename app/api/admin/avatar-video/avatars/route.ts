/**
 * app/api/admin/avatar-video/avatars/route.ts
 *
 * GET  — list all avatars (active and inactive)
 * POST — create a new avatar
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { createAvatar, listAllAvatars } from "@/lib/avatar-video/admin";

const log = createLogger("api/admin/avatar-video/avatars");

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const avatars = await listAllAvatars();
    return NextResponse.json({ avatars });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to list avatars", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "name é obrigatório" },
        { status: 400 },
      );
    }
    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl é obrigatório" },
        { status: 400 },
      );
    }

    const avatar = await createAvatar({
      name,
      imageUrl,
      description:
        typeof body.description === "string" ? body.description : null,
      thumbnailUrl:
        typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      sortOrder:
        typeof body.sortOrder === "number" ? body.sortOrder : undefined,
    });

    return NextResponse.json({ avatar }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to create avatar", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
