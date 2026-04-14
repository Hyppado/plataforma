/**
 * app/api/me/password/route.ts
 *
 * PUT /api/me/password — Change the authenticated user's password.
 *
 * Body: { currentPassword: string, newPassword: string }
 *   - When mustChangePassword is true, currentPassword can be omitted
 *     (the user is forced to change a temporary password they may not want to re-enter).
 *
 * Security:
 *   - Requires active session (requireAuth)
 *   - Verifies currentPassword with bcrypt before updating (unless mustChangePassword)
 *   - New password min length: 8 characters
 *   - Clears mustChangePassword flag on success
 *   - Audit log: USER_PASSWORD_CHANGED
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;
const log = createLogger("api/me/password");

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = body;

  if (
    !newPassword ||
    typeof newPassword !== "string" ||
    newPassword.length < MIN_PASSWORD_LENGTH
  ) {
    return NextResponse.json(
      {
        error: `A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
      },
      { status: 400 },
    );
  }

  // Fetch user with current password hash and mustChangePassword flag
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, passwordHash: true, mustChangePassword: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 },
    );
  }

  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "Senha ainda não configurada. Use o link de primeiro acesso." },
      { status: 400 },
    );
  }

  // When mustChangePassword is true, user doesn't need to provide currentPassword
  // (they just logged in with the temporary one — forcing re-entry adds friction)
  if (!user.mustChangePassword) {
    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { error: "Senha atual é obrigatória" },
        { status: 400 },
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 403 },
      );
    }
  }

  // Hash and save new password, clear mustChangePassword
  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  // Audit trail
  await prisma.auditLog.create({
    data: {
      userId: auth.userId,
      actorId: auth.userId,
      action: "USER_PASSWORD_CHANGED",
      entityType: "User",
      entityId: auth.userId,
    },
  });

  log.info("Password changed", {
    userId: auth.userId,
    wasForced: user.mustChangePassword,
  });

  return NextResponse.json({ success: true });
}
