/**
 * Tests: lib/email/setup-token.ts — secure token generation, validation, consumption
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { buildUser } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

import {
  hashToken,
  generateSetupToken,
  validateSetupToken,
  consumeSetupToken,
} from "@/lib/email/setup-token";

describe("hashToken()", () => {
  it("returns a deterministic SHA-256 hex string", () => {
    const hash = hashToken("test-token-123");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Same input → same output
    expect(hashToken("test-token-123")).toBe(hash);
  });

  it("returns different hashes for different inputs", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });
});

describe("generateSetupToken()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({} as never);
  });

  it("returns a raw token string and persists hash + expiry", async () => {
    const rawToken = await generateSetupToken("user-1", 24);

    expect(rawToken).toBeTruthy();
    expect(rawToken.length).toBeGreaterThan(20);

    // Verify user.update was called with hashed token + expiry
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        setupToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        setupTokenExpiresAt: expect.any(Date),
      },
    });

    // Expiry should be ~24h in the future
    const call = prismaMock.user.update.mock.calls[0][0];
    const expiry = (call.data as { setupTokenExpiresAt: Date })
      .setupTokenExpiresAt;
    const hours = (expiry.getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
  });

  it("stored hash matches hashToken(rawToken)", async () => {
    const rawToken = await generateSetupToken("user-1", 1);
    const expectedHash = hashToken(rawToken);

    const call = prismaMock.user.update.mock.calls[0][0];
    expect((call.data as { setupToken: string }).setupToken).toBe(expectedHash);
  });
});

describe("validateSetupToken()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invalid for empty/short token", async () => {
    expect(await validateSetupToken("")).toEqual({
      valid: false,
      reason: "invalid",
    });
    expect(await validateSetupToken("short")).toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("returns invalid when no user found by hash", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await validateSetupToken("some-long-enough-token-value");
    expect(result).toEqual({ valid: false, reason: "invalid" });
  });

  it("returns expired when token is past expiry", async () => {
    const user = buildUser({
      setupTokenExpiresAt: new Date(Date.now() - 60000), // expired 1 min ago
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await validateSetupToken("some-long-enough-token-value");
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("returns inactive when user is not ACTIVE", async () => {
    const user = buildUser({
      status: "SUSPENDED",
      setupTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await validateSetupToken("some-long-enough-token-value");
    expect(result).toEqual({ valid: false, reason: "inactive" });
  });

  it("returns inactive when user is soft-deleted", async () => {
    const user = buildUser({
      status: "ACTIVE",
      deletedAt: new Date(),
      setupTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await validateSetupToken("some-long-enough-token-value");
    expect(result).toEqual({ valid: false, reason: "inactive" });
  });

  it("returns valid for a correct, non-expired token on active user", async () => {
    const user = buildUser({
      id: "user-42",
      email: "valid@test.com",
      status: "ACTIVE",
      deletedAt: null,
      setupTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await validateSetupToken("some-long-enough-token-value");
    expect(result).toEqual({
      valid: true,
      userId: "user-42",
      email: "valid@test.com",
    });
  });
});

describe("consumeSetupToken()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({} as never);
  });

  it("sets passwordHash and clears token fields", async () => {
    await consumeSetupToken("user-1", "$2a$10$somehash");

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "$2a$10$somehash",
        setupToken: null,
        setupTokenExpiresAt: null,
      },
    });
  });
});
