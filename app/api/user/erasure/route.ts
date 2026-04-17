/**
 * POST /api/user/erasure — Solicita exclusão de dados pessoais (LGPD Art. 18, V)
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createErasureRequest } from "@/lib/lgpd/erasure";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const requestId = await createErasureRequest(auth.userId);

    return NextResponse.json(
      {
        requestId,
        message:
          "Sua solicitação de exclusão de dados foi registrada. " +
          "Ela será analisada em até 15 dias úteis conforme a LGPD.",
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
