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
import { uploadImageToBlob } from "@/lib/storage/blob";
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
 * Combines product context, avatar description, and optional scenario hint.
 */
export function buildImagePromptText(
  creation: AvatarVideoCreation,
  avatar: AvatarProfile | null,
  scenario: VideoScenario | null,
): string {
  const parts: string[] = [];

  if (avatar) {
    parts.push(`Avatar: ${avatar.name}.`);
    if (avatar.description) parts.push(avatar.description);
  }

  if (creation.productName) {
    parts.push(`Produto: ${creation.productName}.`);
  }

  if (creation.productCategory) {
    parts.push(`Categoria: ${creation.productCategory}.`);
  }

  if (scenario?.promptHint) {
    parts.push(`Contexto: ${scenario.promptHint}`);
  }

  parts.push(
    "Gere uma imagem de referência de alta qualidade, fundo neutro, iluminação profissional, adequada para vídeo UGC de TikTok Shop.",
  );

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Generate and persist one image variation
// ---------------------------------------------------------------------------

/**
 * Generates a single image variation for the given creation.
 * Creates an `AvatarVideoImageVariation` row, calls the generation API,
 * uploads to Blob, then marks the variation READY (or FAILED).
 *
 * @param creationId   AvatarVideoCreation.id
 * @param sortOrder    Slot index (0 or 1)
 * @param promptText   Pre-built prompt from `buildImagePromptText`
 */
export async function generateImageVariation(
  creationId: string,
  sortOrder: number,
  promptText: string,
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
    const blobUrl = await _callImageGenerationAPI(promptText, variation.id);

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
// DALL-E 3 image generation + Vercel Blob upload
// ---------------------------------------------------------------------------

/**
 * @internal Calls DALL-E 3 to generate a reference image, then uploads the
 * result to Vercel Blob for permanent storage.
 *
 * @param promptText   Assembled prompt for DALL-E 3
 * @param variationId  AvatarVideoImageVariation.id — used as the blob file name
 * @returns            Permanent Vercel Blob URL
 */
async function _callImageGenerationAPI(
  promptText: string,
  variationId: string,
): Promise<string> {
  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error(
      "Chave OpenAI não configurada. Configure a chave no painel admin.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: promptText,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo limite da OpenAI excedido (60s)");
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

  const data = (await response.json()) as { data?: Array<{ url?: string }> };
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("OpenAI retornou resposta inválida (sem URL de imagem)");
  }

  // Download and re-upload to Vercel Blob for permanent storage
  // (DALL-E URLs expire after ~1 hour)
  const blobPath = `avatar-video/${variationId}.png`;
  const blobUrl = await uploadImageToBlob(imageUrl, blobPath);

  if (!blobUrl) {
    throw new Error(
      "Falha ao fazer upload da imagem gerada para o armazenamento",
    );
  }

  return blobUrl;
}
