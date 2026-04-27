/**
 * lib/swr/useVideoScenarios.ts
 *
 * Fetches the list of active video scenario templates from
 * GET /api/avatar-video/scenarios.
 */

"use client";

import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { VideoScenarioDTO } from "@/lib/avatar-video/types";

interface ScenariosResponse {
  scenarios: VideoScenarioDTO[];
}

export function useVideoScenarios() {
  const { data, error, isLoading } = useSWR<ScenariosResponse>(
    "/api/avatar-video/scenarios",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // scenario list changes rarely
    },
  );

  return {
    scenarios: data?.scenarios ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
