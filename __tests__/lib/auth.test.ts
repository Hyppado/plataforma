/**
 * Tests: lib/auth.ts — requireAuth, requireAdmin, isAuthed, authOptions
 *
 * Priority: #1 (Authentication/Authorization)
 * Coverage: credential validation, role checks, session guards, LGPD blocks
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing auth
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock NextAuth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((options) => ({ id: "credentials", ...options })),
}));

import { requireAuth, requireAdmin, isAuthed, authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

describe("requireAuth()", () => {
  it("returns 401 when session is null", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const result = await requireAuth();
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when session.user is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: null, expires: "" });

    const result = await requireAuth();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 401 when userId is empty", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "", email: "a@b.com", role: "USER" },
      expires: "",
    });

    const result = await requireAuth();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns session data for valid user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", role: "USER" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    const result = await requireAuth();
    expect(isAuthed(result)).toBe(true);
    if (isAuthed(result)) {
      expect(result.userId).toBe("user-1");
      expect(result.role).toBe("USER");
    }
  });
});

describe("requireAdmin()", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const result = await requireAdmin();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 403 when role is USER (not ADMIN)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", role: "USER" },
      expires: "",
    });

    const result = await requireAdmin();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
    const body = await (result as NextResponse).json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns session for ADMIN user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", email: "admin@b.com", role: "ADMIN" },
      expires: "",
    });

    const result = await requireAdmin();
    expect(isAuthed(result)).toBe(true);
    if (isAuthed(result)) {
      expect(result.role).toBe("ADMIN");
    }
  });
});

describe("isAuthed() type guard", () => {
  it("returns false for NextResponse", () => {
    const res = NextResponse.json({ error: "test" }, { status: 401 });
    expect(isAuthed(res)).toBe(false);
  });

  it("returns true for valid session result", () => {
    const result = {
      session: { user: { id: "1" }, expires: "" } as any,
      userId: "1",
      role: "USER" as const,
    };
    expect(isAuthed(result)).toBe(true);
  });
});

describe("authOptions.callbacks", () => {
  it("jwt callback stores userId and role from user", async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const token = await (jwt as Function)({
      token: {},
      user: { id: "u1", role: "ADMIN" },
    });
    expect(token.userId).toBe("u1");
    expect(token.role).toBe("ADMIN");
  });

  it("jwt callback preserves existing token without user", async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const token = await (jwt as Function)({
      token: { userId: "existing", role: "USER" },
      user: undefined,
    });
    expect(token.userId).toBe("existing");
    expect(token.role).toBe("USER");
  });

  it("session callback injects userId and role", async () => {
    const session = authOptions.callbacks!.session!;
    const result = await (session as Function)({
      session: { user: {} },
      token: { userId: "u2", role: "ADMIN" },
    });
    expect(result.user.id).toBe("u2");
    expect(result.user.role).toBe("ADMIN");
  });
});

describe("authOptions.authorize()", () => {
  const getAuthorize = () => {
    const provider = authOptions.providers[0] as any;
    return (provider.options?.authorize ?? provider.authorize) as (
      credentials: Record<string, string>,
    ) => Promise<unknown>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not rate limited, user not found
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
  });

  it("returns null for missing credentials", async () => {
    const authorize = getAuthorize();
    expect(await authorize({ email: "", password: "" })).toBeNull();
  });

  it("throws when rate limit is exceeded", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(10);
    const authorize = getAuthorize();
    await expect(
      authorize({ email: "target@example.com", password: "any" }),
    ).rejects.toThrow("Muitas tentativas");
  });

  it("records a failed attempt and returns null for unknown email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const authorize = getAuthorize();
    const result = await authorize({
      email: "ghost@example.com",
      password: "pw",
    });
    expect(result).toBeNull();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "LOGIN_FAILED" }),
      }),
    );
  });

  it("records a failed attempt and returns null for wrong password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      passwordHash: await bcrypt.hash("correct", 10),
      status: "ACTIVE",
      deletedAt: null,
      name: null,
      role: "USER",
      mustChangePassword: false,
    } as any);
    const authorize = getAuthorize();
    const result = await authorize({
      email: "user@example.com",
      password: "wrong",
    });
    expect(result).toBeNull();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "LOGIN_FAILED",
          userId: "user-1",
        }),
      }),
    );
  });

  it("returns user and does not log failure on correct credentials", async () => {
    const hash = await bcrypt.hash("correct", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      passwordHash: hash,
      status: "ACTIVE",
      deletedAt: null,
      name: "Test User",
      role: "USER",
      mustChangePassword: false,
    } as any);
    const authorize = getAuthorize();
    const result = await authorize({
      email: "user@example.com",
      password: "correct",
    });
    expect(result).toMatchObject({ id: "user-1", email: "user@example.com" });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("Security: credentials provider", () => {
  it("only uses CredentialsProvider (no social logins with implicit trust)", () => {
    expect(authOptions.providers).toHaveLength(1);
  });

  it("uses JWT strategy (no database sessions)", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("has a secret configured", () => {
    expect(authOptions.secret).toBeDefined();
  });

  it("redirects to /login page", () => {
    expect(authOptions.pages?.signIn).toBe("/login");
    expect(authOptions.pages?.error).toBe("/login");
  });
});
