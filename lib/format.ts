/**
 * Formatting utilities for the Hyppado UI.
 *
 * Pure formatting helpers — no data fetching, no side effects.
 */

export function formatCurrency(value: number, currency = "BRL"): string {
  const locale = currency === "BRL" ? "pt-BR" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1).replace(".", ",") + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace(".", ",") + "K";
  }
  return value.toLocaleString("pt-BR");
}

export function formatPercentage(value: number): string {
  return (value * 100).toFixed(1).replace(".", ",") + "%";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
