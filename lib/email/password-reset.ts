/**
 * lib/email/password-reset.ts
 * Password reset email orchestrator — server-side only.
 *
 * Coordinates token generation + email sending for password reset requests.
 *
 * Security:
 * - NEVER reveals whether the email exists in the system.
 * - Always returns a consistent result shape regardless of user existence.
 * - Uses a 1-hour token expiry (RESET_TOKEN_EXPIRY_HOURS).
 * - Generating a new token overwrites any existing token (idempotent).
 * - Suspended, deleted, or inactive users are silently skipped.
 * - Rate limiting should be handled at the infrastructure level (Vercel).
 */

import { sendEmail } from "./client";
import { getEmailBaseUrl } from "./client";
import { generateSetupToken, RESET_TOKEN_EXPIRY_HOURS } from "./setup-token";
import { buildPasswordResetEmail } from "./templates";
import { createLogger } from "../logger";
import { prisma } from "../prisma";

const log = createLogger("email/password-reset");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendPasswordResetOptions {
  /** Email address provided by the user (case-insensitive). */
  email: string;
}

export interface SendPasswordResetResult {
  /**
   * Whether the operation completed without errors.
   * NOTE: This does NOT indicate whether an email was actually sent.
   * This is intentional — callers must not distinguish between
   * "user found" and "user not found" to prevent enumeration.
   */
  ok: boolean;
  /** Internal reason (logged, never exposed to the client). */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Send a password reset email.
 *
 * Business rules:
 * - Looks up user by email (case-insensitive).
 * - If user not found → silent success (no enumeration).
 * - If user is inactive/deleted/suspended → silent success (no enumeration).
 * - If user has no password yet → silent success (they should use onboarding flow).
 * - Otherwise generates a 1h reset token and sends the email.
 */
export async function sendPasswordResetEmail(
  options: SendPasswordResetOptions,
): Promise<SendPasswordResetResult> {
  const email = options.email.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { ok: false, reason: "invalid_email" };
  }

  // Look up user — select only what we need
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      passwordHash: true,
      deletedAt: true,
    },
  });

  // Silent success for all "not eligible" cases — prevent enumeration
  if (!user) {
    log.info("Password reset skipped — user not found", { email });
    return { ok: true, reason: "user_not_found" };
  }

  if (user.status !== "ACTIVE" || user.deletedAt) {
    log.info("Password reset skipped — user not active", {
      email,
      status: user.status,
    });
    return { ok: true, reason: "user_not_active" };
  }

  if (!user.passwordHash) {
    log.info("Password reset skipped — user has no password", { email });
    return { ok: true, reason: "no_password" };
  }

  // Generate a 1-hour reset token
  const rawToken = await generateSetupToken(user.id, RESET_TOKEN_EXPIRY_HOURS);

  // Build the reset URL — reuses /criar-senha with the same token mechanism
  const baseUrl = getEmailBaseUrl();
  const resetUrl = `${baseUrl}/criar-senha?token=${encodeURIComponent(rawToken)}`;

  // Build email content
  const displayName = user.name ?? user.email.split("@")[0];
  const { subject, html, text } = buildPasswordResetEmail({
    name: displayName,
    resetUrl,
    expiresInHours: RESET_TOKEN_EXPIRY_HOURS,
  });

  // Send
  const result = await sendEmail({
    to: user.email,
    subject,
    html,
    text,
  });

  if (result.success) {
    log.info("Password reset email sent", {
      userId: user.id,
      email: user.email,
      messageId: result.messageId,
    });
    return { ok: true };
  }

  log.error("Password reset email failed", {
    userId: user.id,
    email: user.email,
    error: result.error,
  });

  return { ok: false, reason: result.error ?? "send_failed" };
}
