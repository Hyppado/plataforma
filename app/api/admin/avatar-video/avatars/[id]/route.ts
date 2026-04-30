/**
 * app/api/admin/avatar-video/avatars/[id]/route.ts
 *
 * PATCH  — update an avatar
 * DELETE — delete the avatar
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/admin/avatar-video/avatars/[id]");

export const dynamic = "force-dynamic";

interface AvatarPatch {
  name?: string;
  description?: string | null;
  imageUrl?: string;
  thumbnailUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const patch: AvatarPatch = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (body.description === null || typeof body.description === "string")
      patch.description = body.description as string | null;
    if (typeof body.imageUrl === "string") patch.imageUrl = body.imageUrl;
    if (body.thumbnailUrl === null || typeof body.thumbnailUrl === "string")
      patch.thumbnailUrl = body.thumbnailUrl as string | null;
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
    if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

    if (patch.name !== undefined && !patch.name.trim()) {
      return NextResponse.json(
        { error: "name não pode ser vazio" },
        { status: 400 },
      );
    }
    if (patch.imageUrl !== undefined && !patch.imageUrl.trim()) {
      return NextResponse.json(
        { error: "imageUrl não pode ser vazio" },
        { status: 400 },
      );
    }

    const avatar = await prisma.avatarProfile.update({
      where: { id: params.id },
      data: patch,
    });
    return NextResponse.json({ avatar });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to update avatar", { id: params.id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    await prisma.avatarProfile.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to delete avatar", { id: params.id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
