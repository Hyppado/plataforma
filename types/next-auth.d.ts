import type { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "USER";
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "USER";
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId: string;
    role: "ADMIN" | "USER";
    mustChangePassword?: boolean;
  }
}
