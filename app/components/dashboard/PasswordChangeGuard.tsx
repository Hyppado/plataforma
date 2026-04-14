"use client";

import { useSession } from "next-auth/react";
import { ForcePasswordChange } from "@/app/components/dashboard/ForcePasswordChange";

/**
 * Renders the ForcePasswordChange modal when the session indicates
 * the user has a temporary password that must be changed.
 */
export function PasswordChangeGuard() {
  const { data: session } = useSession();

  if (!session?.user?.mustChangePassword) return null;

  return <ForcePasswordChange />;
}
