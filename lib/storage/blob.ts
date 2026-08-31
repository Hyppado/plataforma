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
/** Máximo de URLs por chamada, conforme a doc da EchoTik. */
const COVER_BATCH_SIZE = 10;

/**
 * Assina VÁRIAS URLs do CDN da EchoTik numa só chamada.
 *
 * O endpoint batch/cover/download aceita até 10 URLs por requisição e não
 * consome cota (global-rules §4). Antes assinávamos uma por vez, gerando ~10x
 * mais chamadas do que o necessário — e chamada desnecessária é justamente o
 * que dispara o risk control da EchoTik.
 *
 * @param coverUrls - URLs do CDN da EchoTik
 * @returns Mapa urlOriginal → urlAssinada (só com as que deram certo)
 */
export async function signEchotikCoverUrls(
  coverUrls: string[],
): Promise<Map<string, string>> {
  const resultado = new Map<string, string>();
  const elegiveis = coverUrls.filter(isEchotikCdnUrl);
  if (elegiveis.length === 0) return resultado;

  for (let i = 0; i < elegiveis.length; i += COVER_BATCH_SIZE) {
    const lote = elegiveis.slice(i, i + COVER_BATCH_SIZE);

    try {
      const result = await echotikRequest<CoverDownloadResponse>(
        "/api/v3/echotik/batch/cover/download",
        { params: { cover_urls: lote.join(",") } },
      );

      if (result.code !== 0 || !Array.isArray(result.data)) {
        log.warn("batch/cover/download falhou", {
          code: result.code,
          message: result.message,
          lote: lote.length,
        });
        continue;
      }

      // Cada entrada é { urlOriginal: urlAssinada }. Preservamos a chave para
      // casar com a URL de origem — assinar em lote sem isso embaralharia
      // qual assinatura pertence a qual imagem.
      for (const entry of result.data) {
        for (const [original, assinada] of Object.entries(entry ?? {})) {
          if (assinada) resultado.set(original, assinada);
        }
      }
    } catch (error) {
      log.error("Falha ao assinar lote de capas", {
        lote: lote.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return resultado;
}

/**
 * Assina UMA URL do CDN da EchoTik.
 * Mantido para os caminhos sob demanda (proxy de imagem, Influencer IA),
 * onde só existe uma imagem por vez. Internamente usa a versão em lote.
 */
export async function signEchotikCoverUrl(
  coverUrl: string,
): Promise<string | null> {
  const mapa = await signEchotikCoverUrls([coverUrl]);
  // A EchoTik pode devolver a chave normalizada; se só veio um resultado,
  // aceita-o mesmo que a chave não bata exatamente.
  const direto = mapa.get(coverUrl);
  if (direto) return direto;
  // Sem downlevelIteration: evita spread de MapIterator
  let unica: string | null = null;
  mapa.forEach((v) => { unica = v; });
  return mapa.size === 1 ? unica : null;
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
      // O caminho é determinístico (products/{id}.jpg), então reprocessar o
      // mesmo item cai no mesmo arquivo. Sem isto o Vercel Blob recusa com
      // "This blob already exists" e o item fica com a URL crua do CDN, que
      // expira em horas — foi o que deixou achadinhos reprocessados sem capa.
      // Sobrescrever é o comportamento correto: a imagem nova substitui a
      // antiga do mesmo item.
      allowOverwrite: true,
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

/**
 * Uploads a raw image buffer directly to Vercel Blob Storage.
 * Use this when the image data is already in memory (e.g. decoded from base64).
 *
 * @param buffer       Image data as a Node.js Buffer
 * @param blobPath     Path/name for the blob (e.g. "avatar-video/abc123.png")
 * @param contentType  MIME type (defaults to "image/png")
 * @returns            Permanent Vercel Blob URL, or null on failure
 */
export async function uploadBufferToBlob(
  buffer: Buffer,
  blobPath: string,
  contentType = "image/png",
): Promise<string | null> {
  if (buffer.byteLength === 0) {
    log.warn("Empty buffer, skipping blob upload", { blobPath });
    return null;
  }
  try {
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      // Mesmo motivo do upload por URL acima: caminho determinístico,
      // reprocessar precisa sobrescrever em vez de falhar.
      allowOverwrite: true,
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
