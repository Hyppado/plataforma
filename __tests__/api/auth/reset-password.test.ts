/**
 * Tests: app/api/auth/reset-password/route.ts — Password reset request
 *
 * Priority: #1 (Security — no user enumeration, always 200)
 * Coverage: invalid body, missing email, success response, internal error handling
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock password reset service
const mockSendPasswordResetEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email/password-reset", () => ({
  sendPasswordResetEmail: (...args: unknown[]) =>
    mockSendPasswordResetEmail(...args),
}));

import { POST } from "@/app/api/auth/reset-password/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Email é obrigatório");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Email é obrigatório");
  });

  it("returns 200 with generic message for valid email (always, no enumeration)", async () => {
    const res = await POST(makeRequest({ email: "user@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("Se o email estiver cadastrado");
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
      email: "user@test.com",
    });
  });

  it("normalizes email to lowercase and trims", async () => {
    await POST(makeRequest({ email: "  USER@Test.COM  " }));

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
      email: "user@test.com",
    });
  });

  it("returns 200 even when service throws (no information leakage)", async () => {
    mockSendPasswordResetEmail.mockRejectedValueOnce(new Error("DB down"));

    const res = await POST(makeRequest({ email: "user@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("Se o email estiver cadastrado");
  });

  it("response does not reveal user existence", async () => {
    // Test with user that exists
    mockSendPasswordResetEmail.mockResolvedValueOnce({ ok: true });
    const res1 = await POST(makeRequest({ email: "exists@test.com" }));
    const body1 = await res1.json();

    // Test with user that doesn't exist
    mockSendPasswordResetEmail.mockResolvedValueOnce({
      ok: true,
      reason: "user_not_found",
    });
    const res2 = await POST(makeRequest({ email: "noexist@test.com" }));
    const body2 = await res2.json();

    // Both responses must be identical
    expect(res1.status).toBe(res2.status);
    expect(body1.message).toBe(body2.message);
  });
});
