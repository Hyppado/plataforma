/**
 * app/api/admin/echotik/regions/route.ts
 *
 * GET  — list all regions with their active state and sort order
 * PUT  — update a region (toggle isActive, change sortOrder)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/admin/echotik/regions");

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const regions = await prisma.region.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ regions });
  } catch (error) {
    log.error("GET failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load regions" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = await req.json();
    const { code, isActive, sortOrder } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "code is required and must be a string" },
        { status: 400 },
      );
    }

    const existing = await prisma.region.findUnique({ where: { code } });
    if (!existing) {
      return NextResponse.json(
        { error: `Region "${code}" not found` },
        { status: 404 },
      );
    }

    const update: { isActive?: boolean; sortOrder?: number } = {};
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (typeof sortOrder === "number") update.sortOrder = sortOrder;

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.region.update({
      where: { code },
      data: update,
    });

    log.info("Region updated", { code, ...update, updatedBy: auth.userId });
    return NextResponse.json({ region: updated });
  } catch (error) {
    log.error("PUT failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update region" },
      { status: 500 },
    );
  }
}
