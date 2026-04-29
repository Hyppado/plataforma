/**
 * app/api/influencer-ia/avatar-uploads/[id]/route.ts
 *
 * DELETE /api/influencer-ia/avatar-uploads/:id
 *
 * Deletes a user's saved avatar upload. Only the owner can delete their own records.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import prisma from "@/lib/prisma";

const log = createLogger("api/influencer-ia/avatar-uploads/[id]");

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { id } = params;

  try {
    // Verify ownership before deleting
    const upload = await prisma.userAvatarUpload.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!upload) {
      return NextResponse.json(
        { error: "Upload não encontrado" },
        { status: 404 },
      );
    }

    if (upload.userId !== auth.userId) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    await prisma.userAvatarUpload.delete({ where: { id } });

    log.info("Avatar upload deleted", { userId: auth.userId, uploadId: id });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to delete avatar upload", {
      userId: auth.userId,
      uploadId: id,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
