/**
 * lib/influencer-ia/batch.ts
 *
 * Submits influencer image generation jobs to the Google AI Batch API and
 * retrieves results. Used by the async generation flow to avoid Vercel's
 * 120s function timeout when generating at 4K resolution.
 *
 * Flow:
 *   submitBatchJob()     → sends job to Google, returns batchJobName immediately
 *   retrieveBatchResult() → called from webhook handler after job completes,
 *                           extracts image and uploads to Vercel Blob
 */

import { randomUUID } from "crypto";
import { GoogleGenAI } from "@google/genai";
import { createLogger } from "@/lib/logger";
import { getSecretSetting, getSetting, SETTING_KEYS } from "@/lib/settings";
import {
  buildPromptAsync,
  fetchImageBuffer,
  type InfluencerImageInput,
} from "@/lib/influencer-ia/generate";
import { uploadBufferToBlob } from "@/lib/storage/blob";

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-image-preview";

// ---------------------------------------------------------------------------
// submitBatchJob
// ---------------------------------------------------------------------------

/**
 * Submits a Gemini Batch API job for influencer image generation.
 * Returns the batch job name (e.g. "batches/abc123") immediately — the actual
 * generation runs asynchronously on Google's side.
 */
export async function submitBatchJob(
  input: InfluencerImageInput,
): Promise<string> {
  const correlationId = input.correlationId ?? randomUUID();
  const log = createLogger("influencer-ia/batch", correlationId);

  const [apiKey, modelSetting] = await Promise.all([
    getSecretSetting(SETTING_KEYS.GOOGLE_AI_API_KEY),
    getSetting(SETTING_KEYS.GOOGLE_AI_MODEL),
  ]);

  if (!apiKey) {
    throw new Error(
      "Chave Google AI Studio não configurada. Configure no painel de administração.",
    );
  }

  const modelId = modelSetting?.trim() || DEFAULT_GEMINI_MODEL;
  const promptText = await buildPromptAsync(input, log);

  // For product-only shots no person is rendered — skip the avatar image.
  const isProductOnly =
    input.pose === "Só Produto" && !input.customPose?.trim();

  const [avatarFetch, productFetch] = await Promise.all([
    input.avatarImageUrl && !isProductOnly
      ? fetchImageBuffer(input.avatarImageUrl, log)
      : null,
    input.productImageUrl ? fetchImageBuffer(input.productImageUrl, log) : null,
  ]);

  if (input.productImageUrl && !productFetch) {
    throw new Error(
      "Não foi possível baixar a imagem do produto selecionado. Tente novamente em instantes.",
    );
  }

  // Build the parts array — same structure as the synchronous flow.
  type Part =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };

  const parts: Part[] = [{ text: promptText }];

  if (productFetch) {
    parts.push({
      text: "PRODUCT REFERENCE IMAGE — reproduce this product exactly (color, shape, label, texture, all details):",
    });
    parts.push({
      inlineData: {
        mimeType: productFetch.contentType,
        data: productFetch.buffer.toString("base64"),
      },
    });
  }

  if (avatarFetch) {
    parts.push({
      text: "INFLUENCER REFERENCE IMAGE — use this person's face, skin tone, and appearance as the influencer in the photo:",
    });
    parts.push({
      inlineData: {
        mimeType: avatarFetch.contentType,
        data: avatarFetch.buffer.toString("base64"),
      },
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  log.info("Submitting Gemini batch job", {
    model: modelId,
    hasAvatarRef: !!avatarFetch,
    hasProductRef: !!productFetch,
  });

  const job = await ai.batches.create({
    model: modelId,
    src: [
      {
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "9:16",
            imageSize: "4K",
          },
        },
      },
    ],
  });

  if (!job.name) {
    throw new Error("Google AI Batch API retornou job sem nome (name)");
  }

  log.info("Batch job submitted", { jobName: job.name, state: job.state });
  return job.name;
}

// ---------------------------------------------------------------------------
// retrieveBatchResult
// ---------------------------------------------------------------------------

/**
 * Fetches a completed batch job, extracts the generated image, uploads it to
 * Vercel Blob, and returns the Blob URL.
 *
 * Must only be called when the job is known to be in JOB_STATE_SUCCEEDED —
 * typically from a webhook handler. Throws for any other state.
 */
export async function retrieveBatchResult(batchJobName: string): Promise<string> {
  const log = createLogger("influencer-ia/batch/retrieve", randomUUID());

  const apiKey = await getSecretSetting(SETTING_KEYS.GOOGLE_AI_API_KEY);
  if (!apiKey) {
    throw new Error(
      "Chave Google AI Studio não configurada. Configure no painel de administração.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  log.info("Fetching batch job result", { jobName: batchJobName });

  const job = await ai.batches.get({ name: batchJobName });

  if (job.state !== "JOB_STATE_SUCCEEDED") {
    const errMsg = job.error
      ? `Google AI batch job falhou: ${JSON.stringify(job.error)}`
      : `Google AI batch job não está concluído (state: ${job.state ?? "unknown"})`;
    throw new Error(errMsg);
  }

  const imagePart = job.dest?.inlinedResponses
    ?.flatMap((r) => r.response?.candidates ?? [])
    .flatMap((c) => c.content?.parts ?? [])
    .find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error("Google AI batch job concluído mas sem imagem na resposta");
  }

  const buffer = Buffer.from(imagePart.inlineData.data, "base64");
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blobPath = `influencer-ia/${fileId}.png`;
  const blobUrl = await uploadBufferToBlob(buffer, blobPath, "image/png");

  if (!blobUrl) {
    throw new Error("Falha ao fazer upload da imagem gerada para o Blob");
  }

  log.info("Batch result retrieved and uploaded", { blobUrl });
  return blobUrl;
}
