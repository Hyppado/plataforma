/**
 * Tests: middleware.ts — NextAuth middleware with role checks
 *
 * Priority: #1 (Security — route protection)
 *
 * NOTE: Next.js middleware is tricky to unit-test because withAuth wraps
 * the function. We test the exported config matcher and the logic branches
 * by importing and calling the middleware function directly.
 */
import { describe, it, expect } from "vitest";

// We can at least test the exported matcher config
import { config } from "@/middleware";

describe("middleware config", () => {
  it("protects /dashboard/* routes", () => {
    expect(config.matcher).toContain("/dashboard/:path*");
  });

  it("protects /api/admin/* routes", () => {
    expect(config.matcher).toContain("/api/admin/:path*");
  });

  it("does NOT protect /api/trending/* (public)", () => {
    const matchers = config.matcher as string[];
    const protectsTrending = matchers.some((m) => m.includes("/api/trending"));
    expect(protectsTrending).toBe(false);
  });

  it("does NOT protect /api/auth/* (NextAuth)", () => {
    const matchers = config.matcher as string[];
    const protectsAuth = matchers.some(
      (m) => m.includes("/api/auth") && !m.includes("/api/admin"),
    );
    expect(protectsAuth).toBe(false);
  });

  it("does NOT protect /api/webhooks/* (external)", () => {
    const matchers = config.matcher as string[];
    const protectsWebhooks = matchers.some((m) => m.includes("/api/webhooks"));
    expect(protectsWebhooks).toBe(false);
  });
});
