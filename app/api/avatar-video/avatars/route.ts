/**
 * app/api/avatar-video/avatars/route.ts
 *
 * GET /api/avatar-video/avatars
 *
 * Returns the list of active avatar profiles available for selection.
 * Ordered by sortOrder ascending (admin-controlled).
 *
 * Response: { avatars: AvatarProfileDTO[] }
 *
 * Security:
 *   - Requires authenticated user (not admin — any subscriber can read).
 *   - Only public fields are exposed (no internal admin metadata).
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/avatar-video/avatars");

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const avatars = await prisma.avatarProfile.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        thumbnailUrl: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ avatars });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    log.error("Failed to list avatar profiles", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
