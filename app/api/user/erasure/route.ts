/**
 * POST /api/user/erasure — Solicita exclusão de dados pessoais (LGPD Art. 18, V)
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createErasureRequest } from "@/lib/lgpd/erasure";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const requestId = await createErasureRequest(userId);

  return NextResponse.json(
    {
      requestId,
      message:
        "Sua solicitação de exclusão de dados foi registrada. " +
        "Ela será analisada em até 15 dias úteis conforme a LGPD.",
    },
    { status: 201 },
  );
}
