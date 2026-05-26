/**
 * Tests: app/api/prompt-library/route.ts
 *
 * Access model:
 *   - Unauthenticated              → 401
 *   - Authenticated, no subscription → 403 (subscription required)
 *   - Authenticated subscriber      → 200
 *   - Admin                         → 200 (bypasses subscription check)
 *   - Only isActive=true items are returned
 *   - ?category= filter works correctly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";
import { buildPromptLibraryItem } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

const { resolveUserAccessMock } = vi.hoisted(() => ({
  resolveUserAccessMock: vi.fn(),
}));
vi.mock("@/lib/access/resolver", () => ({
  resolveUserAccess: resolveUserAccessMock,
}));

import { GET } from "@/app/api/prompt-library/route";

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const activeItem = buildPromptLibraryItem({
  category: "Unboxing",
  isActive: true,
});
const inactiveItem = buildPromptLibraryItem({
  category: "Review",
  isActive: false,
});
const otherCategoryItem = buildPromptLibraryItem({
  category: "Review",
  isActive: true,
});

// The route queries with where: { isActive: true } — mock returns active items only
const activeItems = [activeItem, otherCategoryItem];

// ---------------------------------------------------------------------------
// Unauthenticated
// ---------------------------------------------------------------------------

describe("GET /api/prompt-library — unauthenticated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("does not call Prisma when unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/prompt-library");
    await GET(req);
    expect(prismaMock.promptLibraryItem.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// No subscription — 403
// ---------------------------------------------------------------------------

describe("GET /api/prompt-library — no subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserAccessMock.mockResolvedValue({ status: "NO_ACCESS" });
  });

  it("returns 403 when user has no active subscription", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is suspended", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    resolveUserAccessMock.mockResolvedValue({ status: "SUSPENDED" });
    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("does not call Prisma when access is denied", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const req = makeGetRequest("/api/prompt-library");
    await GET(req);
    expect(prismaMock.promptLibraryItem.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Authenticated subscriber — 200
// ---------------------------------------------------------------------------

describe("GET /api/prompt-library — authenticated user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserAccessMock.mockResolvedValue({ status: "FULL_ACCESS" });
  });

  it("returns 200 with active items", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.promptLibraryItem.findMany.mockResolvedValue(activeItems as any);

    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
  });

  it("queries only isActive=true items", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.promptLibraryItem.findMany.mockResolvedValue(activeItems as any);

    const req = makeGetRequest("/api/prompt-library");
    await GET(req);

    expect(prismaMock.promptLibraryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      }),
    );
  });

  it("does not expose admin-only fields", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.promptLibraryItem.findMany.mockResolvedValue(activeItems as any);

    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);
    const body = await res.json();

    for (const item of body.items) {
      expect(item).not.toHaveProperty("isActive");
      expect(item).not.toHaveProperty("createdById");
      expect(item).not.toHaveProperty("createdAt");
      expect(item).not.toHaveProperty("updatedAt");
    }
  });

  it("returns categories derived from the full active set", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.promptLibraryItem.findMany.mockResolvedValue(activeItems as any);

    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);
    const body = await res.json();

    expect(body.categories).toEqual(["Review", "Unboxing"]); // sorted
  });

  it("filters by ?category= (case-insensitive)", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.promptLibraryItem.findMany.mockResolvedValue(activeItems as any);

    const req = makeGetRequest("/api/prompt-library", { category: "unboxing" });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Only the Unboxing item passes the filter
    expect(body.items).toHaveLength(1);
    expect(body.items[0].category).toBe("Unboxing");
    // Full category list still returned (before filter)
    expect(body.categories).toEqual(["Review", "Unboxing"]);
  });

  it("returns empty items array when no prompts exist", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.promptLibraryItem.findMany.mockResolvedValue([]);

    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.categories).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

describe("GET /api/prompt-library — admin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 for admin users (bypasses subscription check)", async () => {
    mockAuthenticatedAdmin();
    prismaMock.promptLibraryItem.findMany.mockResolvedValue(activeItems as any);

    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("GET /api/prompt-library — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserAccessMock.mockResolvedValue({ status: "FULL_ACCESS" });
  });

  it("returns 500 when Prisma throws", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.promptLibraryItem.findMany.mockRejectedValue(
      new Error("DB connection failed"),
    );

    const req = makeGetRequest("/api/prompt-library");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty("error");
  });
});
