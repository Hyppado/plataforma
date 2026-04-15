/**
 * lib/storage/blob.ts — Vercel Blob Storage helpers
 *
 * Downloads images from signed Echotik CDN URLs and uploads them to
 * Vercel Blob Storage for permanent, direct serving (no proxy needed).
 *
 * Requires BLOB_READ_WRITE_TOKEN env var in Vercel.
 */

import { put, del, list } from "@vercel/blob";
import { echotikRequest } from "@/lib/echotik/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("storage/blob");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoverDownloadResponse {
  code: number;
  message: string;
  data: Array<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Echotik CDN signing
// ---------------------------------------------------------------------------

const ECHOTIK_CDN_HOST = "echosell-images.tos-ap-southeast-1.volces.com";

/**
 * Returns true if the URL is from the Echotik CDN that requires signing.
 */
export function isEchotikCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === ECHOTIK_CDN_HOST;
  } catch {
    return false;
  }
}

/**
 * Signs an Echotik CDN URL via the batch/cover/download API.
 * Returns the temporary signed URL, or null on failure.
 */
export async function signEchotikCoverUrl(
  coverUrl: string,
): Promise<string | null> {
  try {
    const result = await echotikRequest<CoverDownloadResponse>(
      "/api/v3/echotik/batch/cover/download",
      { params: { cover_urls: coverUrl } },
    );

    if (
      result.code !== 0 ||
      !Array.isArray(result.data) ||
      result.data.length === 0
    ) {
      log.warn("batch/cover/download failed", {
        code: result.code,
        message: result.message,
      });
      return null;
    }

    const entry = result.data[0];
    const signedUrl = Object.values(entry)[0];
    return signedUrl || null;
  } catch (error) {
    log.error("Failed to sign cover URL", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Blob upload
// ---------------------------------------------------------------------------

/**
 * Downloads an image from a signed URL and uploads it to Vercel Blob Storage.
 *
 * @param signedUrl  Temporary signed URL to download from
 * @param blobPath   Path/name for the blob (e.g. "products/abc123.jpg")
 * @returns          Permanent Vercel Blob URL, or null on failure
 */
export async function uploadImageToBlob(
  signedUrl: string,
  blobPath: string,
): Promise<string | null> {
  try {
    // Download the image
    const response = await fetch(signedUrl, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      log.warn("Image download failed", {
        status: response.status,
        blobPath,
      });
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0) {
      log.warn("Empty image downloaded", { blobPath });
      return null;
    }

    // Upload to Vercel Blob
    const blob = await put(blobPath, Buffer.from(buffer), {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    return blob.url;
  } catch (error) {
    log.error("Blob upload failed", {
      error: error instanceof Error ? error.message : String(error),
      blobPath,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Combined: sign + upload
// ---------------------------------------------------------------------------

/**
 * Signs an Echotik CDN URL, downloads the image, and uploads to Vercel Blob.
 * Returns the permanent blob URL, or null on failure at any step.
 */
export async function uploadEchotikImageToBlob(
  cdnUrl: string,
  blobPath: string,
): Promise<string | null> {
  if (!isEchotikCdnUrl(cdnUrl)) {
    log.warn("Not an Echotik CDN URL, skipping", {
      url: cdnUrl.slice(0, 80),
    });
    return null;
  }

  const signedUrl = await signEchotikCoverUrl(cdnUrl);
  if (!signedUrl) return null;

  return uploadImageToBlob(signedUrl, blobPath);
}

// ---------------------------------------------------------------------------
// Bulk delete
// ---------------------------------------------------------------------------

/**
 * Deletes blobs from Vercel Blob Storage by URL in batches.
 * Skips empty arrays silently.
 *
 * @param urls  Array of Vercel Blob URLs to delete
 * @param batchSize  How many URLs to delete per API call (max 1000)
 * @returns Number of URLs successfully submitted for deletion
 */
export async function deleteBlobs(
  urls: string[],
  batchSize = 100,
): Promise<number> {
  if (urls.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await del(batch);
    deleted += batch.length;
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// List by prefix
// ---------------------------------------------------------------------------

export interface BlobEntry {
  url: string;
  pathname: string;
}

/**
 * Returns all blobs under the given path prefix, following pagination cursors.
 */
export async function listBlobsByPrefix(prefix: string): Promise<BlobEntry[]> {
  const entries: BlobEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor });
    for (const blob of page.blobs) {
      entries.push({ url: blob.url, pathname: blob.pathname });
    }
    cursor = page.cursor;
  } while (cursor);
  return entries;
}
