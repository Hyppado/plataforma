/**
 * app/api/admin/avatar-video/avatars/upload/route.ts
 *
 * POST — upload an avatar profile image to Vercel Blob.
 * Returns the public URL. Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { put } from "@vercel/blob";

const log = createLogger("api/admin/avatar-video/avatars/upload");

export const dynamic = "force-dynamic";

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
  const auth = await requireAdmin();
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
    const pathname = `avatar-profiles/admin/${Date.now()}.${ext}`;
    const blob = await put(pathname, file, { access: "public" });

    log.info("Avatar profile image uploaded", { url: blob.url });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to upload avatar profile image", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
