import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin routes (UI and API) require ADMIN role
    if (
      (pathname.startsWith("/app/admin") ||
        pathname.startsWith("/api/admin")) &&
      token?.role !== "ADMIN"
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/app/videos", req.url));
    }

    // Block soft-deleted users (LGPD)
    if (token?.deleted) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Account deleted" }, { status: 403 });
      }
      return NextResponse.redirect(
        new URL("/login?error=account_deleted", req.url),
      );
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Require a valid JWT for all matched routes
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: ["/app/:path*", "/api/admin/:path*"],
};
