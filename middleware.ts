import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Redirect authenticated users away from the landing page
    if (pathname === "/" && token) {
      return NextResponse.redirect(new URL("/dashboard/videos", req.url));
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
      return NextResponse.redirect(new URL("/dashboard/videos", req.url));
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
