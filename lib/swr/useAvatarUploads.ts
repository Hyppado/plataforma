/**
 * lib/swr/useAvatarUploads.ts
 *
 * SWR hook — fetches the authenticated user's saved avatar uploads
 * from GET /api/influencer-ia/avatar-uploads.
 */

import useSWR from "swr";

export interface AvatarUploadItem {
  id: string;
  blobUrl: string;
  label: string | null;
  createdAt: string;
}

interface AvatarUploadsResponse {
  uploads: AvatarUploadItem[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAvatarUploads() {
  const { data, error, isLoading, mutate } = useSWR<AvatarUploadsResponse>(
    "/api/influencer-ia/avatar-uploads",
    fetcher,
  );

  return {
    uploads: data?.uploads ?? [],
    isLoading,
    error,
    mutate,
  };
}
