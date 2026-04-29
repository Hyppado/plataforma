/**
 * app/api/influencer-ia/upload-reference/route.ts
 *
 * POST /api/influencer-ia/upload-reference
 *
 * Accepts multipart/form-data with a `file` field (image).
 * Validates type (JPG, PNG, WEBP) and size (≤ 5 MB).
 * Uploads to Vercel Blob and returns the public URL.
 *
 * Used by the Influencer IA wizard for ad-hoc product and avatar uploads
 * that are not tied to an AvatarVideoCreation record.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";

const log = createLogger("api/influencer-ia/upload-reference");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

function mimeToExt(mime: AllowedMime): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

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
    const pathname = `influencer-ia/uploads/${auth.userId}/${Date.now()}.${ext}`;

    const blob = await put(pathname, file, { access: "public" });

    // Persist avatar uploads to DB so the user can reuse them in "Meus Uploads"
    const purpose = formData.get("purpose");
    if (purpose === "avatar") {
      await prisma.userAvatarUpload.create({
        data: { userId: auth.userId, blobUrl: blob.url },
      });
    }

    log.info("Reference image uploaded", {
      userId: auth.userId,
      url: blob.url,
      purpose,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to upload reference image", {
      userId: auth.userId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
