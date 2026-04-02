/**
 * Tests: app/api/admin/settings/openai/route.ts
 *
 * Coverage: GET status, POST save key, auth
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedAdmin,
  mockAuthenticatedUser,
  mockUnauthenticated,
  makePostRequest,
} from "@tests/helpers/auth";
import { NextRequest } from "next/server";

// Mock settings
const {
  hasSecretSettingMock,
  getSettingMock,
  upsertSettingMock,
  upsertSecretSettingMock,
} = vi.hoisted(() => ({
  hasSecretSettingMock: vi.fn(),
  getSettingMock: vi.fn(),
  upsertSettingMock: vi.fn().mockResolvedValue({}),
  upsertSecretSettingMock: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/settings", () => ({
  SETTING_KEYS: {
    OPENAI_API_KEY: "openai.api_key",
    OPENAI_WHISPER_MODEL: "openai.whisper_model",
    OPENAI_WHISPER_LANGUAGE: "openai.whisper_language",
  },
  getSetting: getSettingMock,
  upsertSetting: upsertSettingMock,
  upsertSecretSetting: upsertSecretSettingMock,
  hasSecretSetting: hasSecretSettingMock,
}));

import { GET, POST } from "@/app/api/admin/settings/openai/route";

describe("GET /api/admin/settings/openai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSecretSettingMock.mockResolvedValue(false);
    getSettingMock.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuthenticatedUser();
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns config status for admin", async () => {
    mockAuthenticatedAdmin();
    hasSecretSettingMock.mockResolvedValue(true);
    getSettingMock
      .mockResolvedValueOnce("whisper-1") // model
      .mockResolvedValueOnce("pt"); // language

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.model).toBe("whisper-1");
    expect(body.language).toBe("pt");
  });

  it("returns defaults when not configured", async () => {
    mockAuthenticatedAdmin();
    const res = await GET();
    const body = await res.json();

    expect(body.configured).toBe(false);
    expect(body.model).toBe("whisper-1");
    expect(body.language).toBe("auto");
  });
});

describe("POST /api/admin/settings/openai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makePostRequest("/api/admin/settings/openai", {
      apiKey: "sk-test",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("validates API key length", async () => {
    mockAuthenticatedAdmin();
    const req = makePostRequest("/api/admin/settings/openai", {
      apiKey: "short",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("saves API key encrypted", async () => {
    mockAuthenticatedAdmin();
    const req = makePostRequest("/api/admin/settings/openai", {
      apiKey: "sk-test-key-12345678",
      model: "whisper-1",
      language: "en",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(upsertSecretSettingMock).toHaveBeenCalledWith(
      "openai.api_key",
      "sk-test-key-12345678",
      expect.any(Object),
    );
    expect(upsertSettingMock).toHaveBeenCalledTimes(2); // model + language
  });
});
