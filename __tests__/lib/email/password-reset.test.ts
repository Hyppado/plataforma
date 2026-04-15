/**
 * Tests: lib/email/password-reset.ts — password reset email orchestrator
 *
 * Priority: #1 (Security — no user enumeration)
 * Coverage: missing user, inactive user, no password, success, email failure
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { buildUser } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

// Mock email client
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "msg-1" }),
  EMAIL_FROM: "Hyppado <suporte@hyppado.com>",
  EMAIL_REPLY_TO: "suportehyppado@gmail.com",
  getEmailBaseUrl: vi
    .fn()
    .mockImplementation(
      () => process.env.NEXTAUTH_URL ?? "https://hyppado.com",
    ),
}));

// Mock setup-token
vi.mock("@/lib/email/setup-token", () => ({
  generateSetupToken: vi.fn().mockResolvedValue("raw-reset-token-456"),
  RESET_TOKEN_EXPIRY_HOURS: 1,
}));

import { sendPasswordResetEmail } from "@/lib/email/password-reset";
import { sendEmail } from "@/lib/email/client";
import { generateSetupToken } from "@/lib/email/setup-token";

describe("sendPasswordResetEmail()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "https://hyppado.com";
  });

  it("returns ok:false for invalid email", async () => {
    const result = await sendPasswordResetEmail({ email: "not-an-email" });

    expect(result).toEqual({ ok: false, reason: "invalid_email" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns ok:true when user not found (no enumeration)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await sendPasswordResetEmail({
      email: "unknown@test.com",
    });

    expect(result.ok).toBe(true);
    expect(result.reason).toBe("user_not_found");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns ok:true when user is not active (no enumeration)", async () => {
    const user = buildUser({
      status: "SUSPENDED",
      email: "suspended@test.com",
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendPasswordResetEmail({
      email: "suspended@test.com",
    });

    expect(result.ok).toBe(true);
    expect(result.reason).toBe("user_not_active");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns ok:true when user is soft-deleted (no enumeration)", async () => {
    const user = buildUser({
      status: "ACTIVE",
      deletedAt: new Date(),
      email: "deleted@test.com",
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendPasswordResetEmail({
      email: "deleted@test.com",
    });

    expect(result.ok).toBe(true);
    expect(result.reason).toBe("user_not_active");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns ok:true when user has no password (no enumeration)", async () => {
    const user = buildUser({
      passwordHash: null,
      email: "nopass@test.com",
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendPasswordResetEmail({ email: "nopass@test.com" });

    expect(result.ok).toBe(true);
    expect(result.reason).toBe("no_password");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends reset email for eligible user", async () => {
    const user = buildUser({
      id: "user-reset",
      email: "user@test.com",
      name: "Test User",
      passwordHash: "$2a$10$existinghash",
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendPasswordResetEmail({ email: "user@test.com" });

    expect(result).toEqual({ ok: true });

    // Token was generated with 1h expiry
    expect(generateSetupToken).toHaveBeenCalledWith("user-reset", 1);

    // Email was sent with correct params
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: expect.stringContaining("Redefinir"),
        html: expect.stringContaining("Redefinir minha senha"),
        text: expect.stringContaining("raw-reset-token-456"),
      }),
    );
  });

  it("includes correct reset URL with token", async () => {
    const user = buildUser({
      email: "url@test.com",
      passwordHash: "$2a$10$hash",
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    await sendPasswordResetEmail({ email: "url@test.com" });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain(
      "https://hyppado.com/criar-senha?token=raw-reset-token-456",
    );
  });

  it("returns ok:false when email delivery fails", async () => {
    const user = buildUser({
      email: "fail@test.com",
      passwordHash: "$2a$10$hash",
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);
    vi.mocked(sendEmail).mockResolvedValueOnce({
      success: false,
      error: "Resend error",
    });

    const result = await sendPasswordResetEmail({ email: "fail@test.com" });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Resend error");
  });

  it("normalizes email to lowercase", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await sendPasswordResetEmail({ email: "  USER@Test.COM  " });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@test.com" },
      select: expect.any(Object),
    });
  });
});
