/**
 * lib/avatar-video/veo-prompt.ts
 *
 * VEO 3 prompt generation step for the avatar video flow.
 *
 * Responsibilities:
 *   - Assemble the full context (product, avatar, scenario, image references)
 *   - Call OpenAI Chat Completions to produce a structured VEO 3 JSON prompt
 *   - Parse and validate the response
 *   - Persist promptJson / promptText on AvatarVideoPrompt
 *
 * Pattern mirrors lib/insight/generate.ts — direct fetch, no SDK,
 * timeout protection, type-guarded result.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { getSecretSetting, getSetting, SETTING_KEYS } from "@/lib/settings";
import type {
  AvatarVideoCreation,
  AvatarProfile,
  VideoScenario,
  AvatarVideoImageVariation,
} from "@prisma/client";
import type { ServiceResult, VideoConcept } from "./types";

const log = createLogger("avatar-video/veo-prompt");

// ---------------------------------------------------------------------------
// VEO 3 prompt schema
// ---------------------------------------------------------------------------

/**
 * One "take" in the VEO 3 structured prompt.
 * Each take describes a distinct shot for the video.
 */
export interface Veo3Take {
  index: number; // 1-based slot number
  cameraDirection: string; // e.g. "plano médio, câmera estável"
  visualDirection: string; // e.g. "avatar segura o produto e sorri"
  spokenLines: string; // exact spoken script for this take
}

/**
 * Structured payload for VEO 3 video generation.
 * Extend this interface as the VEO 3 spec evolves.
 */
export interface Veo3Prompt {
  prompt: string; // Main textual description / overview
  duration?: number; // Total seconds (e.g. 15, 30, 60)
  aspectRatio?: string; // "9:16" for TikTok
  style?: string; // e.g. "ugc", "product-demo"
  language?: string; // "pt-BR"
  takes?: Veo3Take[]; // Structured per-take content (camera + visual + spoken)
  metadata?: Record<string, unknown>;
}

export interface GenerateVeoPromptResult {
  promptJson: Veo3Prompt;
  promptText: string;
}

export interface GenerateVeoPromptError {
  error: string;
}

export function isVeoPromptError(
  r: GenerateVeoPromptResult | GenerateVeoPromptError,
): r is GenerateVeoPromptError {
  return "error" in r;
}

// ---------------------------------------------------------------------------
// Build system + user messages
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_PROMPT =
  "Você é um especialista em criação de prompts para modelos de geração de vídeo como VEO 3. " +
  "Sempre responda com JSON válido conforme solicitado, sem markdown ou explicações extras. " +
  "Crie prompts criativos, autênticos e adequados para conteúdo de TikTok Shop.";

/**
 * Assembles the full OpenAI messages array for VEO 3 prompt generation.
 * Includes product data, avatar, scenario, image references, and concept data.
 *
 * When a concept is provided, the prompt instructs the model to translate each
 * concept scene into a concrete VEO 3 take:
 *   - cameraDirection & visualDirection: written in English (VEO 3 is English-first)
 *   - spokenLines: exact Portuguese dialogue from the concept hook/copy/cta
 *
 * Max 8 seconds per take is enforced in the instructions.
 *
 * @param systemPrompt  Admin-configurable system prompt override. Falls back to the
 *                      built-in default when null or undefined.
 * @param concept       Optional approved concept from the generate-concept stage.
 */
export function buildVeoPromptMessages(
  creation: AvatarVideoCreation,
  avatar: AvatarProfile | null,
  scenario: VideoScenario | null,
  readyImageVariations: AvatarVideoImageVariation[],
  systemPrompt?: string | null,
  concept?: VideoConcept | null,
): { role: "system" | "user"; content: string }[] {
  const imageBlobUrls = readyImageVariations
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => v.blobUrl)
    .filter((url): url is string => url !== null);

  const contextParts: string[] = [];

  if (creation.productName)
    contextParts.push(`Produto: ${creation.productName}`);
  if (creation.productCategory)
    contextParts.push(`Categoria: ${creation.productCategory}`);
  if (creation.productPriceCents && creation.productCurrency) {
    const price = (creation.productPriceCents / 100).toFixed(2);
    contextParts.push(`Preço: ${creation.productCurrency} ${price}`);
  }
  if (avatar)
    contextParts.push(
      `Avatar: ${avatar.name}${avatar.description ? ` — ${avatar.description}` : ""}`,
    );
  if (scenario) {
    contextParts.push(
      `Cenário: ${scenario.name}${scenario.description ? ` — ${scenario.description}` : ""}`,
    );
    if (scenario.promptHint) contextParts.push(`Dica: ${scenario.promptHint}`);
  }
  if (creation.tone) contextParts.push(`Tom: ${creation.tone}`);
  if (creation.duration) contextParts.push(`Duração: ${creation.duration}`);
  const takeCount = creation.takeCount ?? 1;
  contextParts.push(`Número de takes: ${takeCount}`);
  if (imageBlobUrls.length > 0) {
    contextParts.push(
      `Imagens de referência geradas: ${imageBlobUrls.join(", ")}`,
    );
  }

  const takesSchema = JSON.stringify(
    Array.from({ length: takeCount }, (_, i) => ({
      index: i + 1,
      cameraDirection:
        "string — framing and camera movement in English (e.g. 'medium shot, stable camera, slight zoom in')",
      visualDirection:
        "string — what the avatar does and how they interact with the product, in English. Max 8 seconds per take.",
      spokenLines:
        "string — exact spoken dialogue for this take in Portuguese (pt-BR)",
    })),
    null,
    2,
  );

  const schemaExample = JSON.stringify(
    {
      prompt: "string — overall VEO 3 video description in English",
      duration: takeCount * 8,
      aspectRatio: "9:16",
      style: "ugc",
      language: "pt-BR",
      takes: `[/* ${takeCount} take(s) — see structure below */]`,
    },
    null,
    2,
  );

  const conceptSection: string[] = [];
  if (concept) {
    conceptSection.push("");
    conceptSection.push("Approved video concept (use this as the creative direction for each take):");
    conceptSection.push(`Video idea: ${concept.videoIdea}`);
    conceptSection.push(`Hook (opening line): ${concept.hook}`);
    if (concept.copy) conceptSection.push(`Copy/script: ${concept.copy}`);
    if (concept.cta) conceptSection.push(`CTA: ${concept.cta}`);
    if (concept.scenes && concept.scenes.length > 0) {
      conceptSection.push("Scenes:");
      concept.scenes.forEach((s) => {
        conceptSection.push(
          `  Scene ${s.sceneNumber} — Goal: ${s.goal}. Description: ${s.description}`,
        );
      });
    }
    conceptSection.push(
      "For each take, translate the corresponding scene into camera/visual directions in English, " +
        "and use the hook/copy/cta as the spoken dialogue in Portuguese. Max 8 seconds per take.",
    );
  }

  const userMessage = [
    "Based on the information below, generate a structured VEO 3 prompt in JSON format.",
    "The prompt must be optimized for a UGC video in 9:16 format for TikTok Shop.",
    "cameraDirection and visualDirection must be in English. spokenLines must be in Portuguese (pt-BR).",
    "Each take must be max 8 seconds.",
    "Respond ONLY with valid JSON, no markdown. Expected structure:",
    schemaExample,
    "",
    `Structure of each take (generate exactly ${takeCount} take(s)):`,
    takesSchema,
    "",
    "Context:",
    ...contextParts,
    ...conceptSection,
  ].join("\n");

  return [
    {
      role: "system",
      content: systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    },
    { role: "user", content: userMessage },
  ];
}

// ---------------------------------------------------------------------------
// Call OpenAI and parse
// ---------------------------------------------------------------------------

/**
 * Calls OpenAI Chat Completions to generate a VEO 3 prompt.
 * Does NOT touch the database — returns raw parsed result.
 */
export async function callVeoPromptGeneration(
  messages: { role: "system" | "user"; content: string }[],
): Promise<GenerateVeoPromptResult | GenerateVeoPromptError> {
  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    return { error: "Chave OpenAI não configurada. Peça ao administrador." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `OpenAI HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";

    let parsed: Veo3Prompt;
    try {
      parsed = JSON.parse(raw) as Veo3Prompt;
    } catch {
      return {
        error: `Resposta OpenAI não é JSON válido: ${raw.slice(0, 200)}`,
      };
    }

    if (!parsed.prompt || typeof parsed.prompt !== "string") {
      return {
        error: 'Campo "prompt" ausente ou inválido na resposta OpenAI.',
      };
    }

    return {
      promptJson: parsed,
      promptText: parsed.prompt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Erro de rede ou timeout: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Generate and persist prompt
// ---------------------------------------------------------------------------

/**
 * Generates the VEO 3 prompt for a creation, persists it, and returns the result.
 * Creates or resets the AvatarVideoPrompt row to PROCESSING before calling OpenAI,
 * then marks it READY or FAILED based on the outcome.
 *
 * @param concept  Optional approved concept from the generate-concept stage.
 *                 When provided, the model uses it as creative direction for each take.
 */
export async function generateAndPersistVeoPrompt(
  creation: AvatarVideoCreation,
  avatar: AvatarProfile | null,
  scenario: VideoScenario | null,
  readyImageVariations: AvatarVideoImageVariation[],
  concept?: VideoConcept | null,
): Promise<ServiceResult<GenerateVeoPromptResult>> {
  // Upsert prompt row in PROCESSING state
  const promptRow = await prisma.avatarVideoPrompt.upsert({
    where: { creationId: creation.id },
    update: {
      status: "PROCESSING",
      errorMessage: null,
      promptJson: undefined,
      promptText: null,
    },
    create: { creationId: creation.id, status: "PROCESSING" },
  });

  log.info("VEO prompt generation started", {
    creationId: creation.id,
    promptId: promptRow.id,
  });

  // Load admin-configurable system prompt template (falls back to default when null)
  const systemPromptTemplate = await getSetting(
    SETTING_KEYS.AVATAR_VIDEO_PROMPT_TEMPLATE,
  );

  const messages = buildVeoPromptMessages(
    creation,
    avatar,
    scenario,
    readyImageVariations,
    systemPromptTemplate,
    concept,
  );
  const result = await callVeoPromptGeneration(messages);

  if (isVeoPromptError(result)) {
    log.warn("VEO prompt generation failed", {
      creationId: creation.id,
      error: result.error,
    });

    await prisma.avatarVideoPrompt.update({
      where: { id: promptRow.id },
      data: { status: "FAILED", errorMessage: result.error },
    });

    return { ok: false, error: result.error, code: "internal" };
  }

  await prisma.avatarVideoPrompt.update({
    where: { id: promptRow.id },
    data: {
      status: "READY",
      promptJson: result.promptJson,
      promptText: result.promptText,
      errorMessage: null,
    },
  });

  log.info("VEO prompt ready", {
    creationId: creation.id,
    promptId: promptRow.id,
  });
  return { ok: true, data: result };
}
