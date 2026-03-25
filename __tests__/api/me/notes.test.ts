/**
 * Tests: app/api/me/notes/route.ts — Notes (user-scoped)
 *
 * Priority: #4 (Business rules)
 * Coverage: auth, CRUD, upsert logic, ownership enforcement
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
  makePostRequest,
} from "@tests/helpers/auth";
import { buildNote } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

import { GET, POST, DELETE } from "@/app/api/me/notes/route";

describe("GET /api/me/notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    mockUnauthenticated();
    const req = makeGetRequest("/api/me/notes") as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns notes for authenticated user", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.$transaction.mockResolvedValue([[buildNote()], 1]);

    const req = makeGetRequest("/api/me/notes") as any;
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/me/notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires type, externalId, content", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/me/notes", {
      type: "VIDEO",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates new note when none exists", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.note.findFirst.mockResolvedValue(null);
    const note = buildNote({ userId: "user-1" });
    prismaMock.note.create.mockResolvedValue(note);

    const req = makePostRequest("/api/me/notes", {
      type: "VIDEO",
      externalId: "v123",
      content: "Great video",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMock.note.create).toHaveBeenCalled();
  });

  it("updates existing note (upsert behavior)", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    const existing = buildNote({ id: "note-1", userId: "user-1" });
    prismaMock.note.findFirst.mockResolvedValue(existing);
    prismaMock.note.update.mockResolvedValue({
      ...existing,
      content: "Updated",
    });

    const req = makePostRequest("/api/me/notes", {
      type: "VIDEO",
      externalId: "v123",
      content: "Updated",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMock.note.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note-1" },
        data: { content: "Updated" },
      }),
    );
  });
});

describe("DELETE /api/me/notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires note id", async () => {
    mockAuthenticatedUser();
    const req = new Request("http://localhost/api/me/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("enforces ownership on delete", async () => {
    mockAuthenticatedUser({ id: "user-1" });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 1 });

    const req = new Request("http://localhost/api/me/notes?id=n1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await DELETE(req);
    expect(prismaMock.note.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n1", userId: "user-1" },
      }),
    );
  });
});
