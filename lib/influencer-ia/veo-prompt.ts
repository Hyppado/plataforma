/**
 * lib/influencer-ia/veo-prompt.ts
 *
 * VEO 3.1 prompt generation for the Influencer IA wizard.
 *
 * Generates one structured JSON prompt per video part (scene) using
 * OpenAI Chat Completions. Each part is 8 seconds of vertical (9:16)
 * TikTok content described for VEO 3.1.
 */

import { getSecretSetting, SETTING_KEYS } from "@/lib/settings";
import { getPromptConfigFromDB } from "@/lib/admin/config";
import { getDefaultAvatarVideoPrompts } from "@/lib/admin/config-defaults";
import { renderTemplate } from "@/lib/admin/template";
import { createLogger } from "@/lib/logger";

const log = createLogger("influencer-ia/veo-prompt");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type VeoDuration = "short" | "medium" | "full";
export type VeoStyle =
  | "ugc"
  | "unboxing"
  | "review"
  | "tutorial"
  | "testemunho";

export interface VeoPart {
  prompt: string;
  aspect_ratio: string;
  duration: number;
  audio: boolean;
  language: string;
  part: number;
  label: string;
  reference_instructions: string;
  negative_instructions: string;
  _metadata: {
    part: number;
    total_parts: number;
    product: string;
    label: string;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PART_LABELS: Record<VeoDuration, string[]> = {
  short: ["Gancho", "CTA"],
  medium: ["Gancho", "Apresentação", "Demonstração", "CTA"],
  full: [
    "Gancho",
    "Apresentação",
    "Benefícios",
    "Demonstração",
    "Prova Social",
    "Depoimento",
    "Comparação",
    "CTA",
  ],
};

const STYLE_DESCRIPTIONS: Record<VeoStyle, string> = {
  ugc: "authentic casual UGC creator-style, hand-held feel, relatable and conversational",
  unboxing:
    "exciting unboxing and product reveal, showing the packaging and product for the first time",
  review:
    "honest detailed product review with genuine pros and personal opinion",
  tutorial: "step-by-step tutorial showing how to use the product effectively",
  testemunho:
    "sincere personal testimonial, emotional and heartfelt, sharing real results",
};

const PART_GOALS: Record<string, string> = {
  Gancho:
    "hook the viewer instantly in the first 2 seconds, create curiosity or emotion",
  Apresentação: "introduce the product naturally and confidently",
  Benefícios: "highlight 2-3 key product benefits clearly",
  Demonstração: "demonstrate the product in action, show visible results",
  "Prova Social":
    "mention reviews, popularity, sales numbers or customer results",
  Depoimento:
    "share personal experience, transformation or before/after result",
  Comparação:
    "compare before/after using the product or contrast with alternatives",
  CTA: "clear call-to-action, invite the viewer to click the link and buy now",
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export async function generateVeoPrompts(
  productName: string,
  productCategory: string | null,
  style: VeoStyle,
  duration: VeoDuration,
): Promise<VeoPart[]> {
  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("Chave OpenAI não configurada. Peça ao administrador.");
  }

  const labels = PART_LABELS[duration];
  const total = labels.length;
  const styleDesc = STYLE_DESCRIPTIONS[style];

  const partDescriptions = labels
    .map((label, i) => {
      const goal = PART_GOALS[label] ?? "continue the video narrative";
      return `  Part ${i + 1}/${total} — "${label}": ${goal}`;
    })
    .join("\n");

  const styleLabel = style.toUpperCase();

  // Load admin-edited templates with default fallback (so a malformed DB
  // value never blocks generation).
  let systemTemplate: string;
  let userTemplate: string;
  try {
    const cfg = await getPromptConfigFromDB();
    systemTemplate = cfg.avatarVideo.veoSystem;
    userTemplate = cfg.avatarVideo.veoUser;
  } catch (err) {
    log.warn("Falling back to default VEO templates", {
      error: err instanceof Error ? err.message : String(err),
    });
    const defaults = getDefaultAvatarVideoPrompts();
    systemTemplate = defaults.veoSystem;
    userTemplate = defaults.veoUser;
  }

  const vars = {
    product_name: productName,
    product_category: productCategory ? ` (${productCategory})` : "",
    style_description: styleDesc,
    style_label: styleLabel,
    total: String(total),
    part_descriptions: partDescriptions,
  };

  const systemMessage = renderTemplate(systemTemplate, vars);
  const userMessage = renderTemplate(userTemplate, vars);

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
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1024 + total * 256,
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";

    let promptTexts: string[] = [];
    try {
      const parsed = JSON.parse(raw) as { parts?: unknown };
      if (Array.isArray(parsed.parts)) {
        promptTexts = parsed.parts as string[];
      }
    } catch {
      log.warn("VEO prompt response not valid JSON", {
        raw: raw.slice(0, 200),
      });
    }

    // Pad with deterministic fallbacks if AI returned fewer items than expected
    while (promptTexts.length < total) {
      const i = promptTexts.length;
      const label = labels[i] ?? `Parte ${i + 1}`;
      promptTexts.push(
        `Realistic ${styleLabel} TikTok video PART ${i + 1}/${total}. ` +
          `Medium shot, stable camera. Creator presents ${productName}. ` +
          `Audio: "${label} — conteúdo em português."`,
      );
    }

    log.info("VEO prompts generated", { total, style, duration, productName });

    const referenceInstructions =
      "Keep the same person, product and environment as the reference image.";
    const negativeInstructions =
      "Do not add on-screen text, logos, subtitles, watermarks, distorted hands, distorted face, or distorted product.";

    return labels.map((label, i) => ({
      prompt: promptTexts[i] ?? "",
      aspect_ratio: "9:16",
      duration: 8,
      audio: true,
      language: "pt-BR",
      part: i + 1,
      label,
      reference_instructions: referenceInstructions,
      negative_instructions: negativeInstructions,
      _metadata: {
        part: i + 1,
        total_parts: total,
        product: productName,
        label,
      },
    }));
  } finally {
    clearTimeout(timeout);
  }
}
