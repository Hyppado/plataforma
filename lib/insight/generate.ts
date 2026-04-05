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
    const finishReason = data.choices?.[0]?.finish_reason;
    const tokensUsed = data.usage?.total_tokens ?? 0;

    if (!content) {
      return { error: "OpenAI retornou resposta vazia" };
    }

    if (finishReason === "length") {
      log.warn("OpenAI response truncated (finish_reason=length)", {
        tokensUsed,
        contentLength: content.length,
      });
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
    return extractSections(parsed);
  } catch {
    // JSON may be truncated due to max_tokens — try to recover
    const repaired = tryRepairTruncatedJson(content);
    if (repaired) {
      return extractSections(repaired);
    }
    return null;
  }
}

function extractSections(parsed: Record<string, unknown>): InsightSections {
  return {
    contexto: String(parsed.contexto || parsed.context || ""),
    gancho: String(parsed.gancho || parsed.hook || ""),
    problema: String(parsed.problema || parsed.problem || ""),
    solucao: String(parsed.solucao || parsed.solution || ""),
    cta: String(parsed.cta || parsed.call_to_action || ""),
    copie_o_que_funcionou: String(
      parsed.copie_o_que_funcionou ||
        parsed.copy_what_worked ||
        parsed.script ||
        "",
    ),
  };
}

/**
 * Attempts to repair a truncated JSON string from OpenAI.
 * Common case: response cut off mid-value due to max_tokens.
 */
function tryRepairTruncatedJson(
  content: string,
): Record<string, unknown> | null {
  try {
    // Try closing any open string and object
    // e.g. {"key": "val... → {"key": "val..."}
    let attempt = content.trim();

    // Remove trailing incomplete escape sequences
    attempt = attempt.replace(/\\$/, "");

    // Close any unclosed string
    const quoteCount = (attempt.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      attempt += '"';
    }

    // Remove trailing comma if present
    attempt = attempt.replace(/,\s*$/, "");

    // Close unclosed braces
    const openBraces =
      (attempt.match(/{/g) || []).length -
      (attempt.match(/}/g) || []).length;
    for (let i = 0; i < openBraces; i++) {
      attempt += "}";
    }

    const parsed = JSON.parse(attempt);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
