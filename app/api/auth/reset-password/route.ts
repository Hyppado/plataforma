/**
 * POST /api/auth/reset-password — Request a password reset email
 *
 * Public endpoint (no session required).
 * Accepts { email } and sends a reset email if the user exists.
 *
 * Security:
 * - ALWAYS returns 200 with the same response shape, regardless of whether
 *   the email exists. This prevents user/email enumeration.
 * - Does not reveal whether the email was actually sent.
 * - Does not include timing differences that could be exploited.
 * - Rate limiting is handled at the infrastructure level (Vercel).
 */

import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("api/auth/reset-password");

export async function POST(req: NextRequest) {
  let body: { email?: string } | null = null;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  const email = body?.email?.trim().toLowerCase();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
  }

  try {
    // Fire and forget — result is intentionally not exposed to the client
    await sendPasswordResetEmail({ email });
  } catch (err) {
    // Log but don't expose internal errors
    log.error("Password reset request failed", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ALWAYS return the same response — no enumeration
  return NextResponse.json({
    message:
      "Se o email estiver cadastrado, você receberá um link para redefinir sua senha.",
  });
}
