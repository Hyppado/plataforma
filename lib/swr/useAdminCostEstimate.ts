/**
 * lib/swr/useAdminCostEstimate.ts
 *
 * Fetches active plans and current USD→BRL rate for the cost estimation tab.
 */

"use client";

import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { PlanQuotaFields } from "@/lib/admin/cost-model";

export interface PlanWithMeta extends PlanQuotaFields {
  id: string;
  name: string;
  displayPrice: string | null;
  periodicity: "MONTHLY" | "ANNUAL";
}

export interface CostEstimateResponse {
  plans: PlanWithMeta[];
  /** Current USD → BRL exchange rate (PTAX BCB). Defaults to 5.5 if never fetched. */
  usdToBrl: number;
  /** ISO date string of the rate (e.g. "2026-04-18"), or null. */
  rateDate: string | null;
  /** ISO datetime when the rate was last fetched, or null. */
  rateFetchedAt: string | null;
}

export function useAdminCostEstimate() {
  const { data, error, isLoading } = useSWR<CostEstimateResponse>(
    "/api/admin/cost-estimate",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000, // 5 min — rate changes at most daily
    },
  );

  return {
    data,
    error,
    isLoading,
  };
}
