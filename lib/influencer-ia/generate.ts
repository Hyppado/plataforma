/**
 * lib/influencer-ia/generate.ts
 *
 * Generates UGC-style influencer images via Google AI Studio (Gemini).
 *
 * Model: configurable via admin settings (SETTING_KEYS.GOOGLE_AI_MODEL),
 * defaulting to "gemini-3.1-flash-image-preview".
 *
 * Requires GOOGLE_AI_API_KEY secret to be configured in admin settings.
 * Throws if the key is absent — no fallback provider.
 */

import { createLogger } from "@/lib/logger";
import { getSecretSetting, getSetting, SETTING_KEYS } from "@/lib/settings";
import {
  isEchotikCdnUrl,
  signEchotikCoverUrl,
  uploadBufferToBlob,
} from "@/lib/storage/blob";

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
  // Check both category and product name for type detection
  const searchText = `${input.productCategory ?? ""} ${product}`.toLowerCase();

  // Category-aware placement
  const isClothing =
    /roupa|moda|fashion|vestuário|clothing|apparel|shirt|dress|pants|jeans|jacket|blouse|top|skirt|coat|calça|legging|shorts|vestido|saia|moletom|blusa|camiseta|camiseta|regata|casaco|jaqueta|agasalho|pijama|lingerie|sutiã|cueca|bermuda|jardineira|macacão|kimono|maiô|biquíni|meias|tricô|suéter/.test(
      searchText,
    );
  const isAccessory =
    /acessório|joia|joalheria|jewelry|bolsa|bag|watch|relógio|óculos|sunglasses|belt|cinto|pulseira|colar|brinco|anel|chapéu|boné|gorro|cachecol|luva|cinto/.test(
      searchText,
    );
  const isBeauty =
    /beleza|cosmét|skincare|maquiagem|beauty|perfume|fragrance|creme|serum|óleo|shampoo|condicionador|batom|base|máscara|sombra|hidratante/.test(
      searchText,
    );

  let placement: string;
  if (isClothing) {
    placement =
      `The person IS WEARING "${product}" as the main outfit piece in this image. ` +
      `This is critical: reproduce the garment exactly as in the reference image — ` +
      `same exact color (including the specific shade/variation selected), cut, silhouette, fabric texture, print, and any visible text or logo. ` +
      `The garment must be the focal point of the image and clearly recognizable.`;
  } else if (isAccessory) {
    placement =
      `The person is wearing or carrying "${product}" as the featured item. ` +
      `Reproduce the item exactly: same color, shape, material finish, and any visible logo or text.`;
  } else if (isBeauty) {
    placement =
      `The person is holding "${product}" near their face at chest or chin level, presenting it clearly to camera. ` +
      `Reproduce the product packaging exactly — same color, label, and shape.`;
  } else {
    placement =
      `The person is holding and presenting "${product}" naturally toward the camera as the featured item. ` +
      `Reproduce the product exactly as in the reference image — same shape, color, and all details.`;
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
    `PRODUCT: "${product}" — the reference image is the SOLE source of truth for the product's physical appearance. ` +
      `Reproduce EVERY intrinsic detail exactly: color (especially the specific shade/hue of the selected variation), ` +
      `shape, fabric, labels, text printed ON the product itself, logos, and finish. ` +
      `Do NOT substitute, invent, or alter ANY aspect of the product.`,
    "READING THE REFERENCE IMAGE — CRITICAL RULES:",
    `- IGNORE everything that is NOT part of the physical product: price stickers, promotional stamps, ` +
      `watermarks, e-commerce badges, review stars, shipping labels, certification seals, ` +
      `website URLs, or any text/graphic overlaid on the photo background. ` +
      `These are photo artifacts, NOT product features. Reproduce only what is physically ON the product.`,
    `- Infer the REAL-WORLD SIZE of the product from its shape and category. ` +
      `A supplement bottle should look like a hand-sized bottle (~15–20 cm tall). ` +
      `A serum should look small in the palm. A clothing item should drape over a full body. ` +
      `Scale the product PROPORTIONALLY and REALISTICALLY relative to the person or hand — ` +
      `never make it unnaturally large or tiny compared to a real human hand or body.`,
    poseIsSoProduct ? "" : `PLACEMENT: ${placement}`,
    `POSE: ${poseDescription}.`,
    `SETTING: ${envDescription}.`,
    styleDescription ? `INFLUENCER STYLE: ${styleDescription}.` : "",
    "",
    "TECHNICAL REQUIREMENTS:",
    "- Vertical 9:16 portrait format",
    "- Photorealistic editorial quality — must look like a real professional photo, NOT AI-generated",
    "- No text overlays, watermarks, or UI elements in the final image",
    "- Product must be the clear hero of the image and perfectly sharp",
    "- The product color must EXACTLY match the reference — do not change or approximate the shade",
    "- If the product is clothing, the influencer MUST be wearing it — not holding it",
    "- Product scale must match real-world proportions relative to the person's hands and body",
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
    // Echotik CDN URLs require a freshly signed URL — a plain GET returns 403.
    // Resolve to a signed URL before fetching so server-side downloads succeed.
    let fetchUrl = url;
    if (isEchotikCdnUrl(url)) {
      const signed = await signEchotikCoverUrl(url);
      if (signed) {
        fetchUrl = signed;
      } else {
        log.warn("Failed to sign Echotik cover URL \u2014 will try raw URL", {
          url: url.slice(0, 120),
        });
      }
    }

    const res = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        // Some CDNs (e.g. Echotik) block plain server-side fetches without a UA
        "User-Agent":
          "Mozilla/5.0 (compatible; Hyppado/1.0; +https://hyppado.com)",
        Accept: "image/webp,image/png,image/jpeg,image/*,*/*",
        Referer: "https://hyppado.com/",
      },
    });
    if (!res.ok) {
      log.warn("Image fetch returned non-OK status", {
        status: res.status,
        url: fetchUrl.slice(0, 120),
      });
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 0 ? { buffer: buf, contentType } : null;
  } catch (err) {
    log.warn("Image fetch threw", {
      url: url.slice(0, 120),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-image-preview";

export async function generateInfluencerImage(
  input: InfluencerImageInput,
): Promise<InfluencerImageResult> {
  const [googleApiKey, geminiModel] = await Promise.all([
    getSecretSetting(SETTING_KEYS.GOOGLE_AI_API_KEY),
    getSetting(SETTING_KEYS.GOOGLE_AI_MODEL),
  ]);

  if (!googleApiKey) {
    throw new Error(
      "Chave Google AI Studio não configurada. Configure no painel de administração.",
    );
  }

  const modelId = geminiModel?.trim() || DEFAULT_GEMINI_MODEL;
  const promptText = buildPrompt(input);

  log.info("Generating influencer image", {
    avatarName: input.avatarName,
    productName: input.productName,
    pose: input.pose,
    environment: input.environment,
    style: input.style,
    model: modelId,
    provider: "google-ai",
  });

  const [avatarFetch, productFetch] = await Promise.all([
    input.avatarImageUrl ? fetchImageBuffer(input.avatarImageUrl) : null,
    input.productImageUrl ? fetchImageBuffer(input.productImageUrl) : null,
  ]);

  if (input.productImageUrl && !productFetch) {
    log.warn("Product image fetch failed — aborting to avoid wrong product", {
      productImageUrl: input.productImageUrl,
    });
    throw new Error(
      "Não foi possível baixar a imagem do produto selecionado. Tente novamente em instantes.",
    );
  }
  if (input.avatarImageUrl && !avatarFetch) {
    log.warn(
      "Avatar image fetch failed — generating without avatar reference",
      {
        avatarImageUrl: input.avatarImageUrl,
      },
    );
  }

  const buffer = await generateWithGemini(
    googleApiKey,
    modelId,
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
  modelId: string,
  promptText: string,
  avatarFetch: { buffer: Buffer; contentType: string } | null,
  productFetch: { buffer: Buffer; contentType: string } | null,
): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  // Build parts — text prompt first, then labeled image references.
  // We label each image explicitly so Gemini knows which is the product
  // reference and which is the influencer/avatar appearance reference.
  // Product image comes before avatar so it has highest weight as reference.
  const parts: unknown[] = [{ text: promptText }];

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
