import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/collections");
import type { CollectionDTO } from "@/lib/types/dto";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100,
    );

    const [items, total] = await prisma.$transaction([
      prisma.collection.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { _count: { select: { items: true } } },
      }),
      prisma.collection.count({ where: { userId: auth.userId } }),
    ]);

    const dtos: CollectionDTO[] = items.map((c) => ({
      id: c.id,
      name: c.name,
      itemCount: c._count.items,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: { items: dtos, total } });
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch collections" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Collection name is required" },
        { status: 400 },
      );
    }

    const collection = await prisma.collection.create({
      data: { userId: auth.userId, name: name.trim() },
      include: { _count: { select: { items: true } } },
    });

    const dto: CollectionDTO = {
      id: collection.id,
      name: collection.name,
      itemCount: collection._count.items,
      createdAt: collection.createdAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: dto });
  } catch (error) {
    log.error("POST failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to create collection" },
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
        { success: false, error: "Missing collection ID" },
        { status: 400 },
      );
    }

    const deleted = await prisma.collection.deleteMany({
      where: { id, userId: auth.userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: "Collection not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (error) {
    log.error("DELETE failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to delete collection" },
      { status: 500 },
    );
  }
}
