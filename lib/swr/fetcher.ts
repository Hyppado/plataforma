/**
 * SWR Fetcher and utilities
 *
 * Single source of truth for client-side data fetching via SWR.
 * All authenticated pages should use these helpers instead of raw useEffect+fetch.
 */

/** Default JSON fetcher for SWR */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error ?? `HTTP ${res.status}`) as Error & {
      status: number;
    };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

/** Build URL with query params, skipping empty values */
export function buildUrl(
  base: string,
  params: Record<string, string | number | undefined>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}
