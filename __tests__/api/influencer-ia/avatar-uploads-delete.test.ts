/**
 * Tests: app/api/influencer-ia/avatar-uploads/[id]/route.ts
 *
 * Coverage: auth guard, ownership check, successful delete, not-found, Prisma error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "@tests/helpers/auth";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    userAvatarUpload: {
      findUnique: vi.fn(),
      delete: vi.fn(),
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

import { DELETE } from "@/app/api/influencer-ia/avatar-uploads/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeleteRequest(id: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/influencer-ia/avatar-uploads/${id}`,
    { method: "DELETE" },
  );
}

function makeParams(id: string) {
  return { params: { id } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/influencer-ia/avatar-uploads/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userAvatarUpload.findUnique.mockResolvedValue(null);
    prismaMock.userAvatarUpload.delete.mockResolvedValue({});
  });

  // ── Auth ────────────────────────────────────────────────────────────────
  describe("unauthenticated", () => {
    it("returns 401 when no session", async () => {
      mockUnauthenticated();
      const res = await DELETE(
        makeDeleteRequest("upload-1"),
        makeParams("upload-1"),
      );
      expect(res.status).toBe(401);
    });

    it("does not call Prisma when unauthenticated", async () => {
      mockUnauthenticated();
      await DELETE(makeDeleteRequest("upload-1"), makeParams("upload-1"));
      expect(prismaMock.userAvatarUpload.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.userAvatarUpload.delete).not.toHaveBeenCalled();
    });
  });

  // ── Not found ────────────────────────────────────────────────────────────
  describe("not found", () => {
    it("returns 404 when upload does not exist", async () => {
      mockAuthenticatedUser({ id: "user-abc" });
      prismaMock.userAvatarUpload.findUnique.mockResolvedValue(null);

      const res = await DELETE(
        makeDeleteRequest("missing-id"),
        makeParams("missing-id"),
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBeTruthy();
    });

    it("does not call delete when upload is not found", async () => {
      mockAuthenticatedUser();
      prismaMock.userAvatarUpload.findUnique.mockResolvedValue(null);

      await DELETE(makeDeleteRequest("missing-id"), makeParams("missing-id"));
      expect(prismaMock.userAvatarUpload.delete).not.toHaveBeenCalled();
    });
  });

  // ── Ownership ────────────────────────────────────────────────────────────
  describe("ownership check", () => {
    it("returns 403 when upload belongs to a different user", async () => {
      mockAuthenticatedUser({ id: "user-abc" });
      prismaMock.userAvatarUpload.findUnique.mockResolvedValue({
        userId: "other-user-id",
      });

      const res = await DELETE(
        makeDeleteRequest("upload-1"),
        makeParams("upload-1"),
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBeTruthy();
    });

    it("does not call delete when ownership check fails", async () => {
      mockAuthenticatedUser({ id: "user-abc" });
      prismaMock.userAvatarUpload.findUnique.mockResolvedValue({
        userId: "other-user-id",
      });

      await DELETE(makeDeleteRequest("upload-1"), makeParams("upload-1"));
      expect(prismaMock.userAvatarUpload.delete).not.toHaveBeenCalled();
    });
  });

  // ── Successful delete ────────────────────────────────────────────────────
  describe("successful delete", () => {
    beforeEach(() => {
      mockAuthenticatedUser({ id: "user-abc" });
      prismaMock.userAvatarUpload.findUnique.mockResolvedValue({
        userId: "user-abc",
      });
    });

    it("returns 200 with { success: true }", async () => {
      const res = await DELETE(
        makeDeleteRequest("upload-1"),
        makeParams("upload-1"),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it("calls findUnique with the correct id", async () => {
      await DELETE(makeDeleteRequest("upload-42"), makeParams("upload-42"));
      expect(prismaMock.userAvatarUpload.findUnique).toHaveBeenCalledWith({
        where: { id: "upload-42" },
        select: { userId: true },
      });
    });

    it("calls delete with the correct id", async () => {
      await DELETE(makeDeleteRequest("upload-42"), makeParams("upload-42"));
      expect(prismaMock.userAvatarUpload.delete).toHaveBeenCalledWith({
        where: { id: "upload-42" },
      });
    });
  });

  // ── Error handling ───────────────────────────────────────────────────────
  describe("error handling", () => {
    it("returns 500 when Prisma findUnique throws", async () => {
      mockAuthenticatedUser();
      prismaMock.userAvatarUpload.findUnique.mockRejectedValue(
        new Error("DB error"),
      );

      const res = await DELETE(
        makeDeleteRequest("upload-1"),
        makeParams("upload-1"),
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBeTruthy();
    });

    it("returns 500 when Prisma delete throws", async () => {
      mockAuthenticatedUser({ id: "user-abc" });
      prismaMock.userAvatarUpload.findUnique.mockResolvedValue({
        userId: "user-abc",
      });
      prismaMock.userAvatarUpload.delete.mockRejectedValue(
        new Error("Delete failed"),
      );

      const res = await DELETE(
        makeDeleteRequest("upload-1"),
        makeParams("upload-1"),
      );
      expect(res.status).toBe(500);
    });
  });
});
