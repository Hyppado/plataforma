/**
 * Tests: lib/email/client.ts — Resend email client
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Resend before importing the module
const mockSend = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

describe("sendEmail()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module to clear the singleton
    vi.resetModules();
  });

  it("returns failure when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    // Re-import to get fresh singleton state
    const { sendEmail } = await import("@/lib/email/client");

    const result = await sendEmail({
      to: "user@test.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Email delivery not configured");
  });

  it("sends email successfully via Resend", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValue({ data: { id: "msg-123" }, error: null });
    const { sendEmail } = await import("@/lib/email/client");

    const result = await sendEmail({
      to: "user@test.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg-123");
    expect(mockSend).toHaveBeenCalledWith({
      from: "Hyppado <suporte@hyppado.com>",
      to: "user@test.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
      replyTo: "suportehyppado@gmail.com",
    });
  });

  it("returns failure when Resend API returns an error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded" },
    });
    const { sendEmail } = await import("@/lib/email/client");

    const result = await sendEmail({
      to: "user@test.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Rate limit exceeded");
  });

  it("handles network errors gracefully", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockRejectedValue(new Error("Network timeout"));
    const { sendEmail } = await import("@/lib/email/client");

    const result = await sendEmail({
      to: "user@test.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network timeout");
  });

  it("uses custom replyTo when provided", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValue({ data: { id: "msg-456" }, error: null });
    const { sendEmail } = await import("@/lib/email/client");

    await sendEmail({
      to: "user@test.com",
      subject: "Test",
      html: "<p>Test</p>",
      replyTo: "custom@reply.com",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "custom@reply.com" }),
    );
  });
});
