/**
 * __tests__/components/setup.tsx — RTL test environment setup
 *
 * - Extends vitest's expect with jest-dom matchers (toBeInTheDocument, etc.)
 * - Mocks browser APIs that MUI needs (matchMedia, ResizeObserver, IntersectionObserver)
 * - Mocks Next.js navigation hooks
 * - Mocks next-auth/react
 * - Mocks Next.js Image (renders as <img>)
 * - Mocks localStorage
 */

/// <reference types="@testing-library/jest-dom" />

import "@testing-library/jest-dom/vitest";
import { vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Auto-cleanup after each test (avoids state leak between tests)
// ---------------------------------------------------------------------------
afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// matchMedia — MUI needs this for responsive breakpoints
// ---------------------------------------------------------------------------
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// ResizeObserver — used by several MUI components
// ---------------------------------------------------------------------------
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ---------------------------------------------------------------------------
// IntersectionObserver — used by MUI Popover / transitions
// ---------------------------------------------------------------------------
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: "",
  thresholds: [],
}));

// ---------------------------------------------------------------------------
// next/navigation — useRouter, usePathname, useSearchParams
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// next/link — render as plain anchor
// ---------------------------------------------------------------------------
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// next/image — render as plain <img>, honouring the `priority` prop
// (priority=true → loading="eager", otherwise → loading="lazy")
// ---------------------------------------------------------------------------
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    priority,
    ...props
  }: {
    src: string;
    alt: string;
    priority?: boolean;
    [k: string]: unknown;
  }) => (
    <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// next-auth/react — useSession + signIn
// ---------------------------------------------------------------------------
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn().mockResolvedValue({ ok: true, error: null }),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ---------------------------------------------------------------------------
// localStorage — available in jsdom but reset between tests for cleanliness
// ---------------------------------------------------------------------------
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});
