/**
 * lib/avatar-video/concept.ts
 *
 * AI concept generation step for the avatar video flow.
 *
 * Responsibilities:
 *   - Assemble OpenAI messages from product data, images, tone, and duration
 *   - Call gpt-4o to produce a structured video concept (hook, copy, CTA, scenes)
 *   - Parse and validate the JSON response
 *   - Persist result on AvatarVideoConcept
 *
 * Concept is the first AI stage; VEO 3 prompt generation (veo-prompt.ts) comes second
 * and consumes the approved concept as structured input.
 *
 * Pattern mirrors lib/avatar-video/veo-prompt.ts — direct fetch, no SDK,
 * timeout protection, type-guarded result.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { getSecretSetting, getSetting, SETTING_KEYS } from "@/lib/settings";
import type {
  AvatarVideoCreation,
  AvatarVideoImageVariation,
} from "@prisma/client";
import type { ConceptScene, ServiceResult, VideoConcept } from "./types";

const log = createLogger("avatar-video/concept");

// ---------------------------------------------------------------------------
// Concept output schema
// ---------------------------------------------------------------------------

export type { VideoConcept };

export interface GenerateConceptResult {
  concept: VideoConcept;
}

export interface GenerateConceptError {
  error: string;
}

export function isConceptError(
  r: GenerateConceptResult | GenerateConceptError,
): r is GenerateConceptError {
  return "error" in r;
}

// ---------------------------------------------------------------------------
// Build system + user messages
// ---------------------------------------------------------------------------

const DEFAULT_CONCEPT_SYSTEM_PROMPT =
  "You are an expert TikTok Shop content marketing strategist. " +
  "You create authentic, persuasive UGC video concepts optimised for sales conversions. " +
  "Always respond with valid JSON exactly as requested, no markdown, no extra explanations. " +
  "Write hook, copy, and CTA in Brazilian Portuguese (pt-BR).";

/**
 * Assembles the full OpenAI messages array for video concept generation.
 * Uses product data, images, tone, and duration as context.
 */
export function buildConceptMessages(
  creation: AvatarVideoCreation,
  readyImageVariations: AvatarVideoImageVariation[],
  systemPrompt?: string | null,
): { role: "system" | "user"; content: string }[] {
  const imageBlobUrls = readyImageVariations
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => v.blobUrl)
    .filter((url): url is string => url !== null);

  const contextParts: string[] = [];

  if (creation.productName)
    contextParts.push(`Product: ${creation.productName}`);
  if (creation.productCategory)
    contextParts.push(`Category: ${creation.productCategory}`);
  if (creation.productPriceCents && creation.productCurrency) {
    const price = (creation.productPriceCents / 100).toFixed(2);
    contextParts.push(`Price: ${creation.productCurrency} ${price}`);
  }
  if (creation.tone) contextParts.push(`Desired tone: ${creation.tone}`);
  if (creation.duration)
    contextParts.push(`Target duration: ${creation.duration}`);
  const takeCount = creation.takeCount ?? 1;
  contextParts.push(`Number of takes/scenes: ${takeCount}`);
  if (imageBlobUrls.length > 0) {
    contextParts.push(
      `Generated reference images (avatar + product): ${imageBlobUrls.join(", ")}`,
    );
  }
  if (creation.customScenarioDescription) {
    contextParts.push(
      `Custom scenario description: ${creation.customScenarioDescription}`,
    );
  }

  const scenesSchema = JSON.stringify(
    Array.from({ length: takeCount }, (_, i) => ({
      sceneNumber: i + 1,
      goal: "string — purpose of this scene (e.g. introduce product, demonstrate benefit, CTA)",
      description:
        "string — visual and narrative description of the scene in Brazilian Portuguese",
    })),
    null,
    2,
  );

  const schemaExample = JSON.stringify(
    {
      videoIdea: "string — overall video idea summary (1-2 sentences)",
      hook: "string — opening line that grabs attention, in Brazilian Portuguese",
      copy: "string — main video script/copy in Brazilian Portuguese",
      cta: "string — final call-to-action in Brazilian Portuguese",
      scenes: `[/* ${takeCount} scene(s) — see structure below */]`,
    },
    null,
    2,
  );

  const userMessage = [
    "Based on the product information below, create a UGC video concept for TikTok Shop.",
    "The video must be authentic, engaging, and optimised for conversion.",
    "Respond ONLY with valid JSON, no markdown. Expected structure:",
    schemaExample,
    "",
    `Scene structure (generate exactly ${takeCount} scene(s)):`,
    scenesSchema,
    "",
    "Product and video context:",
    ...contextParts,
  ].join("\n");

  return [
    {
      role: "system",
      content: systemPrompt?.trim() || DEFAULT_CONCEPT_SYSTEM_PROMPT,
    },
    { role: "user", content: userMessage },
  ];
}

// ---------------------------------------------------------------------------
// Call OpenAI and parse
// ---------------------------------------------------------------------------

/**
 * Calls OpenAI Chat Completions to generate a video concept.
 * Does NOT touch the database — returns raw parsed result.
 */
export async function callConceptGeneration(
  messages: { role: "system" | "user"; content: string }[],
): Promise<GenerateConceptResult | GenerateConceptError> {
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
        max_tokens: 1024,
        temperature: 0.8,
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

    let parsed: VideoConcept;
    try {
      parsed = JSON.parse(raw) as VideoConcept;
    } catch {
      return {
        error: `Resposta OpenAI não é JSON válido: ${raw.slice(0, 200)}`,
      };
    }

    if (!parsed.videoIdea || typeof parsed.videoIdea !== "string") {
      return {
        error: 'Campo "videoIdea" ausente ou inválido na resposta OpenAI.',
      };
    }
    if (!parsed.hook || typeof parsed.hook !== "string") {
      return {
        error: 'Campo "hook" ausente ou inválido na resposta OpenAI.',
      };
    }
    if (!Array.isArray(parsed.scenes)) {
      return {
        error: 'Campo "scenes" ausente ou inválido na resposta OpenAI.',
      };
    }

    return { concept: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Erro de rede ou timeout: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Generate and persist concept
// ---------------------------------------------------------------------------

/**
 * Generates the video concept for a creation, persists it, and returns the result.
 * Creates or resets the AvatarVideoConcept row to PROCESSING before calling OpenAI,
 * then marks it READY or FAILED based on the outcome.
 */
export async function generateAndPersistConcept(
  creation: AvatarVideoCreation,
  readyImageVariations: AvatarVideoImageVariation[],
): Promise<ServiceResult<GenerateConceptResult>> {
  // Upsert concept row in PROCESSING state
  const conceptRow = await prisma.avatarVideoConcept.upsert({
    where: { creationId: creation.id },
    update: {
      status: "PROCESSING",
      errorMessage: null,
      videoIdea: null,
      hook: null,
      copy: null,
      cta: null,
      scenesJson: undefined,
    },
    create: { creationId: creation.id, status: "PROCESSING" },
  });

  log.info("Concept generation started", {
    creationId: creation.id,
    conceptId: conceptRow.id,
  });

  // Load admin-configurable system prompt template
  const systemPromptTemplate = await getSetting(
    SETTING_KEYS.AVATAR_VIDEO_CONCEPT_TEMPLATE,
  );

  const messages = buildConceptMessages(
    creation,
    readyImageVariations,
    systemPromptTemplate,
  );
  const result = await callConceptGeneration(messages);

  if (isConceptError(result)) {
    log.warn("Concept generation failed", {
      creationId: creation.id,
      error: result.error,
    });

    await prisma.avatarVideoConcept.update({
      where: { id: conceptRow.id },
      data: { status: "FAILED", errorMessage: result.error },
    });

    return { ok: false, error: result.error, code: "internal" };
  }

  const { concept } = result;

  await prisma.avatarVideoConcept.update({
    where: { id: conceptRow.id },
    data: {
      status: "READY",
      videoIdea: concept.videoIdea,
      hook: concept.hook,
      copy: concept.copy ?? null,
      cta: concept.cta ?? null,
      scenesJson: concept.scenes as object[],
      errorMessage: null,
    },
  });

  log.info("Concept ready", {
    creationId: creation.id,
    conceptId: conceptRow.id,
  });
  return { ok: true, data: result };
}
