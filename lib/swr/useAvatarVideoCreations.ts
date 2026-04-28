/**
 * lib/swr/useAvatarVideoCreations.ts
 *
 * SWR hook for listing all AvatarVideoCreations for the current user.
 * Used by the "Meus Prompts" library page.
 */

"use client";

import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { CreationDTO } from "@/lib/avatar-video/types";

interface CreationsResponse {
  creations: CreationDTO[];
}

export function useAvatarVideoCreations() {
  const { data, error, isLoading, mutate } = useSWR<CreationsResponse>(
    "/api/avatar-video/creations",
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    },
  );

  return {
    creations: data?.creations ?? [],
    isLoading,
    error: error?.message ?? null,
    mutate,
  };
}
