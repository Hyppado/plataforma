/**
 * lib/email/onboarding.ts
 * Onboarding email orchestrator — server-side only.
 *
 * Coordinates token generation + email sending for:
 * - Hotmart PURCHASE_APPROVED (new users without password)
 * - Admin-created users (optionally, when sendEmail flag is set)
 *
 * Duplicate protection:
 * - Only sends if the user has no passwordHash (needs first-access setup).
 * - If the user already has a password, the email is skipped.
 * - Generating a new token overwrites any existing token (idempotent).
 */

import { sendEmail } from "./client";
import {
  generateSetupToken,
  ONBOARDING_TOKEN_EXPIRY_HOURS,
} from "./setup-token";
import { buildOnboardingEmail } from "./templates";
import { createLogger } from "../logger";
import { prisma } from "../prisma";

const log = createLogger("email/onboarding");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendOnboardingEmailOptions {
  userId: string;
  /** If true, skips the passwordHash check and sends even if user already has a password.
   *  Used for admin-triggered "resend onboarding" scenarios. Default: false. */
  force?: boolean;
}

export interface SendOnboardingEmailResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Send an onboarding/first-access email to a user.
 *
 * Business rules:
 * - If user already has a passwordHash and force=false → skip (already onboarded).
 * - If user status is not ACTIVE → skip.
 * - Generates a secure setup token (overwrites any previous token).
 * - Sends the email with a link to /criar-senha?token=<raw_token>.
 * - Returns result indicating whether the email was sent and why.
 */
export async function sendOnboardingEmail(
  options: SendOnboardingEmailOptions,
): Promise<SendOnboardingEmailResult> {
  const { userId, force = false } = options;

  // Fetch user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      passwordHash: true,
      deletedAt: true,
    },
  });

  if (!user) {
    log.warn("Onboarding email skipped — user not found", { userId });
    return { sent: false, reason: "user_not_found" };
  }

  // Skip if user is not active
  if (user.status !== "ACTIVE" || user.deletedAt) {
    log.info("Onboarding email skipped — user not active", {
      userId,
      status: user.status,
    });
    return { sent: false, reason: "user_not_active" };
  }

  // Skip if user already has a password (already onboarded) unless forced
  if (user.passwordHash && !force) {
    log.info("Onboarding email skipped — user already has password", {
      userId,
    });
    return { sent: false, reason: "already_has_password" };
  }

  // Generate setup token
  const rawToken = await generateSetupToken(
    userId,
    ONBOARDING_TOKEN_EXPIRY_HOURS,
  );

  // Build the setup URL
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://hyppado.com";
  const setupUrl = `${baseUrl}/criar-senha?token=${encodeURIComponent(rawToken)}`;

  // Build email content
  const displayName = user.name ?? user.email.split("@")[0];
  const { subject, html, text } = buildOnboardingEmail({
    name: displayName,
    setupUrl,
    expiresInHours: ONBOARDING_TOKEN_EXPIRY_HOURS,
  });

  // Send
  const result = await sendEmail({
    to: user.email,
    subject,
    html,
    text,
  });

  if (result.success) {
    log.info("Onboarding email sent", {
      userId,
      email: user.email,
      messageId: result.messageId,
    });
    return { sent: true, messageId: result.messageId };
  }

  log.error("Onboarding email failed", {
    userId,
    email: user.email,
    error: result.error,
  });

  return { sent: false, reason: result.error ?? "send_failed" };
}
