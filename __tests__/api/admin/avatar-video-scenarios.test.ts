/**
 * Tests for admin avatar-video routes (scenarios CRUD).
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
  GET as listScenarios,
  POST as createScenarioRoute,
} from "@/app/api/admin/avatar-video/scenarios/route";
import {
  PATCH as patchScenario,
  DELETE as deleteScenario,
} from "@/app/api/admin/avatar-video/scenarios/[id]/route";

const sampleScenario = {
  id: "sc-1",
  name: "UGC casual",
  description: null,
  promptHint: null,
  isDefault: false,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/admin/avatar-video/scenarios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const res = await listScenarios();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuthenticatedUser();
    const res = await listScenarios();
    expect(res.status).toBe(403);
  });

  it("lists scenarios for admin", async () => {
    mockAuthenticatedAdmin();
    prismaMock.videoScenario.findMany.mockResolvedValue([sampleScenario]);
    const res = await listScenarios();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.scenarios).toHaveLength(1);
  });
});

describe("POST /api/admin/avatar-video/scenarios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates required name", async () => {
    mockAuthenticatedAdmin();
    const req = makePostRequest("/api/admin/avatar-video/scenarios", {
      name: "",
    });
    const res = await createScenarioRoute(req);
    expect(res.status).toBe(400);
  });

  it("creates scenario with valid input", async () => {
    mockAuthenticatedAdmin();
    prismaMock.$transaction.mockImplementation(async (fn: any) =>
      fn(prismaMock),
    );
    prismaMock.videoScenario.create.mockResolvedValue(sampleScenario);
    const req = makePostRequest("/api/admin/avatar-video/scenarios", {
      name: "UGC",
    });
    const res = await createScenarioRoute(req);
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/admin/avatar-video/scenarios/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-admin", async () => {
    mockAuthenticatedUser();
    const req = makePatchRequest("/api/admin/avatar-video/scenarios/sc-1", {
      isActive: false,
    });
    const res = await patchScenario(req, { params: { id: "sc-1" } });
    expect(res.status).toBe(403);
  });

  it("when isDefault=true, unsets previous defaults", async () => {
    mockAuthenticatedAdmin();
    prismaMock.$transaction.mockImplementation(async (fn: any) =>
      fn(prismaMock),
    );
    prismaMock.videoScenario.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.videoScenario.update.mockResolvedValue({
      ...sampleScenario,
      isDefault: true,
    });
    const req = makePatchRequest("/api/admin/avatar-video/scenarios/sc-1", {
      isDefault: true,
    });
    const res = await patchScenario(req, { params: { id: "sc-1" } });
    expect(res.status).toBe(200);
    expect(prismaMock.videoScenario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDefault: true }),
        data: { isDefault: false },
      }),
    );
  });
});

describe("DELETE /api/admin/avatar-video/scenarios/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deactivates when scenario is referenced", async () => {
    mockAuthenticatedAdmin();
    prismaMock.avatarVideoCreation.count.mockResolvedValue(2);
    prismaMock.videoScenario.update.mockResolvedValue({
      ...sampleScenario,
      isActive: false,
    });
    const res = await deleteScenario(
      makeGetRequest("/api/admin/avatar-video/scenarios/sc-1"),
      { params: { id: "sc-1" } },
    );
    const body = await res.json();
    expect(body.deleted).toBe(false);
    expect(body.deactivated).toBe(true);
  });
});
