/**
 * lib/crypto.ts
 *
 * AES-256-GCM encryption/decryption for secret settings.
 * The encryption key is derived from SETTINGS_ENCRYPTION_KEY env var,
 * or falls back to NEXTAUTH_SECRET (first 32 bytes, SHA-256 hashed).
 *
 * Never log or expose the key, IV, or plaintext secrets.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits per NIST recommendation
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the configured secret.
 * Priority: SETTINGS_ENCRYPTION_KEY → NEXTAUTH_SECRET (hashed)
 * Throws if neither is configured (fail closed).
 */
function getEncryptionKey(): Buffer {
  const raw =
    process.env.SETTINGS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;

  if (!raw) {
    throw new Error(
      "Encryption key not configured (SETTINGS_ENCRYPTION_KEY or NEXTAUTH_SECRET required)",
    );
  }

  // Hash to exactly 32 bytes regardless of input length
  return createHash("sha256").update(raw).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64 string: iv + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv (12B) + authTag (16B) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts a base64 string produced by `encrypt()`.
 * Returns the original plaintext.
 * Throws on tampered or invalid data.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short");
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
