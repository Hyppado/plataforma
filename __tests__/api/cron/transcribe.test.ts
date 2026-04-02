/**
 * Tests: app/api/cron/transcribe/route.ts
 *
 * Coverage: CRON_SECRET validation, processPendingTranscripts call
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { processPendingTranscriptsMock } = vi.hoisted(() => ({
  processPendingTranscriptsMock: vi.fn(),
}));

vi.mock("@/lib/transcription/service", () => ({
  processPendingTranscripts: processPendingTranscriptsMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from "@/app/api/cron/transcribe/route";

function makeRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (secret) headers.authorization = `Bearer ${secret}`;
  return new NextRequest("http://localhost/api/cron/transcribe", { headers });
}

describe("GET /api/cron/transcribe", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-cron-secret" };
  });

  it("returns 500 when CRON_SECRET not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest("any"));
    expect(res.status).toBe(500);
  });

  it("returns 401 with invalid secret", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with no auth header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("processes transcripts with valid secret", async () => {
    processPendingTranscriptsMock.mockResolvedValue({
      processed: 3,
      succeeded: 2,
      failed: 1,
    });

    const res = await GET(makeRequest("test-cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(3);
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(1);
    expect(processPendingTranscriptsMock).toHaveBeenCalledOnce();
  });

  it("returns 500 on unhandled error", async () => {
    processPendingTranscriptsMock.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("test-cron-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
