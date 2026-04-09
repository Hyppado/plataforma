/**
 * POST /api/auth/setup-password — Validate token and set password
 *
 * Accepts { token, password } and:
 * 1. Validates the setup token (hash lookup + expiry check)
 * 2. Hashes the new password with bcrypt
 * 3. Consumes the token (sets password + clears token atomically)
 * 4. Creates an audit log entry
 *
 * Security:
 * - Token is hashed before lookup (raw token never stored)
 * - One-time use (cleared after consumption)
 * - Does not reveal whether email/user exists on failure
 * - Password requirements enforced server-side
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { validateSetupToken, consumeSetupToken } from "@/lib/email/setup-token";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token, password } = body as { token?: string; password?: string };

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  if (
    !password ||
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH
  ) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  // Validate token
  const validation = await validateSetupToken(token);

  if (!validation.valid || !validation.userId) {
    // Generic error — do not reveal reason to prevent enumeration
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  // Hash password and consume token atomically
  const passwordHash = await bcrypt.hash(password, 10);
  await consumeSetupToken(validation.userId, passwordHash);

  // Audit trail
  await prisma.auditLog.create({
    data: {
      userId: validation.userId,
      actorId: validation.userId,
      action: "USER_PASSWORD_SETUP",
      entityType: "User",
      entityId: validation.userId,
    },
  });

  return NextResponse.json({ success: true });
}

/**
 * GET /api/auth/setup-password?token=<raw_token> — Validate token (preflight)
 *
 * Used by the /criar-senha page to check if the token is valid
 * before showing the password form. Does not consume the token.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { valid: false, reason: "missing_token" },
      { status: 400 },
    );
  }

  const validation = await validateSetupToken(token);

  if (!validation.valid) {
    return NextResponse.json(
      { valid: false, reason: validation.reason ?? "invalid" },
      { status: 400 },
    );
  }

  // Return only validity + email for display (no sensitive data)
  return NextResponse.json({
    valid: true,
    email: validation.email,
  });
}
