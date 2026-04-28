/**
 * lib/influencer-ia/generate.ts
 *
 * Generates UGC-style influencer images.
 *
 * Strategy:
 *   1. Try Google AI Studio (gemini-2.0-flash-preview-image-generation) if key is configured.
 *   2. Fall back to OpenAI gpt-image-1 if Google AI key is absent or the call fails.
 */

import { createLogger } from "@/lib/logger";
import { getSecretSetting, SETTING_KEYS } from "@/lib/settings";
import { uploadBufferToBlob } from "@/lib/storage/blob";

const log = createLogger("influencer-ia/generate");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InfluencerImageInput {
  avatarImageUrl: string | null;
  avatarName: string | null;
  avatarDescription: string | null;
  productImageUrl: string | null;
  productName: string | null;
  productCategory: string | null;
  /** Preset pose label (e.g. "De Frente", "Selfie") */
  pose: string | null;
  /** Free-text override — takes priority over preset */
  customPose: string | null;
  /** Preset environment label (e.g. "Casa", "Estúdio") */
  environment: string | null;
  /** Free-text override — takes priority over preset */
  customEnvironment: string | null;
  /** Single influencer style label (e.g. "Elegante") */
  style: string | null;
  /** Selected image-enhancement labels */
  enhancements: string[];
}

export interface InfluencerImageResult {
  imageUrl: string;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const POSE_DESCRIPTIONS: Record<string, string> = {
  "De Frente":
    "facing the camera directly, standing upright, showing the product clearly to camera",
  Selfie: "casual selfie style, holding phone up, authentic and natural look",
  POV: "POV shot, arms extended toward the viewer, first-person perspective",
  "Mirror Selfie":
    "mirror selfie showing full body and outfit, natural bathroom or bedroom setting",
  Sentada: "seated casually, relaxed natural posture, product visible",
  "Só Produto":
    "product-only flat-lay or styled product shot — NO person in the image",
};

const ENV_DESCRIPTIONS: Record<string, string> = {
  Casa: "cozy modern home interior with soft warm lighting",
  Estúdio: "clean photography studio, white or gradient seamless background",
  "Ao ar livre": "outdoor setting with bright natural daylight",
  Academia: "gym or fitness center environment",
  Cozinha: "bright modern kitchen",
};

const STYLE_DESCRIPTIONS: Record<string, string> = {
  Casual: "casual everyday clothing — jeans, t-shirt, relaxed fit",
  Profissional: "professional business attire — blazer, polished look",
  Esportivo: "athletic sportswear — leggings, running shoes, active gear",
  Elegante: "elegant polished fashion — tailored pieces, refined aesthetic",
  Minimalista: "minimalist clothing — clean lines, neutral tones",
  Streetwear: "streetwear urban style — oversized hoodie, sneakers",
  Boho: "bohemian boho style — flowy fabrics, earthy tones",
  Suave: "soft pastel aesthetic — gentle colors, feminine details",
  Colorido: "vibrant colorful outfit — bold saturated tones",
  Verão: "summer style — light fabrics, bright colors, warm-weather look",
  Trendy: "on-trend current fashion — modern silhouettes",
  Básico: "basic neutral clothing — white tee, beige tones, everyday minimal",
};

const ENHANCEMENT_DESCRIPTIONS: Record<string, string> = {
  "Pele Ultra Realista": "ultra-realistic skin texture and visible pores",
  "Iluminação Natural": "soft natural golden-hour lighting",
  "Realismo e Detalhamento": "photorealistic fine detail and sharpness",
  "Cores Vibrantes": "vibrant, saturated color grading",
  "Profundidade de Campo": "shallow depth of field with background bokeh blur",
  "Mãos Perfeitas": "perfect anatomically correct hands, no finger distortion",
};

function buildPrompt(input: InfluencerImageInput): string {
  const subject = input.avatarName
    ? `${input.avatarName}${input.avatarDescription ? `, ${input.avatarDescription}` : ""}`
    : "a young Brazilian content creator";

  const product = input.productName ?? "the product";
  const cat = (input.productCategory ?? "").toLowerCase();

  // Category-aware placement
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

  let placement: string;
  if (isClothing) {
    placement =
      `The person is wearing "${product}", displaying it naturally to camera. ` +
      `Reproduce the garment exactly: same color, cut, print, and any visible text or logo.`;
  } else if (isAccessory) {
    placement =
      `The person is wearing or carrying "${product}". ` +
      `Reproduce the item exactly: same color, shape, material finish, and any visible logo or text.`;
  } else if (isBeauty) {
    placement =
      `The person is holding "${product}" near their face at chest or chin level, presenting it clearly to camera. ` +
      `Reproduce the product packaging exactly.`;
  } else {
    placement =
      `The person is holding and presenting "${product}" naturally to camera. ` +
      `Reproduce the product exactly as in the reference image.`;
  }

  const poseStr = input.customPose?.trim() || input.pose;
  const poseDescription = poseStr
    ? (POSE_DESCRIPTIONS[poseStr] ?? poseStr)
    : "natural, confident pose facing camera";

  const poseIsSoProduct = input.pose === "Só Produto" && !input.customPose;

  const envStr = input.customEnvironment?.trim() || input.environment;
  const envDescription =
    envStr && envStr !== "Outros"
      ? (ENV_DESCRIPTIONS[envStr] ?? envStr)
      : "bright, clean indoor space with soft natural light";

  const styleDescription = input.style
    ? (STYLE_DESCRIPTIONS[input.style] ?? input.style)
    : "";

  const enhancementLines = input.enhancements
    .map((e) => ENHANCEMENT_DESCRIPTIONS[e] ?? e)
    .filter(Boolean)
    .map((d) => `- ${d}`);

  const lines = [
    "Photorealistic UGC-style product placement photo for TikTok Shop.",
    "",
    poseIsSoProduct
      ? "SUBJECT: Product-only shot — no person in the image."
      : `SUBJECT: ${subject}.`,
    `PRODUCT: "${product}" — use the reference image as the exact source of truth. Do NOT invent, add, or change any colors, labels, text, logos, shapes, or details. Do NOT distort the product.`,
    poseIsSoProduct ? "" : `PLACEMENT: ${placement}`,
    `POSE: ${poseDescription}.`,
    `SETTING: ${envDescription}.`,
    styleDescription ? `INFLUENCER STYLE: ${styleDescription}.` : "",
    "",
    "TECHNICAL REQUIREMENTS:",
    "- Vertical 9:16 portrait format",
    "- Photorealistic editorial quality — must look like a real professional photo, NOT AI-generated",
    "- No text overlays, watermarks, or UI elements",
    "- Product must be clearly visible and sharp",
    "- Render the product exactly as in the reference — same shape, color, and finish",
    ...enhancementLines,
  ].filter((l) => l !== "");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Image fetch helper
// ---------------------------------------------------------------------------

async function fetchImageBuffer(
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
// Main generation function
// ---------------------------------------------------------------------------

export async function generateInfluencerImage(
  input: InfluencerImageInput,
): Promise<InfluencerImageResult> {
  const googleApiKey = await getSecretSetting(SETTING_KEYS.GOOGLE_AI_API_KEY);

  if (!googleApiKey) {
    throw new Error(
      "Chave Google AI Studio não configurada. Configure no painel de administração.",
    );
  }

  const promptText = buildPrompt(input);

  log.info("Generating influencer image", {
    avatarName: input.avatarName,
    productName: input.productName,
    pose: input.pose,
    environment: input.environment,
    style: input.style,
    provider: "google-ai",
  });

  const [avatarFetch, productFetch] = await Promise.all([
    input.avatarImageUrl ? fetchImageBuffer(input.avatarImageUrl) : null,
    input.productImageUrl ? fetchImageBuffer(input.productImageUrl) : null,
  ]);

  const buffer = await generateWithGemini(
    googleApiKey,
    promptText,
    avatarFetch,
    productFetch,
  );

  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blobPath = `influencer-ia/${fileId}.png`;
  const blobUrl = await uploadBufferToBlob(buffer, blobPath, "image/png");

  if (!blobUrl) {
    throw new Error("Falha ao fazer upload da imagem gerada");
  }

  log.info("Influencer image generated", { blobUrl });
  return { imageUrl: blobUrl };
}

// ---------------------------------------------------------------------------
// Google AI Studio (gemini-2.0-flash-exp)
// ---------------------------------------------------------------------------

async function generateWithGemini(
  apiKey: string,
  promptText: string,
  avatarFetch: { buffer: Buffer; contentType: string } | null,
  productFetch: { buffer: Buffer; contentType: string } | null,
): Promise<Buffer> {
  const GEMINI_MODEL = "gemini-2.0-flash-exp";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Build parts — text first, then inline image data
  const parts: unknown[] = [{ text: promptText }];

  if (avatarFetch) {
    parts.push({
      inlineData: {
        mimeType: avatarFetch.contentType,
        data: avatarFetch.buffer.toString("base64"),
      },
    });
  }
  if (productFetch) {
    parts.push({
      inlineData: {
        mimeType: productFetch.contentType,
        data: productFetch.buffer.toString("base64"),
      },
    });
  }

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo limite do Google AI excedido (110s)");
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Google AI falhou (${response.status}): ${errorText.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  const imagePart = data.candidates
    ?.flatMap((c) => c.content?.parts ?? [])
    .find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error("Google AI não retornou imagem na resposta");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}
