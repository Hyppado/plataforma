/**
 * POST /api/user/consent — Registra consentimento LGPD
 * POST /api/user/erasure  — Solicita exclusão de dados (LGPD)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createErasureRequest } from "@/lib/lgpd/erasure";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/user/consent — Registra consentimento
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const userId = auth.userId;

  const body = await req.json();
  const { consentType, version, granted } = body as {
    consentType?: string;
    version?: string;
    granted?: boolean;
  };

  if (!consentType || !version) {
    return NextResponse.json(
      { error: "consentType and version are required" },
      { status: 400 },
    );
  }

  // Get IP and User-Agent from headers
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const record = await prisma.consentRecord.create({
    data: {
      userId,
      consentType,
      version,
      granted: granted !== false, // default true
      ipAddress,
      userAgent,
    },
  });

  // Update user's consent timestamp
  await prisma.user.update({
    where: { id: userId },
    data: {
      lgpdConsentAt: new Date(),
      lgpdConsentVersion: version,
    },
  });

  return NextResponse.json({ id: record.id }, { status: 201 });
}
