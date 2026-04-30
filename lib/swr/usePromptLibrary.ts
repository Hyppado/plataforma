/**
 * SWR hook for the user-facing Biblioteca de Prompts.
 *
 * Fetches all active prompt library items in a single request and returns them
 * alongside the unique category list. Category filtering is done client-side so
 * the full category list is always available for the filter UI without extra
 * round-trips.
 */
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr/fetcher";

export interface PromptLibraryItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  videoBlobUrl: string;
  promptText: string;
}

interface PromptLibraryResponse {
  items: PromptLibraryItem[];
  categories: string[];
}

export function usePromptLibrary() {
  const { data, error, isLoading } = useSWR<PromptLibraryResponse>(
    "/api/prompt-library",
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    items: data?.items ?? [],
    categories: data?.categories ?? [],
    isLoading,
    error,
  };
}
