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
 * The prompt is in English and gives the model clear, category-aware
 * instructions for how to place the product relative to the person —
 * clothing is worn when gender-appropriate, home products are placed in
 * context, beauty is held near the face, etc. Explicit rules prevent the
 * model from distorting the product or inventing details not in the
 * reference images.
 */
export function buildImagePromptText(
  creation: AvatarVideoCreation,
  avatar: AvatarProfile | null,
  scenario: VideoScenario | null,
): string {
  const product = creation.productName ?? "the product";
  const cat = (creation.productCategory ?? "").toLowerCase();

  // ── Category detection ───────────────────────────────────────────────────
  const isClothing =
    /roupa|moda|fashion|vestuário|clothing|apparel|shirt|dress|pants|jeans|jacket|blouse|top|skirt|coat/.test(
      cat,
    );
  const isAccessory =
    /acessório|joia|joalheria|jewelry|bolsa|bag|watch|relógio|óculos|sunglasses|belt|cinto/.test(
      cat,
    );
  const isBeauty =
    /beleza|cosmét|skincare|maquiagem|beauty|perfume|fragrance|creme|serum/.test(
      cat,
    );
  const isTech =
    /tecnologia|eletrôn|tech|gadget|electronic|phone|tablet|headphone|fone/.test(
      cat,
    );
  const isFood = /alimento|bebida|food|snack|drink|beverage|café|coffee/.test(
    cat,
  );
  const isHome =
    /casa|lar|cozinha|home|kitchen|furniture|móvel|décor|utensílio|cleaning|limpeza|decoração/.test(
      cat,
    );

  // ── Subject ───────────────────────────────────────────────────────────────
  const subject = avatar
    ? `${avatar.name}${avatar.description ? `, ${avatar.description}` : ""}`
    : "a young content creator";

  // ── Placement instruction — how the product appears with the person ───────
  let placement: string;
  if (isClothing) {
    placement =
      `The person is wearing "${product}". ` +
      `Use the reference images to determine whether the garment is appropriate for the person's apparent gender and body type — ` +
      `if it clearly is not, show the person holding and displaying the item instead. ` +
      `Reproduce the garment exactly: same color, cut, print, and any visible text or logo.`;
  } else if (isAccessory) {
    placement =
      `The person is wearing or carrying "${product}" as an accessory. ` +
      `Reproduce the item exactly: same color, shape, material finish, and any visible logo or text. No invented details.`;
  } else if (isBeauty) {
    placement =
      `The person is holding "${product}" near their face at chest or chin level, presenting it clearly to camera. ` +
      `Reproduce the product packaging exactly: same color, shape, cap, and label as in the reference image.`;
  } else if (isTech) {
    placement =
      `The person is naturally holding or using "${product}". ` +
      `Reproduce the device exactly: same model, color, and shape as in the reference image. ` +
      `Do not add ports, buttons, or branding not clearly visible in the reference.`;
  } else if (isFood) {
    placement =
      `The person is holding or presenting "${product}" naturally. ` +
      `Reproduce the product packaging or food appearance exactly as in the reference image.`;
  } else if (isHome) {
    placement =
      `"${product}" is placed naturally in its intended home setting. ` +
      `The person is nearby, gesturing toward or interacting with the product. ` +
      `Reproduce the product exactly: same color, shape, and design as in the reference image.`;
  } else {
    placement =
      `The person is holding and presenting "${product}" naturally to camera. ` +
      `Reproduce the product exactly as it appears in the reference image.`;
  }

  // ── Setting / environment ────────────────────────────────────────────────
  let setting: string;
  if (scenario?.promptHint) {
    setting = scenario.promptHint;
  } else if (creation.customScenarioDescription) {
    setting = creation.customScenarioDescription;
  } else if (isHome) {
    setting = "bright, modern home interior";
  } else {
    setting = "bright, clean indoor space with soft natural light";
  }

  return [
    `Photorealistic UGC-style product placement photo for TikTok Shop.`,
    ``,
    `SUBJECT: ${subject}.`,
    `PRODUCT: "${product}" — use the reference image as the exact source of truth. Do NOT invent, add, or change any colors, labels, text, logos, shapes, or details not clearly present in the reference. Do NOT distort the product.`,
    `PLACEMENT: ${placement}`,
    `SETTING: ${setting}.`,
    ``,
    `TECHNICAL REQUIREMENTS:`,
    `- Vertical 9:16 portrait format`,
    `- Natural, professional lighting — photorealistic editorial quality`,
    `- No text overlays, watermarks, or UI elements in the image`,
    `- Do not add props, backgrounds, or accessories not specified above`,
    `- Render the product exactly as in the reference — same shape, color, and finish`,
    `- Product must be clearly visible and the focal point`,
  ].join("\n");
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
          new Blob([new Uint8Array(avatarFetch.buffer)], {
            type: avatarFetch.contentType,
          }),
          "avatar.png",
        );
      }
      if (productFetch) {
        form.append(
          "image[]",
          new Blob([new Uint8Array(productFetch.buffer)], {
            type: productFetch.contentType,
          }),
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
