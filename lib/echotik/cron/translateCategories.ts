/**
 * lib/echotik/cron/translateCategories.ts
 *
 * Translates EchotikCategory.name (English) → namePt (Brazilian Portuguese)
 * using OpenAI gpt-4o-mini. Runs after each category sync and only processes
 * rows where namePt IS NULL (i.e., newly added or never translated).
 *
 * Cost: ~50 short names per request → negligible.
 */

import { prisma } from "@/lib/prisma";
import { getSecretSetting, SETTING_KEYS } from "@/lib/settings";
import { createLogger } from "@/lib/logger";

const log = createLogger("echotik/translateCategories");

const BATCH_SIZE = 50;
const OPENAI_API = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function translateBatch(
  names: string[],
  apiKey: string,
): Promise<Record<string, string>> {
  const prompt =
    `Translate the following English TikTok Shop product category names to Brazilian Portuguese (pt-BR).\n` +
    `Return ONLY a JSON object where the keys are the original English names and the values are the Portuguese translations.\n` +
    `Do not add explanations. Keep translations concise and natural for an e-commerce context.\n\n` +
    `Names:\n${names.map((n) => `- ${n}`).join("\n")}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENAI_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional e-commerce translator. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(content) as Record<string, string>;
  } catch {
    log.warn("Failed to parse translation response", { content });
    return {};
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Translates all EchotikCategory rows with namePt IS NULL.
 * Safe to call on every cron run — skips already-translated rows.
 *
 * @returns number of rows translated
 */
export async function translateCategories(): Promise<number> {
  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    log.info("OpenAI API key not configured — skipping category translation");
    return 0;
  }

  const untranslated = await prisma.echotikCategory.findMany({
    where: { namePt: null },
    select: { externalId: true, name: true },
    orderBy: { level: "asc" },
  });

  if (untranslated.length === 0) {
    log.info("All categories already translated");
    return 0;
  }

  log.info(`Translating ${untranslated.length} categories`, {
    count: untranslated.length,
  });

  let translated = 0;

  for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
    const batch = untranslated.slice(i, i + BATCH_SIZE);
    const names = batch.map((c) => c.name);

    try {
      const translations = await translateBatch(names, apiKey);

      // Update each row individually (avoids a complex bulk update)
      await Promise.all(
        batch.map((cat) => {
          const namePt = translations[cat.name];
          if (!namePt) return Promise.resolve();
          return prisma.echotikCategory.update({
            where: { externalId: cat.externalId },
            data: { namePt },
          });
        }),
      );

      translated += batch.length;
      log.info(`Translated batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
        from: i,
        to: i + batch.length,
      });
    } catch (err) {
      log.error("Batch translation failed", {
        batchIndex: Math.floor(i / BATCH_SIZE),
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue with next batch — don't abort the whole process
    }
  }

  return translated;
}
