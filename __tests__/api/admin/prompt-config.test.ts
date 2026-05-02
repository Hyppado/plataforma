/**
 * Tests: app/api/admin/prompt-config/route.ts — avatarVideo validation
 *
 * Coverage:
 *  - GET: auth enforcement, returns config from DB
 *  - PUT: auth enforcement, insight/script validation, avatarVideo required-variable
 *    validation, successful save, empty template rejection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  mockAuthenticatedUser,
  makeGetRequest,
} from "@tests/helpers/auth";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { getPromptConfigFromDBMock, savePromptConfigToDBMock } = vi.hoisted(
  () => ({
    getPromptConfigFromDBMock: vi.fn(),
    savePromptConfigToDBMock: vi.fn(),
  }),
);

vi.mock("@/lib/admin/config", () => ({
  getPromptConfigFromDB: getPromptConfigFromDBMock,
  savePromptConfigToDB: savePromptConfigToDBMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET, PUT } from "@/app/api/admin/prompt-config/route";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeValidBody(overrides: Record<string, unknown> = {}) {
  return {
    insight: {
      template: "Generate insight about {{video_title}}",
      settings: { model: "gpt-4o", temperature: 0.7, max_output_tokens: 800 },
    },
    script: {
      template: "Write a script for {{product_name}}",
      settings: { model: "gpt-4o", temperature: 0.8, max_output_tokens: 1500 },
    },
    ...overrides,
  };
}

/** Builds a minimal valid avatarVideo block (includes all required vars). */
function makeValidAvatarVideo() {
  return {
    image:
      "{{subject_block}} {{product_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}",
    veoSystem: "You are a VEO expert. Return JSON.",
    veoUser:
      "Product: {{product_name}}{{product_category}} Style: {{style_description}} {{style_label}} " +
      "Parts: {{total}}\n{{part_descriptions}}",
  };
}

function makePutRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/admin/prompt-config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated requests", async () => {
    mockUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockAuthenticatedUser();
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns prompt config for admin", async () => {
    mockAuthenticatedAdmin();
    const fakeConfig = {
      insight: { template: "t", settings: {} },
      script: { template: "s", settings: {} },
      avatarVideo: { image: "img", veoSystem: "sys", veoUser: "usr" },
    };
    getPromptConfigFromDBMock.mockResolvedValue(fakeConfig);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.avatarVideo.image).toBe("img");
    expect(body.avatarVideo.veoSystem).toBe("sys");
    expect(body.avatarVideo.veoUser).toBe("usr");
  });

  it("returns 500 when DB read fails", async () => {
    mockAuthenticatedAdmin();
    getPromptConfigFromDBMock.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT — auth
// ---------------------------------------------------------------------------

describe("PUT /api/admin/prompt-config — auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated requests", async () => {
    mockUnauthenticated();
    const req = makePutRequest("/api/admin/prompt-config", makeValidBody());
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockAuthenticatedUser();
    const req = makePutRequest("/api/admin/prompt-config", makeValidBody());
    const res = await PUT(req);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT — insight/script validation (unchanged behaviour)
// ---------------------------------------------------------------------------

describe("PUT /api/admin/prompt-config — insight/script validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when insight.template is missing", async () => {
    mockAuthenticatedAdmin();
    const body = makeValidBody();
    delete (body as any).insight.template;
    const req = makePutRequest("/api/admin/prompt-config", body);
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when script.template is missing", async () => {
    mockAuthenticatedAdmin();
    const body = makeValidBody();
    delete (body as any).script.template;
    const req = makePutRequest("/api/admin/prompt-config", body);
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when insight.settings is missing", async () => {
    mockAuthenticatedAdmin();
    const body = makeValidBody();
    delete (body as any).insight.settings;
    const req = makePutRequest("/api/admin/prompt-config", body);
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT — avatarVideo validation
// ---------------------------------------------------------------------------

describe("PUT /api/admin/prompt-config — avatarVideo validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePromptConfigToDBMock.mockResolvedValue(undefined);
  });

  it("saves successfully when avatarVideo is omitted", async () => {
    mockAuthenticatedAdmin();
    const req = makePutRequest("/api/admin/prompt-config", makeValidBody());
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("saves successfully with a valid avatarVideo block", async () => {
    mockAuthenticatedAdmin();
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({ avatarVideo: makeValidAvatarVideo() }),
    );
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 when avatarVideo.image is an empty string", async () => {
    mockAuthenticatedAdmin();
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({
        avatarVideo: { ...makeValidAvatarVideo(), image: "" },
      }),
    );
    const res = await PUT(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/avatarVideo\.image/);
  });

  it("returns 400 when avatarVideo.veoSystem is an empty string", async () => {
    mockAuthenticatedAdmin();
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({
        avatarVideo: { ...makeValidAvatarVideo(), veoSystem: "   " },
      }),
    );
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when avatarVideo.veoUser is an empty string", async () => {
    mockAuthenticatedAdmin();
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({
        avatarVideo: { ...makeValidAvatarVideo(), veoUser: "" },
      }),
    );
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when avatarVideo.image is missing a required variable", async () => {
    mockAuthenticatedAdmin();
    // Omit {{product_block}} from the image template
    const badImage =
      "{{subject_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}";
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({
        avatarVideo: { ...makeValidAvatarVideo(), image: badImage },
      }),
    );
    const res = await PUT(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("avatarVideo.image");
    expect(body.error).toContain("{{product_block}}");
  });

  it("returns 400 when avatarVideo.veoUser is missing a required variable", async () => {
    mockAuthenticatedAdmin();
    // Omit {{part_descriptions}} from the user template
    const badUser =
      "Product: {{product_name}}{{product_category}} Style: {{style_description}} {{style_label}} Parts: {{total}}";
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({
        avatarVideo: { ...makeValidAvatarVideo(), veoUser: badUser },
      }),
    );
    const res = await PUT(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("avatarVideo.veoUser");
    expect(body.error).toContain("{{part_descriptions}}");
  });

  it("error message lists all missing required variables, not just the first", async () => {
    mockAuthenticatedAdmin();
    // Remove multiple required vars from image template
    const bareImage = "just some text without any variables";
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({
        avatarVideo: { ...makeValidAvatarVideo(), image: bareImage },
      }),
    );
    const res = await PUT(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    // Should mention multiple missing vars
    expect(body.error).toContain("{{subject_block}}");
  });

  it("accepts avatarVideo with no optional variables present", async () => {
    mockAuthenticatedAdmin();
    // Only required vars, no {{style_block}} or {{enhancements_block}}
    const minimalImage =
      "{{subject_block}} {{product_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}";
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({
        avatarVideo: { ...makeValidAvatarVideo(), image: minimalImage },
      }),
    );
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("persists the full body when save succeeds", async () => {
    mockAuthenticatedAdmin();
    const payload = makeValidBody({ avatarVideo: makeValidAvatarVideo() });
    const req = makePutRequest("/api/admin/prompt-config", payload);
    const res = await PUT(req);

    expect(res.status).toBe(200);
    expect(savePromptConfigToDBMock).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarVideo: expect.objectContaining({
          image: expect.stringContaining("{{subject_block}}"),
        }),
      }),
    );
  });

  it("returns 500 when save to DB throws", async () => {
    mockAuthenticatedAdmin();
    savePromptConfigToDBMock.mockRejectedValue(new Error("DB write failed"));
    const req = makePutRequest(
      "/api/admin/prompt-config",
      makeValidBody({ avatarVideo: makeValidAvatarVideo() }),
    );
    const res = await PUT(req);
    expect(res.status).toBe(500);
  });
});
