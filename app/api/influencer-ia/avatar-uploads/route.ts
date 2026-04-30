/**
 * app/api/influencer-ia/avatar-uploads/route.ts
 *
 * GET /api/influencer-ia/avatar-uploads
 *
 * Returns all avatar images uploaded by the authenticated user,
 * ordered by most recent first.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import prisma from "@/lib/prisma";

const log = createLogger("api/influencer-ia/avatar-uploads");

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const uploads = await prisma.userAvatarUpload.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, blobUrl: true, label: true, createdAt: true },
    });

    return NextResponse.json({ uploads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to list avatar uploads", {
      userId: auth.userId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
