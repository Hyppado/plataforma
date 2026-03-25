/**
 * Auth test helpers
 *
 * Provides utilities to mock NextAuth sessions for route handler tests.
 *
 * This module mocks `next-auth` globally — test files that import from here
 * do NOT need their own `vi.mock("next-auth")`.
 */
import { vi } from "vitest";
import type { Session } from "next-auth";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Global next-auth mock (managed here — do NOT vi.mock("next-auth") elsewhere)
// ---------------------------------------------------------------------------

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn().mockReturnValue({ id: "credentials" }),
}));

import { getServerSession } from "next-auth";

// ---------------------------------------------------------------------------
// Session factories
// ---------------------------------------------------------------------------

export function createUserSession(
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "USER";
  }> = {},
): Session {
  return {
    user: {
      id: overrides.id ?? "user-test-id",
      email: overrides.email ?? "user@test.com",
      name: overrides.name ?? "Test User",
      role: overrides.role ?? "USER",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } as Session;
}

export function createAdminSession(
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
  }> = {},
): Session {
  return createUserSession({
    role: "ADMIN",
    id: overrides.id ?? "admin-test-id",
    email: overrides.email ?? "admin@test.com",
    name: overrides.name ?? "Test Admin",
  });
}

// ---------------------------------------------------------------------------
// Mock controllers
// ---------------------------------------------------------------------------

/**
 * Sets getServerSession to return a specific session.
 * Uses the globally-mocked getServerSession from this module.
 */
export function mockSession(session: Session | null) {
  vi.mocked(getServerSession).mockResolvedValue(session);
}

export function mockAuthenticatedUser(
  overrides?: Parameters<typeof createUserSession>[0],
) {
  mockSession(createUserSession(overrides));
}

export function mockAuthenticatedAdmin(
  overrides?: Parameters<typeof createAdminSession>[0],
) {
  mockSession(createAdminSession(overrides));
}

export function mockUnauthenticated() {
  mockSession(null);
}

// ---------------------------------------------------------------------------
// Request factories — use NextRequest (has .nextUrl for Next.js route handlers)
// ---------------------------------------------------------------------------

/**
 * Creates a NextRequest GET with optional query params.
 */
export function makeGetRequest(
  path: string,
  params: Record<string, string> = {},
): NextRequest {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

/**
 * Creates a NextRequest POST with JSON body.
 */
export function makePostRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Creates a NextRequest PATCH with JSON body.
 */
export function makePatchRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Creates a NextRequest DELETE.
 */
export function makeDeleteRequest(path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
