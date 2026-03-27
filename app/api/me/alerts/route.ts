import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import type { AlertDTO } from "@/lib/types/dto";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/alerts");

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100,
    );
    const unreadOnly = searchParams.get("unread") === "true";

    const where = {
      userId: auth.userId,
      ...(unreadOnly ? { read: false } : {}),
    };

    const [items, total, unreadCount] = await prisma.$transaction([
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.alert.count({ where: { userId: auth.userId } }),
      prisma.alert.count({ where: { userId: auth.userId, read: false } }),
    ]);

    const dtos: AlertDTO[] = items.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description ?? undefined,
      severity: a.severity as AlertDTO["severity"],
      type: a.type as AlertDTO["type"],
      payload: (a.payloadJson as AlertDTO["payload"]) ?? undefined,
      read: a.read,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: { items: dtos, total, unreadCount },
    });
  } catch (error) {
    log.error("GET failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: "Failed to fetch alerts" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await request.json();
    const { id, read } = body;

    if (!id || typeof read !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Alert ID and read boolean are required" },
        { status: 400 },
      );
    }

    const updated = await prisma.alert.updateMany({
      where: { id, userId: auth.userId },
      data: { read },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: { id, read } });
  } catch (error) {
    log.error("PATCH failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: "Failed to update alert" },
      { status: 500 },
    );
  }
}
