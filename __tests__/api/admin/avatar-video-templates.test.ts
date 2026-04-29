/**
 * Tests for admin avatar-video templates GET/PUT route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  mockAuthenticatedUser,
} from "@tests/helpers/auth";
import { NextRequest } from "next/server";

const { getSettingMock, upsertSettingMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn(),
  upsertSettingMock: vi.fn(),
}));

vi.mock("@/lib/settings", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    getSetting: getSettingMock,
    upsertSetting: upsertSettingMock,
  };
});

import { GET, PUT } from "@/app/api/admin/avatar-video/templates/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/avatar-video/templates", () => {
  it("rejects non-admin", async () => {
    mockAuthenticatedUser();
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns templates for admin", async () => {
    mockAuthenticatedAdmin();
    getSettingMock.mockResolvedValueOnce("concept-template");
    getSettingMock.mockResolvedValueOnce("prompt-template");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.conceptTemplate).toBe("concept-template");
    expect(body.promptTemplate).toBe("prompt-template");
  });

  it("returns empty strings when no settings present", async () => {
    mockAuthenticatedAdmin();
    getSettingMock.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(body.conceptTemplate).toBe("");
    expect(body.promptTemplate).toBe("");
  });
});

describe("PUT /api/admin/avatar-video/templates", () => {
  it("saves both templates via upsertSetting", async () => {
    mockAuthenticatedAdmin();
    const req = new NextRequest(
      "http://localhost/api/admin/avatar-video/templates",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptTemplate: "C",
          promptTemplate: "P",
        }),
      },
    );
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(upsertSettingMock).toHaveBeenCalledWith(
      "avatar_video.concept_template",
      "C",
      expect.any(Object),
    );
    expect(upsertSettingMock).toHaveBeenCalledWith(
      "avatar_video.prompt_template",
      "P",
      expect.any(Object),
    );
  });
});
