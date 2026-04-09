/**
 * lib/email/setup-token.ts
 * Secure password setup / reset token service — server-side only.
 *
 * Token flow:
 * 1. generateSetupToken(userId) → creates a cryptographic random token,
 *    stores SHA-256 hash + expiry in User.setupToken / setupTokenExpiresAt.
 * 2. The raw (unhashed) token is included in the email link.
 * 3. validateSetupToken(token) → hashes the incoming token, looks up User
 *    by hash, verifies expiry, returns the user.
 * 4. consumeSetupToken(userId, newPasswordHash) → sets the password and
 *    clears the token fields atomically.
 *
 * Security properties:
 * - Token is a 32-byte cryptographic random value (URL-safe base64).
 * - Only the SHA-256 hash is stored — raw token exists only in the email link.
 * - Token is one-time use (cleared on consumption).
 * - Token has a configurable expiry (default: 24h for onboarding, 1h for reset).
 * - Lookup by hash uses the @unique index on setupToken for O(1) lookups.
 */

import { randomBytes, createHash } from "crypto";
import { prisma } from "../prisma";
import { createLogger } from "../logger";

const log = createLogger("email/setup-token");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Token expiry for onboarding emails (first access) — 24 hours */
export const ONBOARDING_TOKEN_EXPIRY_HOURS = 24;

/** Token expiry for password reset — 1 hour */
export const RESET_TOKEN_EXPIRY_HOURS = 1;

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * Hash a raw token to produce the stored value.
 * SHA-256 is sufficient here — the token has high entropy (32 bytes).
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generate a setup token for a user and persist the hash + expiry.
 *
 * @returns The raw (unhashed) token to include in the email link.
 */
export async function generateSetupToken(
  userId: string,
  expiryHours: number = ONBOARDING_TOKEN_EXPIRY_HOURS,
): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  const hashed = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      setupToken: hashed,
      setupTokenExpiresAt: expiresAt,
    },
  });

  log.info("Setup token generated", { userId, expiryHours });

  return rawToken;
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  email?: string;
  reason?: "invalid" | "expired" | "inactive";
}

/**
 * Validate a raw setup token.
 *
 * Hashes the input, looks up the user by the hash, checks expiry and status.
 * Does NOT consume the token — call consumeSetupToken after password is set.
 */
export async function validateSetupToken(
  rawToken: string,
): Promise<TokenValidationResult> {
  if (!rawToken || rawToken.length < 10) {
    return { valid: false, reason: "invalid" };
  }

  const hashed = hashToken(rawToken);

  const user = await prisma.user.findUnique({
    where: { setupToken: hashed },
    select: {
      id: true,
      email: true,
      status: true,
      deletedAt: true,
      setupTokenExpiresAt: true,
    },
  });

  if (!user) {
    return { valid: false, reason: "invalid" };
  }

  // Check expiry
  if (!user.setupTokenExpiresAt || user.setupTokenExpiresAt < new Date()) {
    log.info("Setup token expired", { userId: user.id });
    return { valid: false, reason: "expired" };
  }

  // Check user status
  if (user.status !== "ACTIVE" || user.deletedAt) {
    log.warn("Setup token for inactive/deleted user", { userId: user.id });
    return { valid: false, reason: "inactive" };
  }

  return { valid: true, userId: user.id, email: user.email };
}

// ---------------------------------------------------------------------------
// Token consumption
// ---------------------------------------------------------------------------

/**
 * Consume a setup token: set the password and clear token fields atomically.
 *
 * This is the final step — after the user submits their new password.
 */
export async function consumeSetupToken(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      setupToken: null,
      setupTokenExpiresAt: null,
    },
  });

  log.info("Setup token consumed — password set", { userId });
}
