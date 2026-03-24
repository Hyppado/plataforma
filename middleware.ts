import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin routes require ADMIN role
    if (pathname.startsWith("/app/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/app/videos", req.url));
    }

    // Block soft-deleted users (LGPD)
    if (token?.deleted) {
      return NextResponse.redirect(
        new URL("/login?error=account_deleted", req.url),
      );
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Require a valid JWT for all /app/** routes
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: ["/app/:path*"],
};
