import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/notes");
import type { NoteDTO } from "@/lib/types/dto";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100,
    );
    const type = searchParams.get("type") || undefined;
    const externalId = searchParams.get("externalId") || undefined;

    const where = {
      userId: auth.userId,
      ...(type ? { type } : {}),
      ...(externalId ? { externalId } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.note.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.note.count({ where }),
    ]);

    const dtos: NoteDTO[] = items.map((n) => ({
      id: n.id,
      type: n.type as NoteDTO["type"],
      externalId: n.externalId,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: { items: dtos, total } });
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch notes" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await request.json();
    const { type, externalId, content } = body;

    if (!type || !externalId || !content) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const existing = await prisma.note.findFirst({
      where: { userId: auth.userId, type, externalId },
    });

    let note;
    if (existing) {
      note = await prisma.note.update({
        where: { id: existing.id },
        data: { content },
      });
    } else {
      note = await prisma.note.create({
        data: { userId: auth.userId, type, externalId, content },
      });
    }

    const dto: NoteDTO = {
      id: note.id,
      type: note.type as NoteDTO["type"],
      externalId: note.externalId,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: dto });
  } catch (error) {
    log.error("POST/PATCH failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to create note" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing note ID" },
        { status: 400 },
      );
    }

    const deleted = await prisma.note.deleteMany({
      where: { id, userId: auth.userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: "Note not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (error) {
    log.error("DELETE failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to delete note" },
      { status: 500 },
    );
  }
}
