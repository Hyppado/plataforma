/**
 * lib/swr/useInfluencerUsage.ts
 *
 * SWR hook for the authenticated user's Influencer IA daily generation quota.
 * Fetches from GET /api/influencer-ia/usage.
 */

"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { fetcher } from "./fetcher";

export const INFLUENCER_USAGE_KEY = "/api/influencer-ia/usage";

export interface InfluencerUsageData {
  usedToday: number;
  dailyLimit: number;
}

export function useInfluencerUsage(): InfluencerUsageData & {
  isLoading: boolean;
} {
  const { data, isLoading } = useSWR<InfluencerUsageData>(
    INFLUENCER_USAGE_KEY,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5_000 },
  );
  return {
    usedToday: data?.usedToday ?? 0,
    dailyLimit: data?.dailyLimit ?? 5,
    isLoading,
  };
}

export function revalidateInfluencerUsage(): void {
  globalMutate(INFLUENCER_USAGE_KEY);
}
