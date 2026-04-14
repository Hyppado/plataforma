/**
 * Tests: app/api/admin/users/[id]/route.ts — DELETE (user deletion)
 *
 * Priority: #1 (Security — data integrity, subscriber protection)
 * Coverage: auth enforcement, subscriber protection, self-deletion prevention,
 *           non-subscriber deletion, audit trail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  mockAuthenticatedUser,
  makeDeleteRequest,
  makePostRequest,
} from "@tests/helpers/auth";
import { buildUser } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock resolveUserAccess (needed for GET import resolution)
vi.mock("@/lib/access/resolver", () => ({
  resolveUserAccess: vi.fn().mockResolvedValue({
    status: "no_access",
    source: "none",
    plan: null,
    expiresAt: null,
    reason: "no subscription",
    quotas: null,
  }),
}));

// Mock bcryptjs (needed for POST import resolution)
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$10$mockhash"),
  },
}));

// Mock email sending (needed for POST)
const { sendEmailMock, buildWelcomePasswordEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi
    .fn()
    .mockResolvedValue({ success: true, messageId: "msg-1" }),
  buildWelcomePasswordEmailMock: vi.fn().mockReturnValue({
    subject: "Seu acesso ao Hyppado — Senha temporária",
    html: "<html>mock</html>",
    text: "mock text",
  }),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
  buildWelcomePasswordEmail: buildWelcomePasswordEmailMock,
}));

import { DELETE, POST } from "@/app/api/admin/users/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callDelete(id: string) {
  const req = makeDeleteRequest(`/api/admin/users/${id}`);
  return DELETE(req, { params: Promise.resolve({ id }) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.auditLog.create.mockResolvedValue({} as never);
  });

  // -----------------------------------------------------------------------
  // Auth enforcement
  // -----------------------------------------------------------------------

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const res = await callDelete("some-id");
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuthenticatedUser();
    const res = await callDelete("some-id");
    expect(res.status).toBe(403);
  });

  // -----------------------------------------------------------------------
  // Self-deletion prevention
  // -----------------------------------------------------------------------

  it("returns 400 when admin tries to delete themselves", async () => {
    mockAuthenticatedAdmin({ id: "admin-test-id" });
    const res = await callDelete("admin-test-id");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("própria conta");
  });

  // -----------------------------------------------------------------------
  // User not found
  // -----------------------------------------------------------------------

  it("returns 404 when user does not exist", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await callDelete("nonexistent");
    expect(res.status).toBe(404);
  });

  // -----------------------------------------------------------------------
  // Subscriber protection
  // -----------------------------------------------------------------------

  it("returns 403 when user has subscriptions (subscriber)", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "sub-user" });
    prismaMock.user.findUnique.mockResolvedValue({
      ...user,
      subscriptions: [{ id: "sub-1", status: "ACTIVE" }],
    } as never);

    const res = await callDelete("sub-user");
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("Assinantes não podem ser excluídos");
  });

  it("returns 403 even for cancelled subscriptions (history preserved)", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "cancelled-user" });
    prismaMock.user.findUnique.mockResolvedValue({
      ...user,
      subscriptions: [{ id: "sub-2", status: "CANCELLED" }],
    } as never);

    const res = await callDelete("cancelled-user");
    expect(res.status).toBe(403);
  });

  // -----------------------------------------------------------------------
  // Successful deletion (non-subscriber)
  // -----------------------------------------------------------------------

  it("deletes non-subscriber user and creates audit log", async () => {
    mockAuthenticatedAdmin({ id: "admin-1" });
    const user = buildUser({
      id: "manual-user",
      email: "manual@test.com",
      name: "Manual User",
    });
    prismaMock.user.findUnique.mockResolvedValue({
      ...user,
      subscriptions: [],
    } as never);

    // Mock transaction
    const txMock = {
      usageEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      usagePeriod: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      accessGrant: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      user: { delete: vi.fn().mockResolvedValue(user) },
    };
    prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
      return (fn as (tx: typeof txMock) => Promise<unknown>)(txMock);
    });

    const res = await callDelete("manual-user");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Verify cascade cleanup was called
    expect(txMock.usageEvent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "manual-user" },
    });
    expect(txMock.usagePeriod.deleteMany).toHaveBeenCalledWith({
      where: { userId: "manual-user" },
    });
    expect(txMock.accessGrant.deleteMany).toHaveBeenCalledWith({
      where: { userId: "manual-user" },
    });
    expect(txMock.user.delete).toHaveBeenCalledWith({
      where: { id: "manual-user" },
    });

    // Verify audit log
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-1",
        action: "USER_DELETED",
        entityType: "User",
        entityId: "manual-user",
        after: { email: "manual@test.com", name: "Manual User" },
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users/[id] — Reset password + send email
// ---------------------------------------------------------------------------

function callPost(id: string) {
  const req = makePostRequest(`/api/admin/users/${id}`, {});
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/users/[id] — reset password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.auditLog.create.mockResolvedValue({} as never);
  });

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const res = await callPost("some-id");
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuthenticatedUser();
    const res = await callPost("some-id");
    expect(res.status).toBe(403);
  });

  it("returns 404 when user not found", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await callPost("nonexistent");
    expect(res.status).toBe(404);
  });

  it("resets password, sets mustChangePassword, and sends email", async () => {
    mockAuthenticatedAdmin({ id: "admin-1" });
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        id: "user-1",
        email: "user@test.com",
        name: "Test User",
      }) as never,
    );

    const res = await callPost("user-1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.emailSent).toBe(true);

    // Password was hashed and mustChangePassword was set
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "$2a$10$mockhash",
        mustChangePassword: true,
      },
    });

    // Email was built with correct data
    expect(buildWelcomePasswordEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test User",
        email: "user@test.com",
        loginUrl: "http://localhost:3000/login",
      }),
    );

    // Email was sent
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: "Seu acesso ao Hyppado — Senha temporária",
      }),
    );

    // Audit log
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-1",
        action: "USER_PASSWORD_RESET",
        entityType: "User",
        entityId: "user-1",
        after: { emailSent: true },
      }),
    });
  });

  it("returns emailSent=false when email fails", async () => {
    mockAuthenticatedAdmin({ id: "admin-1" });
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({ id: "user-2", email: "fail@test.com" }) as never,
    );
    sendEmailMock.mockRejectedValueOnce(new Error("SMTP error"));

    const res = await callPost("user-2");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.emailSent).toBe(false);
  });

  it("uses email prefix when name is null", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        id: "user-3",
        email: "noname@test.com",
        name: null,
      }) as never,
    );

    await callPost("user-3");

    expect(buildWelcomePasswordEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "noname",
      }),
    );
  });
});
