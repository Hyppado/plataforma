/**
 * Tests: app/api/transcripts/[videoExternalId]/route.ts
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

const { getTranscriptMock, resolveUserAccessMock } = vi.hoisted(() => ({
  getTranscriptMock: vi.fn(),
  resolveUserAccessMock: vi.fn(),
}));

vi.mock("@/lib/transcription/service", () => ({
  getTranscript: getTranscriptMock,
}));

vi.mock("@/lib/access/resolver", () => ({
  resolveUserAccess: resolveUserAccessMock,
}));

import { GET } from "@/app/api/transcripts/[videoExternalId]/route";

const VIDEO_ID = "vid-abc123";
const makeParams = (id = VIDEO_ID) => ({ params: { videoExternalId: id } });

const fakeTranscript = {
  videoExternalId: VIDEO_ID,
  status: "READY",
  transcriptText: "Hello world",
  language: "pt",
  durationSeconds: 120,
  readyAt: new Date("2025-01-01T12:00:00Z"),
  createdAt: new Date("2025-01-01T10:00:00Z"),
};

describe("GET /api/transcripts/[videoExternalId] — unauthenticated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockUnauthenticated();
    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(401);
  });

  it("does not call getTranscript when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    await GET(req, makeParams());
    expect(getTranscriptMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/transcripts/[videoExternalId] — no subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserAccessMock.mockResolvedValue({ status: "NO_ACCESS" });
  });

  it("returns 403 when user has no active subscription", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 403 when user is suspended", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    resolveUserAccessMock.mockResolvedValue({ status: "SUSPENDED" });
    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(403);
  });

  it("does not call getTranscript when access is denied", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    await GET(req, makeParams());
    expect(getTranscriptMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/transcripts/[videoExternalId] — authenticated subscriber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserAccessMock.mockResolvedValue({ status: "FULL_ACCESS" });
  });

  it("returns 404 when transcript does not exist", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    getTranscriptMock.mockResolvedValue(null);

    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 with transcript data when found", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    getTranscriptMock.mockResolvedValue(fakeTranscript);

    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.videoExternalId).toBe(VIDEO_ID);
    expect(body.status).toBe("READY");
    expect(body.transcriptText).toBe("Hello world");
  });

  it("returns 500 when getTranscript throws", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    getTranscriptMock.mockRejectedValue(new Error("DB error"));

    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/transcripts/[videoExternalId] — admin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bypasses subscription check for admin users", async () => {
    mockAuthenticatedAdmin();
    getTranscriptMock.mockResolvedValue(fakeTranscript);

    const req = makeGetRequest(`/api/transcripts/${VIDEO_ID}`) as any;
    const res = await GET(req, makeParams());

    expect(res.status).toBe(200);
    expect(resolveUserAccessMock).not.toHaveBeenCalled();
  });
});
