/**
 * lib/admin/config.ts
 *
 * Server-side admin configuration service.
 * Persists QuotaPolicy and PromptConfig in the Settings table (DB).
 *
 * This is the SINGLE SOURCE OF TRUTH for admin-managed configuration.
 * The frontend reads/writes through API routes — never through localStorage.
 */

import { getSetting, upsertSetting } from "@/lib/settings";
import type {
  QuotaPolicy,
  PromptConfig,
  ModelSettings,
} from "@/lib/types/admin";

// ---------------------------------------------------------------------------
// Setting keys
// ---------------------------------------------------------------------------

export const CONFIG_KEYS = {
  QUOTA_POLICY: "admin.quota_policy",
  PROMPT_CONFIG: "admin.prompt_config",
} as const;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_QUOTA_POLICY: QuotaPolicy = {
  transcriptsPerMonth: 40,
  scriptsPerMonth: 70,
  insightTokensPerMonth: 50_000,
  scriptTokensPerMonth: 20_000,
  insightMaxOutputTokens: 800,
  scriptMaxOutputTokens: 1500,
};

const DEFAULT_MODEL_SETTINGS: Record<"insight" | "script", ModelSettings> = {
  insight: {
    model: "gpt-4o-mini",
    temperature: 0.7,
    top_p: 0.9,
    max_output_tokens: 800,
  },
  script: {
    model: "gpt-4o-mini",
    temperature: 0.8,
    top_p: 0.95,
    max_output_tokens: 1500,
  },
};

// Default templates are imported lazily to avoid circular deps
function getDefaultTemplates() {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { DEFAULT_INSIGHT_PROMPT, DEFAULT_SCRIPT_PROMPT } =
    require("@/lib/admin/prompt-config") as {
      DEFAULT_INSIGHT_PROMPT: string;
      DEFAULT_SCRIPT_PROMPT: string;
    };
  return { insight: DEFAULT_INSIGHT_PROMPT, script: DEFAULT_SCRIPT_PROMPT };
}

export function getDefaultPromptConfig(): PromptConfig {
  const templates = getDefaultTemplates();
  return {
    insight: {
      template: templates.insight,
      settings: { ...DEFAULT_MODEL_SETTINGS.insight },
    },
    script: {
      template: templates.script,
      settings: { ...DEFAULT_MODEL_SETTINGS.script },
    },
  };
}

// ---------------------------------------------------------------------------
// QuotaPolicy — read / write
// ---------------------------------------------------------------------------

/** Read QuotaPolicy from DB. Returns defaults when not yet configured. */
export async function getQuotaPolicyFromDB(): Promise<QuotaPolicy> {
  const raw = await getSetting(CONFIG_KEYS.QUOTA_POLICY);
  if (!raw) return { ...DEFAULT_QUOTA_POLICY };

  try {
    const parsed = JSON.parse(raw) as Partial<QuotaPolicy>;
    // Merge with defaults to guarantee all fields exist
    return { ...DEFAULT_QUOTA_POLICY, ...parsed };
  } catch {
    return { ...DEFAULT_QUOTA_POLICY };
  }
}

/** Write QuotaPolicy to DB. */
export async function saveQuotaPolicyToDB(policy: QuotaPolicy): Promise<void> {
  await upsertSetting(CONFIG_KEYS.QUOTA_POLICY, JSON.stringify(policy), {
    label: "Quota Policy",
    group: "admin",
    type: "json",
  });
}

// ---------------------------------------------------------------------------
// PromptConfig — read / write
// ---------------------------------------------------------------------------

/** Read PromptConfig from DB. Returns defaults when not yet configured. */
export async function getPromptConfigFromDB(): Promise<PromptConfig> {
  const raw = await getSetting(CONFIG_KEYS.PROMPT_CONFIG);
  if (!raw) return getDefaultPromptConfig();

  try {
    const parsed = JSON.parse(raw) as Partial<PromptConfig>;
    const defaults = getDefaultPromptConfig();
    // Merge with defaults to guarantee shape
    return {
      insight: {
        template: parsed.insight?.template ?? defaults.insight.template,
        settings: { ...defaults.insight.settings, ...parsed.insight?.settings },
      },
      script: {
        template: parsed.script?.template ?? defaults.script.template,
        settings: { ...defaults.script.settings, ...parsed.script?.settings },
      },
    };
  } catch {
    return getDefaultPromptConfig();
  }
}

/** Write PromptConfig to DB. */
export async function savePromptConfigToDB(
  config: PromptConfig,
): Promise<void> {
  await upsertSetting(CONFIG_KEYS.PROMPT_CONFIG, JSON.stringify(config), {
    label: "Prompt Config",
    group: "admin",
    type: "json",
  });
}
