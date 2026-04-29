/**
 * app/api/admin/prompt-library/upload/route.ts
 *
 * POST — upload a looping video for a prompt library item to Vercel Blob.
 * Returns the public URL. Admin only.
 *
 * Accepts multipart/form-data with a single field named "file".
 * Allowed types: video/mp4, video/webm
 * Max size: 50 MB
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { put } from "@vercel/blob";

const log = createLogger("api/admin/prompt-library/upload");

export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = ["video/mp4", "video/webm"] as const;
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

function mimeToExt(mime: AllowedMime): string {
  return mime === "video/mp4" ? "mp4" : "webm";
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
        { error: "Formato inválido. Use MP4 ou WEBM." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "O vídeo deve ter no máximo 50 MB." },
        { status: 400 },
      );
    }

    const ext = mimeToExt(file.type as AllowedMime);
    const pathname = `prompt-library/videos/${Date.now()}.${ext}`;
    const blob = await put(pathname, file, { access: "public" });

    log.info("Prompt library video uploaded", { url: blob.url });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Failed to upload prompt library video", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
