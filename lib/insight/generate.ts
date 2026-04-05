/**
 * lib/insight/generate.ts
 *
 * OpenAI Chat Completions integration for Insight Hyppado generation.
 * Receives a fully-built prompt string, calls OpenAI, and returns
 * structured insight sections parsed from the JSON response.
 *
 * Similar pattern to lib/transcription/whisper.ts — direct fetch,
 * no SDK dependency, timeout protection.
 */

import { getSecretSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings";
import { createLogger } from "@/lib/logger";
import type { ModelSettings } from "@/lib/types/admin";

const log = createLogger("insight/generate");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InsightSections {
  contexto: string;
  gancho: string;
  problema: string;
  solucao: string;
  cta: string;
  copie_o_que_funcionou: string;
}

export interface GenerateInsightResult {
  sections: InsightSections;
  tokensUsed: number;
  rawResponse: unknown;
}

export interface GenerateInsightError {
  error: string;
}

export function isGenerateError(
  result: GenerateInsightResult | GenerateInsightError,
): result is GenerateInsightError {
  return "error" in result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Calls OpenAI Chat Completions to generate a structured Insight Hyppado
 * from a prepared prompt (already has transcript and variables substituted).
 */
export async function generateInsight(
  prompt: string,
  settings: ModelSettings,
): Promise<GenerateInsightResult | GenerateInsightError> {
  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    return { error: "Chave OpenAI não configurada. Peça ao administrador." };
  }

  const messages = [
    {
      role: "system" as const,
      content:
        "Você é um analista de conteúdo viral experiente. " +
        "Sempre responda com JSON válido conforme solicitado, sem markdown.",
    },
    {
      role: "user" as const,
      content: prompt,
    },
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || "gpt-4o-mini",
        messages,
        temperature: settings.temperature ?? 0.7,
        top_p: settings.top_p ?? 0.9,
        max_tokens: settings.max_output_tokens || 800,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown");
      log.error("OpenAI Chat API error", {
        status: response.status,
        body: errorText.slice(0, 200),
      });
      return {
        error: `OpenAI API error (${response.status}): ${response.statusText}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const tokensUsed = data.usage?.total_tokens ?? 0;

    if (!content) {
      return { error: "OpenAI retornou resposta vazia" };
    }

    const sections = parseInsightResponse(content);
    if (!sections) {
      log.warn("Failed to parse insight JSON", {
        content: content.slice(0, 300),
      });
      return { error: "Não foi possível interpretar a resposta da IA" };
    }

    return { sections, tokensUsed, rawResponse: data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: "Tempo limite da OpenAI excedido (60s)" };
    }
    log.error("OpenAI Chat request failed", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return {
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Erro desconhecido",
    };
  }
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/**
 * Parse OpenAI JSON response into structured insight sections.
 * Tolerates both Portuguese and English field names.
 */
export function parseInsightResponse(content: string): InsightSections | null {
  try {
    const parsed = JSON.parse(content);
    return {
      contexto: parsed.contexto || parsed.context || "",
      gancho: parsed.gancho || parsed.hook || "",
      problema: parsed.problema || parsed.problem || "",
      solucao: parsed.solucao || parsed.solution || "",
      cta: parsed.cta || parsed.call_to_action || "",
      copie_o_que_funcionou:
        parsed.copie_o_que_funcionou ||
        parsed.copy_what_worked ||
        parsed.script ||
        "",
    };
  } catch {
    return null;
  }
}
