/**
 * Tests: app/api/avatar-video/avatars/route.ts
 *
 * GET /api/avatar-video/avatars
 *
 * Coverage: auth, success (sorted active avatars), inactive avatars filtered out,
 * empty list, internal DB error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthenticatedUser, mockUnauthenticated } from "@tests/helpers/auth";
import { buildAvatarProfile } from "@tests/helpers/factories";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  avatarProfile: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { GET } from "@/app/api/avatar-video/avatars/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest() {
  return new NextRequest("http://localhost/api/avatar-video/avatars", {
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/avatar-video/avatars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with active avatars sorted by sortOrder", async () => {
    mockAuthenticatedUser("user-test-id");
    const avatar1 = buildAvatarProfile({ sortOrder: 0, name: "First" });
    const avatar2 = buildAvatarProfile({ sortOrder: 1, name: "Second" });
    prismaMock.avatarProfile.findMany.mockResolvedValue([avatar1, avatar2]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.avatars).toHaveLength(2);
    expect(body.avatars[0].name).toBe("First");
    expect(body.avatars[1].name).toBe("Second");
  });

  it("queries only active avatars with correct orderBy", async () => {
    mockAuthenticatedUser("user-test-id");
    prismaMock.avatarProfile.findMany.mockResolvedValue([]);

    await GET(makeGetRequest());

    expect(prismaMock.avatarProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
    );
  });

  it("does not expose creations or internal fields", async () => {
    mockAuthenticatedUser("user-test-id");
    const avatar = buildAvatarProfile();
    prismaMock.avatarProfile.findMany.mockResolvedValue([
      {
        id: avatar.id,
        name: avatar.name,
        description: avatar.description,
        imageUrl: avatar.imageUrl,
        thumbnailUrl: avatar.thumbnailUrl,
        sortOrder: avatar.sortOrder,
      },
    ]);

    const res = await GET(makeGetRequest());
    const body = await res.json();
    const item = body.avatars[0];

    // Public fields present
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.imageUrl).toBeDefined();
    // Internal / relation fields must not be present
    expect(item.isActive).toBeUndefined();
    expect(item.creations).toBeUndefined();
  });

  it("returns empty array when no avatars exist", async () => {
    mockAuthenticatedUser("user-test-id");
    prismaMock.avatarProfile.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.avatars).toEqual([]);
  });

  it("returns 500 when DB throws", async () => {
    mockAuthenticatedUser("user-test-id");
    prismaMock.avatarProfile.findMany.mockRejectedValue(new Error("db error"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("db error");
  });
});
