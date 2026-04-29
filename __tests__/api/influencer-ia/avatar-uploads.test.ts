/**
 * Tests: app/api/influencer-ia/avatar-uploads/route.ts
 *
 * Coverage: auth guard, successful list, ordering, empty list, Prisma error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    userAvatarUpload: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from "@/app/api/influencer-ia/avatar-uploads/route";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function buildUpload(overrides: Partial<{
  id: string;
  userId: string;
  blobUrl: string;
  label: string | null;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "upload-1",
    userId: overrides.userId ?? "user-test-id",
    blobUrl: overrides.blobUrl ?? "https://blob.vercel-storage.com/avatar/test.jpg",
    label: overrides.label ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-04-29T12:00:00Z"),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/influencer-ia/avatar-uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userAvatarUpload.findMany.mockResolvedValue([]);
  });

  // ── Auth ────────────────────────────────────────────────────────────────
  describe("unauthenticated", () => {
    it("returns 401 when no session", async () => {
      mockUnauthenticated();
      const req = makeGetRequest("/api/influencer-ia/avatar-uploads");
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("does not call Prisma when unauthenticated", async () => {
      mockUnauthenticated();
      await GET();
      expect(prismaMock.userAvatarUpload.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Authenticated user ──────────────────────────────────────────────────
  describe("authenticated user", () => {
    beforeEach(() => {
      mockAuthenticatedUser({ id: "user-abc" });
    });

    it("returns 200 with uploads array", async () => {
      const upload = buildUpload({ userId: "user-abc" });
      prismaMock.userAvatarUpload.findMany.mockResolvedValue([upload]);

      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { uploads: unknown[] };
      expect(body.uploads).toHaveLength(1);
    });

    it("queries only the authenticated user's uploads", async () => {
      await GET();
      expect(prismaMock.userAvatarUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-abc" },
        }),
      );
    });

    it("orders uploads by createdAt descending", async () => {
      await GET();
      expect(prismaMock.userAvatarUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("selects only id, blobUrl, label, createdAt fields", async () => {
      await GET();
      expect(prismaMock.userAvatarUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, blobUrl: true, label: true, createdAt: true },
        }),
      );
    });

    it("returns empty uploads array when user has no uploads", async () => {
      prismaMock.userAvatarUpload.findMany.mockResolvedValue([]);

      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { uploads: unknown[] };
      expect(body.uploads).toEqual([]);
    });

    it("returns all upload fields in response", async () => {
      const upload = buildUpload({
        id: "up-1",
        blobUrl: "https://blob.vercel-storage.com/avatar/photo.jpg",
        label: "Foto da Clara",
        createdAt: new Date("2026-04-01T10:00:00Z"),
      });
      prismaMock.userAvatarUpload.findMany.mockResolvedValue([upload]);

      const res = await GET();
      const body = (await res.json()) as { uploads: typeof upload[] };
      const item = body.uploads[0];
      expect(item).toMatchObject({
        id: "up-1",
        blobUrl: "https://blob.vercel-storage.com/avatar/photo.jpg",
        label: "Foto da Clara",
      });
    });

    it("handles uploads with null label", async () => {
      const upload = buildUpload({ label: null });
      prismaMock.userAvatarUpload.findMany.mockResolvedValue([upload]);

      const res = await GET();
      const body = (await res.json()) as {
        uploads: Array<{ label: unknown }>;
      };
      expect(body.uploads[0].label).toBeNull();
    });

    it("returns multiple uploads in order", async () => {
      const uploads = [
        buildUpload({ id: "up-newest", createdAt: new Date("2026-04-29T00:00:00Z") }),
        buildUpload({ id: "up-older", createdAt: new Date("2026-04-01T00:00:00Z") }),
      ];
      prismaMock.userAvatarUpload.findMany.mockResolvedValue(uploads);

      const res = await GET();
      const body = (await res.json()) as { uploads: Array<{ id: string }> };
      expect(body.uploads[0].id).toBe("up-newest");
      expect(body.uploads[1].id).toBe("up-older");
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────
  describe("error handling", () => {
    it("returns 500 when Prisma throws", async () => {
      mockAuthenticatedUser();
      prismaMock.userAvatarUpload.findMany.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const res = await GET();
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBeTruthy();
    });
  });
});
