import useSWR from "swr";
import { fetcher } from "./fetcher";

interface RegionsResponse {
  regions: string[];
}

/**
 * Returns the list of active region codes from the DB.
 * Falls back to the stored region if the request fails.
 */
export function useRegions(fallback: string) {
  const { data } = useSWR<RegionsResponse>("/api/regions", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // cache for 1 min — regions rarely change
  });

  return data?.regions?.length ? data.regions : [fallback];
}
