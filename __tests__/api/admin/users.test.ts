/**
 * Tests: app/api/admin/users/route.ts — User management (admin)
 *
 * Priority: #2 (Security — user status/role changes)
 * Coverage: auth enforcement, pagination, filters, status/role updates, audit trail
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  mockAuthenticatedUser,
  makeGetRequest,
  makePatchRequest,
  makePostRequest,
} from "@tests/helpers/auth";
import { buildUser } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

// Mock email module
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "msg-1" }),
  buildWelcomePasswordEmail: vi.fn().mockReturnValue({
    subject: "Seu acesso ao Hyppado",
    html: "<html>welcome</html>",
    text: "welcome",
  }),
  getEmailBaseUrl: vi.fn().mockReturnValue("https://hyppado.com"),
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$10$mockhash"),
  },
}));

import { GET, PATCH, POST } from "@/app/api/admin/users/route";
import { sendEmail, buildWelcomePasswordEmail } from "@/lib/email";

describe("GET /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/admin/users") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuthenticatedUser();
    const req = makeGetRequest("/api/admin/users") as any;
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns paginated users for admin", async () => {
    mockAuthenticatedAdmin();
    const users = [buildUser(), buildUser()];
    prismaMock.user.findMany.mockResolvedValue(users);
    prismaMock.user.count.mockResolvedValue(2);

    const req = makeGetRequest("/api/admin/users") as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toHaveLength(2);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBe(2);
  });

  it("limits page size to 100", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    const req = makeGetRequest("/api/admin/users", {
      limit: "999",
    }) as any;
    const res = await GET(req);
    const body = await res.json();

    // Should cap at 100
    expect(body.pagination.limit).toBeLessThanOrEqual(100);
  });
});

describe("PATCH /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      status: "SUSPENDED",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when userId missing", async () => {
    mockAuthenticatedAdmin();
    const req = makePatchRequest("/api/admin/users", {
      status: "ACTIVE",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = makePatchRequest("/api/admin/users", {
      userId: "missing",
      status: "ACTIVE",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it("updates user status and creates audit log", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.user.update.mockResolvedValue({
      ...user,
      status: "SUSPENDED",
    });
    prismaMock.auditLog.create.mockResolvedValue({});

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      status: "SUSPENDED",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
  });

  it("rejects invalid status values", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue(user);

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      status: "HACKED",
    }) as any;
    const res = await PATCH(req);
    // Invalid status → "Nothing to update" → 400
    expect(res.status).toBe(400);
  });

  it("rejects invalid role values", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue(user);

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      role: "SUPERADMIN",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("allows valid role change (USER → ADMIN)", async () => {
    mockAuthenticatedAdmin();
    const user = buildUser({ id: "u1", role: "USER" });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.user.update.mockResolvedValue({ ...user, role: "ADMIN" });
    prismaMock.auditLog.create.mockResolvedValue({});

    const req = makePatchRequest("/api/admin/users", {
      userId: "u1",
      role: "ADMIN",
    }) as any;
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST — Create new user
// ---------------------------------------------------------------------------

describe("POST /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null); // no duplicate
    prismaMock.auditLog.create.mockResolvedValue({} as never);
  });

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makePostRequest("/api/admin/users", {
      email: "new@test.com",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/admin/users", {
      email: "new@test.com",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing email", async () => {
    mockAuthenticatedAdmin();
    const req = makePostRequest("/api/admin/users", { name: "Test" }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate email", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.findUnique.mockResolvedValue(buildUser() as never);
    const req = makePostRequest("/api/admin/users", {
      email: "dup@test.com",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("creates user with password (legacy flow, sendEmail=false)", async () => {
    mockAuthenticatedAdmin();
    const createdUser = {
      id: "u2",
      email: "new@test.com",
      name: "New User",
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date(),
    };
    prismaMock.user.create.mockResolvedValue(createdUser as never);

    const req = makePostRequest("/api/admin/users", {
      email: "new@test.com",
      name: "New User",
    }) as any;
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.emailSent).toBe(true);
    expect(body.user.email).toBe("new@test.com");
    expect(sendEmail).toHaveBeenCalled();
    expect(buildWelcomePasswordEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New User",
        email: "new@test.com",
      }),
    );
  });

  it("creates user with mustChangePassword=true", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.create.mockResolvedValue({
      id: "u3",
      email: "temp@test.com",
      name: "Temp User",
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date(),
    } as never);

    const req = makePostRequest("/api/admin/users", {
      email: "temp@test.com",
      name: "Temp User",
    }) as any;
    await POST(req);

    // user.create should have mustChangePassword=true
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mustChangePassword: true,
          passwordHash: "$2a$10$mockhash",
        }),
      }),
    );
  });

  it("sends welcome email with temporary password", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.create.mockResolvedValue({
      id: "u4",
      email: "email-flow@test.com",
      name: "Email User",
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date(),
    } as never);

    const req = makePostRequest("/api/admin/users", {
      email: "email-flow@test.com",
      name: "Email User",
    }) as any;
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.emailSent).toBe(true);

    // Welcome email sent with temporary password
    expect(buildWelcomePasswordEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Email User",
        email: "email-flow@test.com",
        password: expect.any(String),
        loginUrl: expect.stringContaining("/login"),
      }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "email-flow@test.com",
        subject: "Seu acesso ao Hyppado",
      }),
    );
  });

  it("creates audit log with welcomeEmailSent flag", async () => {
    mockAuthenticatedAdmin();
    prismaMock.user.create.mockResolvedValue({
      id: "u5",
      email: "audit@test.com",
      role: "USER",
    } as never);

    const req = makePostRequest("/api/admin/users", {
      email: "audit@test.com",
    }) as any;
    await POST(req);

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "USER_CREATED",
          after: expect.objectContaining({
            welcomeEmailSent: true,
          }),
        }),
      }),
    );
  });
});
