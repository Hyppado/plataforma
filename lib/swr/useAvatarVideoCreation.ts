/**
 * lib/swr/useAvatarVideoCreation.ts
 *
 * SWR hook for fetching a single AvatarVideoCreation by ID.
 * Used by the avatar video wizard pages.
 */

"use client";

import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { CreationDTO } from "@/lib/avatar-video/types";

interface CreationResponse {
  creation: CreationDTO;
}

export function useAvatarVideoCreation(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<CreationResponse>(
    id ? `/api/avatar-video/creations/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5_000,
    },
  );

  return {
    creation: data?.creation ?? null,
    isLoading,
    error: error?.message ?? null,
    mutate,
  };
}
