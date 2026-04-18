import useSWR from "swr";

interface ExchangeRateData {
  rate: number | null;
  date: string | null;
  fetchedAt: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Returns the latest USD→BRL exchange rate from the DB.
 * `rate` is null when not yet fetched or unavailable.
 */
export function useExchangeRate(): number | null {
  const { data } = useSWR<ExchangeRateData>("/api/exchange-rate", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000 * 30, // revalidate at most every 30 min
  });
  return data?.rate ?? null;
}
