"use client";

import { useState, useEffect } from "react";

export type SubscriptionStatus =
  | "Ativa"
  | "Cancelada"
  | "Em atraso"
  | "Em análise";
export type BillingType =
  | "Cobrança"
  | "Renovação"
  | "Cancelamento"
  | "Reembolso";
export type BillingStatus = "Aprovado" | "Pendente" | "Recusado" | "Estornado";

export interface BillingEvent {
  id: string;
  createdAt: string;
  type: BillingType;
  status: BillingStatus;
  reference: string;
  amountCents: number;
  currency: string;
}

export interface SubscriptionData {
  member: {
    name: string | null;
    email: string;
  } | null;
  subscription: {
    planName: string;
    planCode: string;
    billingCycle: string;
    displayPrice: string | null;
    status: SubscriptionStatus;
    startedAt: string | null;
    nextRenewalAt: string | null;
    cancelledAt: string | null;
    productName: string;
    transcriptsPerMonth: number;
    scriptsPerMonth: number;
    insightTokensMonthlyMax: number;
    scriptTokensMonthlyMax: number;
  } | null;
  billingHistory: BillingEvent[];
  hotmartIntegration: {
    connected: boolean;
    webhookConfigured: boolean;
    subscriberCode: string | null;
  };
}

export interface UseSubscriptionResult {
  data: SubscriptionData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the subscription data for the current user.
 *
 * Identification: reads `NEXT_PUBLIC_DEMO_USER_EMAIL` (set at build time for
 * demo/dev mode) or falls back to requesting without a filter (the API will
 * return 400 and the hook will surface the error gracefully).
 *
 * TODO: replace with session-derived identity once auth is added.
 */
export function useSubscription(): UseSubscriptionResult {
  const [result, setResult] = useState<UseSubscriptionResult>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const email = process.env.NEXT_PUBLIC_DEMO_USER_EMAIL;
    const params = email ? `?email=${encodeURIComponent(email)}` : "";

    fetch(`/api/user/subscription${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error ?? `HTTP ${res.status}`,
          );
        }
        return res.json() as Promise<SubscriptionData>;
      })
      .then((data) => setResult({ data, loading: false, error: null }))
      .catch((err: Error) =>
        setResult({ data: null, loading: false, error: err.message }),
      );
  }, []);

  return result;
}

/**
 * Format a cents amount to a locale string.
 * e.g. 4990, "BRL" → "R$ 49,90"
 */
export function formatCents(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
