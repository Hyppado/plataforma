/**
 * Tests: app/api/influencer-ia/upload-reference/route.ts
 *
 * Coverage: auth guard, file presence, MIME validation, size limit,
 * successful upload → { url }.
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

const { putMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: putMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { POST } from "@/app/api/influencer-ia/upload-reference/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function makeUploadRequest(
  file: Blob | null,
  fieldName = "file",
): NextRequest {
  const formData = new FormData();
  if (file) formData.append(fieldName, file, "test.jpg");

  return new NextRequest(
    "http://localhost/api/influencer-ia/upload-reference",
    {
      method: "POST",
      body: formData,
    },
  );
}

function makeImageBlob(
  sizeBytes: number,
  type = "image/jpeg",
): Blob {
  return new Blob([new Uint8Array(sizeBytes)], { type });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/influencer-ia/upload-reference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    putMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/refs/test.jpg",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeUploadRequest(makeImageBlob(1024));
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file is provided", async () => {
    mockAuthenticatedUser();
    const req = makeUploadRequest(null);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("file");
  });

  it("returns 400 when file has disallowed MIME type (image/gif)", async () => {
    mockAuthenticatedUser();
    const gifBlob = makeImageBlob(1024, "image/gif");
    const req = makeUploadRequest(gifBlob);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Formato inválido");
  });

  it("returns 400 when file exceeds 5MB", async () => {
    mockAuthenticatedUser();
    const bigBlob = makeImageBlob(MAX_SIZE_BYTES + 1);
    const req = makeUploadRequest(bigBlob);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("5 MB");
  });

  it("returns 200 with url on successful JPEG upload", async () => {
    mockAuthenticatedUser();
    const jpegBlob = makeImageBlob(1024, "image/jpeg");
    const req = makeUploadRequest(jpegBlob);

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { url: string };
    expect(body.url).toBe("https://blob.vercel-storage.com/refs/test.jpg");
  });

  it("returns 200 on PNG upload", async () => {
    mockAuthenticatedUser();
    const pngBlob = makeImageBlob(2048, "image/png");
    const req = makeUploadRequest(pngBlob);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 on WebP upload", async () => {
    mockAuthenticatedUser();
    const webpBlob = makeImageBlob(512, "image/webp");
    const req = makeUploadRequest(webpBlob);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("accepts file exactly at 5MB boundary", async () => {
    mockAuthenticatedUser();
    const exactBlob = makeImageBlob(MAX_SIZE_BYTES, "image/jpeg");
    const req = makeUploadRequest(exactBlob);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 500 when blob upload fails", async () => {
    mockAuthenticatedUser();
    putMock.mockRejectedValue(new Error("Vercel Blob service unavailable"));

    const jpegBlob = makeImageBlob(1024, "image/jpeg");
    const req = makeUploadRequest(jpegBlob);

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("calls put with correct file for JPEG upload", async () => {
    mockAuthenticatedUser();
    const pngBlob = makeImageBlob(512, "image/png");
    const req = makeUploadRequest(pngBlob);

    await POST(req);

    expect(putMock).toHaveBeenCalledOnce();
    const [pathname] = putMock.mock.calls[0] as [string, ...unknown[]];
    expect(pathname).toContain("influencer-ia/uploads/");
    expect(pathname).toMatch(/\.png$/);
  });
});
