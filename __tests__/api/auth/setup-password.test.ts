/**
 * Tests: app/api/auth/setup-password/route.ts — token validation + password setting
 *
 * Coverage: token validation (GET), password setting (POST), security constraints,
 *           token consumption, audit trail, input validation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { makeGetRequest, makePostRequest } from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

// Mock setup-token module
const mockValidate = vi.fn();
const mockConsume = vi.fn();
vi.mock("@/lib/email/setup-token", () => ({
  validateSetupToken: (...args: unknown[]) => mockValidate(...args),
  consumeSetupToken: (...args: unknown[]) => mockConsume(...args),
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$10$hashedpassword"),
  },
}));

import { GET, POST } from "@/app/api/auth/setup-password/route";

// ---------------------------------------------------------------------------
// GET — Token preflight validation
// ---------------------------------------------------------------------------

describe("GET /api/auth/setup-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when token is missing", async () => {
    const req = makeGetRequest("/api/auth/setup-password");
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("missing_token");
  });

  it("returns valid=false when token is invalid", async () => {
    mockValidate.mockResolvedValue({ valid: false, reason: "invalid" });

    const req = makeGetRequest("/api/auth/setup-password", { token: "bad" });
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("invalid");
  });

  it("returns valid=false when token is expired", async () => {
    mockValidate.mockResolvedValue({ valid: false, reason: "expired" });

    const req = makeGetRequest("/api/auth/setup-password", {
      token: "expired-token",
    });
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("expired");
  });

  it("returns valid=true with email for a correct token", async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      userId: "u1",
      email: "user@test.com",
    });

    const req = makeGetRequest("/api/auth/setup-password", {
      token: "good-token",
    });
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.email).toBe("user@test.com");
  });

  it("does not return userId to the client (prevent enumeration)", async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      userId: "u1",
      email: "user@test.com",
    });

    const req = makeGetRequest("/api/auth/setup-password", {
      token: "good-token",
    });
    const res = await GET(req as never);
    const body = await res.json();

    expect(body.userId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// POST — Set password
// ---------------------------------------------------------------------------

describe("POST /api/auth/setup-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsume.mockResolvedValue(undefined);
    prismaMock.auditLog.create.mockResolvedValue({} as never);
  });

  it("returns 400 for missing body", async () => {
    const req = new Request("http://localhost/api/auth/setup-password", {
      method: "POST",
      body: "not json",
    }) as never;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is missing", async () => {
    const req = makePostRequest("/api/auth/setup-password", {
      password: "validpass123",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const req = makePostRequest("/api/auth/setup-password", {
      token: "some-token",
      password: "short",
    });
    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("8");
  });

  it("returns 400 when password is missing", async () => {
    const req = makePostRequest("/api/auth/setup-password", {
      token: "some-token",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid/expired token (generic error)", async () => {
    mockValidate.mockResolvedValue({ valid: false, reason: "expired" });

    const req = makePostRequest("/api/auth/setup-password", {
      token: "expired-token",
      password: "validpassword123",
    });
    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    // Must be generic — no specific reason exposed
    expect(body.error).toBe("Invalid or expired token");
  });

  it("sets password successfully and consumes token", async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      userId: "u1",
      email: "user@test.com",
    });

    const req = makePostRequest("/api/auth/setup-password", {
      token: "valid-token",
      password: "mysecurepassword",
    });
    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Token consumed with hashed password
    expect(mockConsume).toHaveBeenCalledWith("u1", "$2a$10$hashedpassword");
  });

  it("creates audit log entry after password set", async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      userId: "u1",
      email: "user@test.com",
    });

    const req = makePostRequest("/api/auth/setup-password", {
      token: "valid-token",
      password: "mysecurepassword",
    });
    await POST(req as never);

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        actorId: "u1",
        action: "USER_PASSWORD_SETUP",
        entityType: "User",
        entityId: "u1",
      }),
    });
  });
});
