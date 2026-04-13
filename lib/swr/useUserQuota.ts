/**
 * lib/swr/useUserQuota.ts
 *
 * SWR hook for the authenticated user's quota usage and plan limits.
 * Fetches from GET /api/usage (user-facing, plan-based).
 *
 * Exposes USER_QUOTA_KEY so other components (e.g. VideoCard) can trigger
 * revalidation after consuming quota: `mutate(USER_QUOTA_KEY)`.
 */

"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { fetcher } from "./fetcher";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserQuotaData {
  transcriptsUsed: number;
  scriptsUsed: number;
  insightsUsed: number;
  transcriptsLimit: number;
  scriptsLimit: number;
  periodStart: string;
  periodEnd: string;
}

export interface UserQuotaState {
  transcripts: { used: number; limit: number };
  scripts: { used: number; limit: number };
  isLoading: boolean;
  error: Error | undefined;
}

// ---------------------------------------------------------------------------
// SWR key — exported for external revalidation
// ---------------------------------------------------------------------------

export const USER_QUOTA_KEY = "/api/usage";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUserQuota(): UserQuotaState {
  const { data, error, isLoading } = useSWR<UserQuotaData>(
    USER_QUOTA_KEY,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    },
  );

  return {
    transcripts: {
      used: data?.transcriptsUsed ?? 0,
      limit: data?.transcriptsLimit ?? 0,
    },
    scripts: {
      used: data?.scriptsUsed ?? 0,
      limit: data?.scriptsLimit ?? 0,
    },
    isLoading,
    error,
  };
}

/**
 * Trigger a revalidation of the user quota from anywhere in the app.
 * Call after consuming quota (transcript, insight, script).
 */
export function revalidateUserQuota(): void {
  globalMutate(USER_QUOTA_KEY);
}
