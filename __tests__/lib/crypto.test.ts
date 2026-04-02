/**
 * Tests: lib/crypto.ts
 *
 * Coverage: encrypt/decrypt round-trip, tamper detection,
 *          missing encryption key fails closed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/crypto", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("encrypts and decrypts correctly (round-trip)", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret-key-for-encryption";
    const { encrypt, decrypt } = await import("@/lib/crypto");

    const plaintext = "sk-test-openai-api-key-12345";
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toBeTruthy();

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for same plaintext (random IV)", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret-key-for-encryption";
    const { encrypt } = await import("@/lib/crypto");

    const plaintext = "same-value";
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);

    expect(enc1).not.toBe(enc2); // Different IVs
  });

  it("detects tampered data", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret-key-for-encryption";
    const { encrypt, decrypt } = await import("@/lib/crypto");

    const encrypted = encrypt("original");
    // Tamper with the encrypted data
    const tampered =
      encrypted.slice(0, -4) + "XXXX";

    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects too-short data", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret-key-for-encryption";
    const { decrypt } = await import("@/lib/crypto");

    expect(() => decrypt("dG9vc2hvcnQ=")).toThrow("too short");
  });

  it("throws when no encryption key configured (fail closed)", async () => {
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    delete process.env.NEXTAUTH_SECRET;
    const { encrypt } = await import("@/lib/crypto");

    expect(() => encrypt("value")).toThrow("Encryption key not configured");
  });

  it("prefers SETTINGS_ENCRYPTION_KEY over NEXTAUTH_SECRET", async () => {
    process.env.SETTINGS_ENCRYPTION_KEY = "key-a";
    process.env.NEXTAUTH_SECRET = "key-b";
    const { encrypt, decrypt } = await import("@/lib/crypto");

    const encrypted = encrypt("test");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("test");

    // Now change SETTINGS_ENCRYPTION_KEY — should fail to decrypt
    vi.resetModules();
    process.env.SETTINGS_ENCRYPTION_KEY = "different-key";
    const crypto2 = await import("@/lib/crypto");

    expect(() => crypto2.decrypt(encrypted)).toThrow();
  });
});
