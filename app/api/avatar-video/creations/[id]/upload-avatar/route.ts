/**
 * app/api/avatar-video/creations/[id]/upload-avatar/route.ts
 *
 * POST /api/avatar-video/creations/[id]/upload-avatar
 *
 * Accepts a multipart/form-data body with a `file` field (image).
 * Validates the file type (JPG, PNG, WEBP) and size (max 5 MB).
 * Uploads to Vercel Blob and returns the public URL.
 *
 * The caller is responsible for PATCHing the creation with the returned URL.
 *
 * Security:
 *   - Requires authenticated user.
 *   - Verifies the creation belongs to the authenticated user before accepting
 *     the upload.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const log = createLogger("api/avatar-video/upload-avatar");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

function mimeToExt(mime: AllowedMime): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;

  // Verify ownership before accepting any upload
  const creation = await prisma.avatarVideoCreation.findFirst({
    where: { id: creationId, userId: auth.userId },
    select: { id: true },
  });

  if (!creation) {
    return NextResponse.json({ error: "Criação não encontrada" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Campo 'file' obrigatório" },
        { status: 400 },
      );
    }

    if (!isAllowedMime(file.type)) {
      return NextResponse.json(
        { error: "Formato inválido. Use JPG, PNG ou WEBP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "A imagem deve ter no máximo 5 MB." },
        { status: 400 },
      );
    }

    const ext = mimeToExt(file.type as AllowedMime);
    const pathname = `avatar-uploads/${auth.userId}/${creationId}/${Date.now()}.${ext}`;

    const blob = await put(pathname, file, { access: "public" });

    log.info("Avatar image uploaded", { userId: auth.userId, creationId, url: blob.url });

    return NextResponse.json({ uploadedAvatarImageUrl: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to upload avatar image", {
      userId: auth.userId,
      creationId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
