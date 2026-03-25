"use client";

import { useState, useEffect, useCallback } from "react";
import type { QuotaPolicy, QuotaUsage } from "@/lib/types/admin";
import { getQuotaPolicy } from "@/lib/admin/admin-client";

/** Quota state for header display */
export interface QuotaState {
  transcripts: {
    used: number | null;
    max: number;
  };
  scripts: {
    used: number | null;
    max: number;
  };
  policy: QuotaPolicy;
}

/**
 * Hook to get current quota usage state.
 * Reads from localStorage (admin-configured policy) and fetches usage from API.
 * Returns used/max for transcripts and scripts.
 */
export function useQuotaUsage(): QuotaState {
  const [state, setState] = useState<QuotaState>({
    transcripts: { used: null, max: 40 },
    scripts: { used: null, max: 70 },
    policy: {
      transcriptsPerMonth: 40,
      scriptsPerMonth: 70,
      insightTokensPerMonth: 50000,
      scriptTokensPerMonth: 20000,
      insightMaxOutputTokens: 800,
      scriptMaxOutputTokens: 1500,
    },
  });

  useEffect(() => {
    // Fetch quota policy and usage from API
    (async () => {
      try {
        const [policy, usage] = await Promise.all([
          getQuotaPolicy(),
          fetch("/api/admin/quota-usage").then((res) => (res.ok ? res.json() : null)),
        ]);
        setState({
          transcripts: {
            used: usage?.transcriptsUsed ?? null,
            max: policy.transcriptsPerMonth,
          },
          scripts: {
            used: usage?.scriptsUsed ?? null,
            max: policy.scriptsPerMonth,
          },
          policy,
        });
      } catch {
        // fallback: keep default state
      }
    })();
  }, []);

  return state;
}

/**
 * Hook to manage quota policy with refresh capability.
 */
// Deprecated: useQuotaPolicy is no longer needed; use API-backed config.

/**
 * Format quota for display in header.
 * Returns "12 / 40" or "— / 40" or "— / —"
 */
export function formatQuotaDisplay(
  used: number | null,
  max: number | null,
): string {
  const usedStr = used !== null ? used.toLocaleString("pt-BR") : "—";
  const maxStr = max !== null ? max.toLocaleString("pt-BR") : "—";
  return `${usedStr} / ${maxStr}`;
}
