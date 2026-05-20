import type { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Auth helpers — eliminate boilerplate across API routes
// ---------------------------------------------------------------------------

type AuthResult =
  | { session: Session; userId: string; role: "ADMIN" | "USER" }
  | NextResponse;

/**
 * Require an authenticated session. Returns typed user info or a 401 response.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  if (!userId) {
    // Covers deactivated tokens: the session callback clears the id when the
    // user's status is no longer ACTIVE (checked periodically in the jwt callback).
    return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });
  }
  return { session, userId, role: session.user.role };
}

/**
 * Require an authenticated ADMIN session. Returns typed user info or 401/403.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (result.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

/**
 * Type guard — true when the result is a valid session (not an error response).
 */
export function isAuthed(
  result: AuthResult,
): result is { session: Session; userId: string; role: "ADMIN" | "USER" } {
  return !(result instanceof NextResponse);
}

// ---------------------------------------------------------------------------
// NextAuth config
// ---------------------------------------------------------------------------

// 8 hours — sessions expire daily; short enough to detect account deactivation
// without forcing re-login too often.
const SESSION_MAX_AGE = 8 * 60 * 60; // seconds
// How often the jwt callback re-checks the user's status in the DB.
const STATUS_CHECK_INTERVAL = 15 * 60; // seconds

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) return null;
        if (user.status !== "ACTIVE") return null;
        if (user.deletedAt) return null; // LGPD soft-deleted

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role: "ADMIN" | "USER" }).role;
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ??
          false;
        token.statusCheckedAt = Math.floor(Date.now() / 1000);
      }

      // Periodically re-check the user's account status so that deactivated /
      // suspended / deleted accounts lose access within STATUS_CHECK_INTERVAL
      // seconds without waiting for the full session to expire.
      if (token.userId) {
        const now = Math.floor(Date.now() / 1000);
        const lastCheck = token.statusCheckedAt ?? 0;
        if (now - lastCheck >= STATUS_CHECK_INTERVAL) {
          const fresh = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { status: true, deletedAt: true, mustChangePassword: true },
          });
          token.statusCheckedAt = now;
          if (
            !fresh ||
            fresh.status !== "ACTIVE" ||
            fresh.deletedAt !== null
          ) {
            token.deactivated = true;
          } else {
            token.deactivated = false;
            token.mustChangePassword = fresh.mustChangePassword;
          }
        }
      }

      // Re-read mustChangePassword from DB when the token still carries true
      // (outside the periodic check window) so the flag clears mid-session.
      if (token.mustChangePassword && token.userId && !token.deactivated) {
        const now = Math.floor(Date.now() / 1000);
        // Skip if we just refreshed from the periodic check above.
        if (now - (token.statusCheckedAt ?? 0) > 5) {
          const fresh = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { mustChangePassword: true },
          });
          if (fresh) token.mustChangePassword = fresh.mustChangePassword;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Deactivated tokens: clear the user id so requireAuth returns 401.
        if (token.deactivated) {
          session.user.id = "";
        } else {
          session.user.id = token.userId as string;
        }
        session.user.role = token.role as "ADMIN" | "USER";
        session.user.mustChangePassword = token.mustChangePassword as
          | boolean
          | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
