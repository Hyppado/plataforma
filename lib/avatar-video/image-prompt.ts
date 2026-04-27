/**
 * lib/avatar-video/image-prompt.ts
 *
 * Image reference generation step for the avatar video flow.
 *
 * Responsibilities:
 *   - Build a prompt describing the desired reference image (avatar + product context)
 *   - Call an image generation API (stub — to be wired when model is chosen)
 *   - Upload result to Vercel Blob
 *   - Persist blobUrl and status on AvatarVideoImageVariation
 *
 * This module is intentionally stubbed — the external image generation
 * API is TBD. The interface is stable; only the internal call changes.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { getSecretSetting, SETTING_KEYS } from "@/lib/settings";
import { uploadBufferToBlob } from "@/lib/storage/blob";
import type {
  AvatarVideoCreation,
  AvatarProfile,
  VideoScenario,
} from "@prisma/client";
import type { ServiceResult } from "./types";

const log = createLogger("avatar-video/image-prompt");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateImageResult {
  variationId: string;
  blobUrl: string;
}

export interface GenerateImageError {
  error: string;
}

export function isImageGenerationError(
  r: GenerateImageResult | GenerateImageError,
): r is GenerateImageError {
  return "error" in r;
}

// ---------------------------------------------------------------------------
// Build prompt text
// ---------------------------------------------------------------------------

/**
 * Assembles the text prompt sent to the image generation model.
 *
 * The prompt describes a photorealistic editorial scene where the avatar model
 * is actively wearing, holding, or interacting with the product in the chosen
 * scenario — not just a side-by-side listing of data points.
 */
export function buildImagePromptText(
  creation: AvatarVideoCreation,
  avatar: AvatarProfile | null,
  scenario: VideoScenario | null,
): string {
  // Subject — the person in the image
  const subject = avatar
    ? `${avatar.name}${avatar.description ? `, ${avatar.description}` : ""}`
    : "uma pessoa jovem, estilo criador de conteúdo digital";

  // Interaction verb — how the person relates to the product, based on category
  const product = creation.productName ?? "o produto";
  const cat = (creation.productCategory ?? "").toLowerCase();

  let interaction: string;
  if (
    cat.includes("roupa") ||
    cat.includes("moda") ||
    cat.includes("fashion") ||
    cat.includes("vestuário") ||
    cat.includes("clothing")
  ) {
    interaction = `vestindo e exibindo ${product}`;
  } else if (
    cat.includes("acessório") ||
    cat.includes("joia") ||
    cat.includes("joalheria") ||
    cat.includes("jewelry") ||
    cat.includes("bolsa")
  ) {
    interaction = `usando ${product} como acessório, com destaque para o item`;
  } else if (
    cat.includes("beleza") ||
    cat.includes("cosmét") ||
    cat.includes("skincare") ||
    cat.includes("maquiagem") ||
    cat.includes("beauty")
  ) {
    interaction = `segurando ${product} próximo ao rosto, produto claramente visível`;
  } else if (
    cat.includes("tecnologia") ||
    cat.includes("eletrôn") ||
    cat.includes("tech") ||
    cat.includes("gadget")
  ) {
    interaction = `usando e demonstrando ${product} nas mãos`;
  } else if (
    cat.includes("alimento") ||
    cat.includes("bebida") ||
    cat.includes("food") ||
    cat.includes("snack")
  ) {
    interaction = `segurando e apresentando ${product} de forma apetitosa`;
  } else {
    interaction = `segurando e apresentando ${product} com naturalidade`;
  }

  // Setting / environment
  let setting: string;
  if (scenario?.promptHint) {
    setting = scenario.promptHint;
  } else if (creation.customScenarioDescription) {
    setting = creation.customScenarioDescription;
  } else {
    setting = "ambiente interno luminoso e moderno";
  }

  return [
    `Fotografia publicitária realista no estilo UGC para TikTok Shop.`,
    `${subject}, ${interaction}, no cenário: ${setting}.`,
    `O produto está bem visível e integrado à cena de forma natural e autêntica.`,
    `Orientação vertical (formato 9:16), iluminação natural e profissional, altamente fotorrealista, sem texto ou marcas d'água.`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Generate and persist one image variation
// ---------------------------------------------------------------------------

/**
 * Generates a single image variation for the given creation.
 * Creates an `AvatarVideoImageVariation` row, calls the generation API,
 * uploads to Blob, then marks the variation READY (or FAILED).
 *
 * @param creationId       AvatarVideoCreation.id
 * @param sortOrder        Slot index (0 or 1)
 * @param promptText       Pre-built prompt from `buildImagePromptText`
 * @param avatarImageUrl   URL of the avatar/person reference image (optional)
 * @param productImageUrl  URL of the product reference image (optional)
 */
export async function generateImageVariation(
  creationId: string,
  sortOrder: number,
  promptText: string,
  avatarImageUrl?: string | null,
  productImageUrl?: string | null,
): Promise<ServiceResult<GenerateImageResult>> {
  let variation: { id: string };

  try {
    // Create variation row in PROCESSING state
    variation = await prisma.avatarVideoImageVariation.create({
      data: {
        creationId,
        sortOrder,
        status: "PROCESSING",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to create image variation row", {
      creationId,
      sortOrder,
      error: message,
    });
    return { ok: false, error: message, code: "internal" };
  }

  log.info("Image variation generation started", {
    creationId,
    variationId: variation.id,
    sortOrder,
  });

  try {
    const blobUrl = await _callImageGenerationAPI(
      promptText,
      variation.id,
      avatarImageUrl ?? null,
      productImageUrl ?? null,
    );

    await prisma.avatarVideoImageVariation.update({
      where: { id: variation.id },
      data: { blobUrl, status: "READY" },
    });

    log.info("Image variation ready", { variationId: variation.id });
    return { ok: true, data: { variationId: variation.id, blobUrl } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Image variation failed", {
      variationId: variation.id,
      error: message,
    });

    await prisma.avatarVideoImageVariation.update({
      where: { id: variation.id },
      data: { status: "FAILED", errorMessage: message },
    });

    return { ok: false, error: message, code: "internal" };
  }
}

// ---------------------------------------------------------------------------
// Helper: fetch a remote URL into a Buffer
// ---------------------------------------------------------------------------

async function _fetchImageBuffer(
  url: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 0 ? { buffer: buf, contentType } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// gpt-image-1 image editing with reference images + Vercel Blob upload
// ---------------------------------------------------------------------------

/**
 * @internal Calls the OpenAI Images edits API (gpt-image-1) to compose a
 * reference image from the avatar photo and product image, then uploads the
 * base64-encoded result directly to Vercel Blob.
 *
 * We use `/v1/images/edits` (multipart) so that gpt-image-1 can use the
 * actual avatar face and the actual product as visual anchors — rather than
 * hallucinating both from a text description alone.
 *
 * Reference priority:
 *   1. avatarImageUrl  — the person that should appear in the image
 *   2. productImageUrl — the product that the person should be holding / wearing
 *
 * If neither is available, falls back to text-only `/v1/images/generations`.
 *
 * @param promptText      Assembled prompt from `buildImagePromptText`
 * @param variationId     AvatarVideoImageVariation.id — blob file name
 * @param avatarImageUrl  URL of the avatar/person reference (Vercel Blob or external)
 * @param productImageUrl URL of the product reference (Vercel Blob or external)
 * @returns               Permanent Vercel Blob URL
 */
async function _callImageGenerationAPI(
  promptText: string,
  variationId: string,
  avatarImageUrl: string | null,
  productImageUrl: string | null,
): Promise<string> {
  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error(
      "Chave OpenAI não configurada. Configure a chave no painel admin.",
    );
  }

  // Fetch reference images in parallel (skip on failure — degrade gracefully)
  const [avatarFetch, productFetch] = await Promise.all([
    avatarImageUrl ? _fetchImageBuffer(avatarImageUrl) : null,
    productImageUrl ? _fetchImageBuffer(productImageUrl) : null,
  ]);

  const hasReferences = !!(avatarFetch || productFetch);

  log.info("Image generation references", {
    variationId,
    hasAvatar: !!avatarFetch,
    hasProduct: !!productFetch,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);

  let response: Response;
  try {
    if (hasReferences) {
      // --- /v1/images/edits (multipart) with reference images ---
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", promptText);
      form.append("n", "1");
      form.append("size", "1024x1024");
      form.append("quality", "medium");

      if (avatarFetch) {
        form.append(
          "image[]",
          new Blob([new Uint8Array(avatarFetch.buffer)], { type: avatarFetch.contentType }),
          "avatar.png",
        );
      }
      if (productFetch) {
        form.append(
          "image[]",
          new Blob([new Uint8Array(productFetch.buffer)], { type: productFetch.contentType }),
          "product.png",
        );
      }

      response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } else {
      // --- /v1/images/generations (JSON) fallback when no references ---
      response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: promptText,
          n: 1,
          size: "1024x1024",
          quality: "medium",
        }),
        signal: controller.signal,
      });
    }
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo limite da OpenAI excedido (110s)");
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `OpenAI image generation failed (${response.status}): ${errorText.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64 || typeof b64 !== "string") {
    throw new Error("OpenAI retornou resposta inválida (sem imagem base64)");
  }

  // Decode base64 → Buffer and upload directly (no second HTTP request)
  const buffer = Buffer.from(b64, "base64");
  const blobPath = `avatar-video/${variationId}.png`;
  const blobUrl = await uploadBufferToBlob(buffer, blobPath, "image/png");

  if (!blobUrl) {
    throw new Error(
      "Falha ao fazer upload da imagem gerada para o armazenamento",
    );
  }

  return blobUrl;
}
