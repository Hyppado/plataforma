import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/saved");
import type { SavedItemDTO } from "@/lib/types/dto";

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

    const where = {
      userId: auth.userId,
      ...(type ? { type } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.savedItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.savedItem.count({ where }),
    ]);

    const dtos: SavedItemDTO[] = items.map((s) => ({
      id: s.id,
      type: s.type as SavedItemDTO["type"],
      externalId: s.externalId,
      title: s.title,
      meta: (s.metaJson as SavedItemDTO["meta"]) ?? undefined,
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: { items: dtos, total } });
  } catch (error) {
    log.error("GET failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: "Failed to fetch saved items" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await request.json();
    const { type, externalId, title, meta } = body;

    if (!type || !externalId || !title) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const item = await prisma.savedItem.upsert({
      where: {
        userId_type_externalId: { userId: auth.userId, type, externalId },
      },
      create: {
        userId: auth.userId,
        type,
        externalId,
        title,
        metaJson: meta ?? undefined,
      },
      update: { title, metaJson: meta ?? undefined },
    });

    const dto: SavedItemDTO = {
      id: item.id,
      type: item.type as SavedItemDTO["type"],
      externalId: item.externalId,
      title: item.title,
      meta: (item.metaJson as SavedItemDTO["meta"]) ?? undefined,
      createdAt: item.createdAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: dto });
  } catch (error) {
    log.error("POST failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: "Failed to save item" },
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
        { success: false, error: "Missing item ID" },
        { status: 400 },
      );
    }

    const deleted = await prisma.savedItem.deleteMany({
      where: { id, userId: auth.userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: "Saved item not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (error) {
    log.error("DELETE failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: "Failed to delete item" },
      { status: 500 },
    );
  }
}
