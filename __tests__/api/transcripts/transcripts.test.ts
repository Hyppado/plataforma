/**
 * Tests: app/api/transcripts/route.ts
 *
 * Coverage: auth, quota enforcement, transcript request flow
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makePostRequest,
} from "@tests/helpers/auth";

// Mock dependencies
const {
  requestTranscriptMock,
  assertQuotaMock,
  consumeUsageMock,
} = vi.hoisted(() => ({
  requestTranscriptMock: vi.fn(),
  assertQuotaMock: vi.fn(),
  consumeUsageMock: vi.fn().mockResolvedValue({ event: {}, duplicate: false }),
}));

vi.mock("@/lib/transcription/service", () => ({
  requestTranscript: requestTranscriptMock,
}));

vi.mock("@/lib/usage/enforce", () => ({
  assertQuota: assertQuotaMock,
  QuotaExceededError: class QuotaExceededError extends Error {
    action: string;
    used: number;
    limit: number;
    constructor(action: string, used: number, limit: number) {
      super(`Quota exceeded for ${action}`);
      this.action = action;
      this.used = used;
      this.limit = limit;
    }
  },
}));

vi.mock("@/lib/usage/consume", () => ({
  consumeUsage: consumeUsageMock,
}));

import { POST } from "@/app/api/transcripts/route";
import { QuotaExceededError } from "@/lib/usage/enforce";

describe("POST /api/transcripts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertQuotaMock.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makePostRequest("/api/transcripts", {
      videoExternalId: "vid-1",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when videoExternalId is missing", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/transcripts", {});

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("videoExternalId");
  });

  it("returns 429 when quota exceeded", async () => {
    mockAuthenticatedUser();
    assertQuotaMock.mockRejectedValue(
      new QuotaExceededError("TRANSCRIPT", 40, 40),
    );

    const req = makePostRequest("/api/transcripts", {
      videoExternalId: "vid-1",
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("Cota");
  });

  it("returns transcript status on success (new)", async () => {
    mockAuthenticatedUser();
    requestTranscriptMock.mockResolvedValue({
      videoExternalId: "vid-1",
      status: "PENDING",
      transcriptText: null,
      isNew: true,
    });

    const req = makePostRequest("/api/transcripts", {
      videoExternalId: "vid-1",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PENDING");
    expect(body.videoExternalId).toBe("vid-1");
    expect(consumeUsageMock).toHaveBeenCalled();
  });

  it("does not consume quota for existing transcript", async () => {
    mockAuthenticatedUser();
    requestTranscriptMock.mockResolvedValue({
      videoExternalId: "vid-1",
      status: "READY",
      transcriptText: "Existing text",
      isNew: false,
    });

    const req = makePostRequest("/api/transcripts", {
      videoExternalId: "vid-1",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("READY");
    expect(consumeUsageMock).not.toHaveBeenCalled();
  });
});
