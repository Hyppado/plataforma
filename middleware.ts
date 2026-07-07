import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Per-request nonce-based Content-Security-Policy
// Middleware runs before every matched request, so each response gets a unique
// nonce. Next.js reads x-nonce from the forwarded request headers and applies
// it to its own inline hydration scripts automatically (App Router, 13.4+).
// ---------------------------------------------------------------------------

function buildCsp(nonce: string): string {
  // In development, Next.js Fast Refresh / HMR evaluates code via eval(), which
  // a strict CSP blocks — breaking hydration (data never loads, click handlers
  // like logout never attach). Allow 'unsafe-eval' in dev only; production stays
  // strict (no eval is emitted in a production build).
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    [
      "img-src 'self' data: blob:",
      "https://*.tiktokcdn.com",
      "https://*.tiktokcdn-us.com",
      "https://*.public.blob.vercel-storage.com",
    ].join(" "),
    "media-src 'self' https://*.public.blob.vercel-storage.com",
    "connect-src 'self' https://fonts.googleapis.com https://*.public.blob.vercel-storage.com",
    "frame-src https://www.tiktok.com https://www.youtube.com https://player.vimeo.com https://www.instagram.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Generate a unique nonce per request. crypto.randomUUID() is available
    // in the Next.js Edge runtime. Base64-encode for CSP compatibility.
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = buildCsp(nonce);

    // Redirect logged-in users away from the landing page
    if (pathname === "/" && token) {
      const res = NextResponse.redirect(new URL("/dashboard/videos", req.url));
      res.headers.set("Content-Security-Policy", csp);
      return res;
    }

    // Admin routes (UI and API) require ADMIN role
    if (
      (pathname.startsWith("/dashboard/admin") ||
        pathname.startsWith("/api/admin")) &&
      token?.role !== "ADMIN"
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const res = NextResponse.redirect(new URL("/dashboard/videos", req.url));
      res.headers.set("Content-Security-Policy", csp);
      return res;
    }

    // Block soft-deleted users (LGPD)
    if (token?.deleted) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Account deleted" }, { status: 403 });
      }
      const res = NextResponse.redirect(
        new URL("/login?error=account_deleted", req.url),
      );
      res.headers.set("Content-Security-Policy", csp);
      return res;
    }

    // Block deactivated sessions (status no longer ACTIVE / access revoked).
    // The jwt callback flags the token as deactivated; bounce the user to the
    // login page instead of leaving them stuck on a session that loads no data.
    if (token?.deactivated) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });
      }
      const res = NextResponse.redirect(
        new URL("/login?error=session_expired", req.url),
      );
      res.headers.set("Content-Security-Policy", csp);
      return res;
    }

    // Forward the nonce in request headers so Next.js propagates it to its
    // own inline hydration <script> tags. The layout reads it via
    // headers().get('x-nonce') if it needs to pass it to explicit <Script>s.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  },
  {
    callbacks: {
      // / is public; for everything else require a valid JWT
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname === "/") return true;
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: ["/", "/dashboard/:path*", "/api/admin/:path*"],
};
