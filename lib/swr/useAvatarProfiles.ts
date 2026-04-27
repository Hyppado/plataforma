/**
 * lib/swr/useAvatarProfiles.ts
 *
 * Fetches the list of active avatar profiles from GET /api/avatar-video/avatars.
 */

"use client";

import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { AvatarProfileDTO } from "@/lib/avatar-video/types";

interface AvatarsResponse {
  avatars: AvatarProfileDTO[];
}

export function useAvatarProfiles() {
  const { data, error, isLoading } = useSWR<AvatarsResponse>(
    "/api/avatar-video/avatars",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // avatar list changes rarely
    },
  );

  return {
    avatars: data?.avatars ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
