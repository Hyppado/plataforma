/**
 * Tests: app/api/insights/[videoExternalId]/route.ts
 *
 * Coverage: auth rejection, access (subscription) rejection, 404, 200, 500
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

const { getInsightMock, resolveUserAccessMock } = vi.hoisted(() => ({
  getInsightMock: vi.fn(),
  resolveUserAccessMock: vi.fn(),
}));

vi.mock("@/lib/insight", () => ({
  getInsight: getInsightMock,
}));

vi.mock("@/lib/access/resolver", () => ({
  resolveUserAccess: resolveUserAccessMock,
}));

import { GET } from "@/app/api/insights/[videoExternalId]/route";

const VIDEO_ID = "vid-xyz789";
const makeParams = (id = VIDEO_ID) => ({ params: { videoExternalId: id } });

const fakeInsight = {
  videoExternalId: VIDEO_ID,
  status: "READY",
  contextText: "Context here",
  hookText: "Hook text",
  problemText: "Problem text",
  solutionText: "Solution text",
  ctaText: "CTA text",
  copyWorkedText: "Copy worked",
  errorMessage: null,
  createdAt: new Date("2025-01-01T10:00:00Z"),
  readyAt: new Date("2025-01-01T12:00:00Z"),
};

describe("GET /api/insights/[videoExternalId] — unauthenticated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockUnauthenticated();
    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(401);
  });

  it("does not call getInsight when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    await GET(req, makeParams());
    expect(getInsightMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/insights/[videoExternalId] — no subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserAccessMock.mockResolvedValue({ status: "NO_ACCESS" });
  });

  it("returns 403 when user has no active subscription", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 403 when user is suspended", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    resolveUserAccessMock.mockResolvedValue({ status: "SUSPENDED" });
    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(403);
  });

  it("does not call getInsight when access is denied", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    await GET(req, makeParams());
    expect(getInsightMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/insights/[videoExternalId] — authenticated subscriber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserAccessMock.mockResolvedValue({ status: "FULL_ACCESS" });
  });

  it("returns 404 when insight does not exist", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    getInsightMock.mockResolvedValue(null);

    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 with insight data when found", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    getInsightMock.mockResolvedValue(fakeInsight);

    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.videoExternalId).toBe(VIDEO_ID);
    expect(body.status).toBe("READY");
    expect(body.contextText).toBe("Context here");
  });

  it("scopes insight fetch to the authenticated user", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    getInsightMock.mockResolvedValue(fakeInsight);

    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    await GET(req, makeParams());

    expect(getInsightMock).toHaveBeenCalledWith(VIDEO_ID, "user-1");
  });

  it("returns 500 when getInsight throws", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    getInsightMock.mockRejectedValue(new Error("DB error"));

    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/insights/[videoExternalId] — admin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bypasses subscription check for admin users", async () => {
    mockAuthenticatedAdmin();
    getInsightMock.mockResolvedValue(fakeInsight);

    const req = makeGetRequest(`/api/insights/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());

    expect(res.status).toBe(200);
    expect(resolveUserAccessMock).not.toHaveBeenCalled();
  });
});
