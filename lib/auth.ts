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
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
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

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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
      }
      // Re-read mustChangePassword from DB when the token still carries true.
      // This clears the flag mid-session after the user changes their password
      // without requiring a full sign-out/sign-in cycle.
      if (token.mustChangePassword && token.userId) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { mustChangePassword: true },
        });
        if (fresh) token.mustChangePassword = fresh.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
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
