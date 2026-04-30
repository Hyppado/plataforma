/**
 * Tests for admin avatar-video routes (avatars CRUD).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  mockAuthenticatedUser,
  makeGetRequest,
  makePostRequest,
  makePatchRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

import {
  GET as listAvatars,
  POST as createAvatarRoute,
} from "@/app/api/admin/avatar-video/avatars/route";
import {
  PATCH as patchAvatar,
  DELETE as deleteAvatar,
} from "@/app/api/admin/avatar-video/avatars/[id]/route";

const sampleAvatar = {
  id: "av-1",
  name: "Sofia",
  description: null,
  imageUrl: "https://example.com/img.png",
  thumbnailUrl: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/admin/avatar-video/avatars", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated users", async () => {
    mockUnauthenticated();
    const res = await listAvatars();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockAuthenticatedUser();
    const res = await listAvatars();
    expect(res.status).toBe(403);
  });

  it("lists avatars for admin", async () => {
    mockAuthenticatedAdmin();
    prismaMock.avatarProfile.findMany.mockResolvedValue([sampleAvatar]);
    const res = await listAvatars();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.avatars).toHaveLength(1);
  });
});

describe("POST /api/admin/avatar-video/avatars", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-admin", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/admin/avatar-video/avatars", {
      name: "X",
      imageUrl: "u",
    });
    const res = await createAvatarRoute(req);
    expect(res.status).toBe(403);
  });

  it("validates required fields", async () => {
    mockAuthenticatedAdmin();
    const req = makePostRequest("/api/admin/avatar-video/avatars", {
      name: "",
    });
    const res = await createAvatarRoute(req);
    expect(res.status).toBe(400);
  });

  it("creates avatar with valid input", async () => {
    mockAuthenticatedAdmin();
    prismaMock.avatarProfile.create.mockResolvedValue(sampleAvatar);
    const req = makePostRequest("/api/admin/avatar-video/avatars", {
      name: "Sofia",
      imageUrl: "https://example.com/img.png",
    });
    const res = await createAvatarRoute(req);
    expect(res.status).toBe(201);
    expect(prismaMock.avatarProfile.create).toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/avatar-video/avatars/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires admin", async () => {
    mockAuthenticatedUser();
    const req = makePatchRequest("/api/admin/avatar-video/avatars/av-1", {
      name: "Y",
    });
    const res = await patchAvatar(req, { params: { id: "av-1" } });
    expect(res.status).toBe(403);
  });

  it("updates avatar", async () => {
    mockAuthenticatedAdmin();
    prismaMock.avatarProfile.update.mockResolvedValue({
      ...sampleAvatar,
      isActive: false,
    });
    const req = makePatchRequest("/api/admin/avatar-video/avatars/av-1", {
      isActive: false,
    });
    const res = await patchAvatar(req, { params: { id: "av-1" } });
    expect(res.status).toBe(200);
    expect(prismaMock.avatarProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "av-1" },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });
});

describe("DELETE /api/admin/avatar-video/avatars/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the avatar", async () => {
    mockAuthenticatedAdmin();
    prismaMock.avatarProfile.delete.mockResolvedValue(sampleAvatar);

    const res = await deleteAvatar(
      makeGetRequest("/api/admin/avatar-video/avatars/av-1"),
      { params: { id: "av-1" } },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prismaMock.avatarProfile.delete).toHaveBeenCalledWith({
      where: { id: "av-1" },
    });
  });
});
