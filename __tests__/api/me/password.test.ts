/**
 * Tests: app/api/me/password/route.ts — User password change
 *
 * Priority: #1 (Security — password handling)
 * Coverage: auth enforcement, validation, wrong current password,
 *           missing passwordHash, success flow, audit trail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

// Mock bcryptjs
const mockCompare = vi.fn();
const mockHash = vi.fn();
vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
    hash: (...args: unknown[]) => mockHash(...args),
  },
}));

import { PUT } from "@/app/api/me/password/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/me/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PUT /api/me/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue("$2a$10$newhash");
    prismaMock.auditLog.create.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue({} as never);
  });

  // -------------------------------------------------------------------------
  // Auth enforcement
  // -------------------------------------------------------------------------

  it("returns 401 for unauthenticated request", async () => {
    mockUnauthenticated();
    const res = await PUT(
      makePutRequest({ currentPassword: "old", newPassword: "newpass123" }),
    );
    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("returns 400 when currentPassword is missing (normal user)", async () => {
    mockAuthenticatedUser();
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-test-id",
      passwordHash: "$2a$10$existinghash",
      mustChangePassword: false,
    } as never);

    const res = await PUT(makePutRequest({ newPassword: "newpass123" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Senha atual é obrigatória");
  });

  it("returns 400 when newPassword is missing", async () => {
    mockAuthenticatedUser();
    const res = await PUT(makePutRequest({ currentPassword: "oldpass" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("pelo menos 8 caracteres");
  });

  it("returns 400 when newPassword is too short", async () => {
    mockAuthenticatedUser();
    const res = await PUT(
      makePutRequest({ currentPassword: "old", newPassword: "abc" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("pelo menos 8 caracteres");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockAuthenticatedUser();
    const req = new NextRequest("http://localhost/api/me/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Corpo da requisição inválido");
  });

  // -------------------------------------------------------------------------
  // User not found
  // -------------------------------------------------------------------------

  it("returns 404 when user is not found", async () => {
    mockAuthenticatedUser();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await PUT(
      makePutRequest({ currentPassword: "old", newPassword: "newpass123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Usuário não encontrado");
  });

  // -------------------------------------------------------------------------
  // No password set
  // -------------------------------------------------------------------------

  it("returns 400 when user has no passwordHash", async () => {
    mockAuthenticatedUser();
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-test-id",
      passwordHash: null,
      mustChangePassword: false,
    } as never);

    const res = await PUT(
      makePutRequest({ currentPassword: "old", newPassword: "newpass123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Senha ainda não configurada");
  });

  // -------------------------------------------------------------------------
  // Wrong current password
  // -------------------------------------------------------------------------

  it("returns 403 when current password is incorrect", async () => {
    mockAuthenticatedUser();
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-test-id",
      passwordHash: "$2a$10$existinghash",
      mustChangePassword: false,
    } as never);
    mockCompare.mockResolvedValue(false);

    const res = await PUT(
      makePutRequest({ currentPassword: "wrong", newPassword: "newpass123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Senha atual incorreta");
  });

  // -------------------------------------------------------------------------
  // Success flow
  // -------------------------------------------------------------------------

  it("changes password and creates audit log on success", async () => {
    mockAuthenticatedUser();
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-test-id",
      passwordHash: "$2a$10$existinghash",
      mustChangePassword: false,
    } as never);
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue("$2a$10$freshnewhash");

    const res = await PUT(
      makePutRequest({ currentPassword: "correct", newPassword: "newpass123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Verify bcrypt was called correctly
    expect(mockCompare).toHaveBeenCalledWith("correct", "$2a$10$existinghash");
    expect(mockHash).toHaveBeenCalledWith("newpass123", 10);

    // Verify user update clears mustChangePassword
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-test-id" },
      data: { passwordHash: "$2a$10$freshnewhash", mustChangePassword: false },
    });

    // Verify audit log
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-test-id",
        action: "USER_PASSWORD_CHANGED",
        entityType: "User",
      }),
    });
  });

  // -------------------------------------------------------------------------
  // mustChangePassword flow (temporary password)
  // -------------------------------------------------------------------------

  it("allows password change without currentPassword when mustChangePassword=true", async () => {
    mockAuthenticatedUser();
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-test-id",
      passwordHash: "$2a$10$temphash",
      mustChangePassword: true,
    } as never);
    mockHash.mockResolvedValue("$2a$10$permanenthash");

    const res = await PUT(makePutRequest({ newPassword: "permanent123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Should NOT call bcrypt.compare (no current password to verify)
    expect(mockCompare).not.toHaveBeenCalled();

    // Should clear mustChangePassword
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-test-id" },
      data: {
        passwordHash: "$2a$10$permanenthash",
        mustChangePassword: false,
      },
    });
  });
});
