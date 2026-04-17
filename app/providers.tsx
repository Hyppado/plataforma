"use client";

import { SessionProvider } from "next-auth/react";
import { CookieBanner } from "@/app/components/ui/CookieBanner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <CookieBanner />
    </SessionProvider>
  );
}
