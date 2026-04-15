/**
 * Tests: lib/email/onboarding.ts — onboarding email orchestrator
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
  generateSetupToken: vi.fn().mockResolvedValue("raw-token-123"),
  ONBOARDING_TOKEN_EXPIRY_HOURS: 24,
}));

import { sendOnboardingEmail } from "@/lib/email/onboarding";
import { sendEmail } from "@/lib/email/client";
import { generateSetupToken } from "@/lib/email/setup-token";

describe("sendOnboardingEmail()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "https://hyppado.com";
  });

  it("skips when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await sendOnboardingEmail({ userId: "nonexistent" });

    expect(result).toEqual({ sent: false, reason: "user_not_found" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips when user is not ACTIVE", async () => {
    const user = buildUser({ status: "SUSPENDED" });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendOnboardingEmail({ userId: user.id });

    expect(result).toEqual({ sent: false, reason: "user_not_active" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips when user is soft-deleted", async () => {
    const user = buildUser({ status: "ACTIVE", deletedAt: new Date() });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendOnboardingEmail({ userId: user.id });

    expect(result).toEqual({ sent: false, reason: "user_not_active" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips when user already has password (duplicate protection)", async () => {
    const user = buildUser({
      passwordHash: "$2a$10$existinghash",
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendOnboardingEmail({ userId: user.id });

    expect(result).toEqual({ sent: false, reason: "already_has_password" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(generateSetupToken).not.toHaveBeenCalled();
  });

  it("sends onboarding email for user without password", async () => {
    const user = buildUser({
      id: "user-new",
      email: "newuser@test.com",
      name: "New User",
      passwordHash: null,
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendOnboardingEmail({ userId: "user-new" });

    expect(result).toEqual({ sent: true, messageId: "msg-1" });

    // Token was generated
    expect(generateSetupToken).toHaveBeenCalledWith("user-new", 24);

    // Email was sent with correct params
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "newuser@test.com",
        subject: expect.stringContaining("Hyppado"),
        html: expect.stringContaining("Criar minha senha"),
        text: expect.stringContaining("raw-token-123"),
      }),
    );
  });

  it("sends when force=true even if user has password", async () => {
    const user = buildUser({
      id: "user-admin-created",
      email: "admin-created@test.com",
      passwordHash: "$2a$10$hash",
    });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    const result = await sendOnboardingEmail({
      userId: "user-admin-created",
      force: true,
    });

    expect(result.sent).toBe(true);
    expect(generateSetupToken).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it("returns failure when sendEmail fails", async () => {
    const user = buildUser({ passwordHash: null });
    prismaMock.user.findUnique.mockResolvedValue(user as never);
    vi.mocked(sendEmail).mockResolvedValueOnce({
      success: false,
      error: "Resend error",
    });

    const result = await sendOnboardingEmail({ userId: user.id });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Resend error");
  });

  it("includes correct URL with token", async () => {
    const user = buildUser({ passwordHash: null, email: "test@test.com" });
    prismaMock.user.findUnique.mockResolvedValue(user as never);

    await sendOnboardingEmail({ userId: user.id });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain(
      "https://hyppado.com/criar-senha?token=raw-token-123",
    );
  });
});
