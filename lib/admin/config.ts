/**
 * lib/admin/config.ts
 *
 * Server-side admin configuration service.
 * Persists QuotaPolicy and PromptConfig in the Settings table (DB).
 *
 * This is the SINGLE SOURCE OF TRUTH for admin-managed configuration.
 * The frontend reads/writes through API routes — never through localStorage.
 *
 * Default prompt templates live here as fallbacks. When the admin has never
 * saved a config, these defaults are returned. The admin can always hit
 * "Restore Defaults" in the UI to reset to these values.
 */

import { getSetting, upsertSetting } from "@/lib/settings";
import type { QuotaPolicy, PromptConfig } from "@/lib/types/admin";
import {
  DEFAULT_QUOTA_POLICY,
  PROMPT_VARIABLES,
  getDefaultPromptConfig,
} from "./config-defaults";

// Re-export client-safe constants so existing importers from this file still work.
export { DEFAULT_QUOTA_POLICY, PROMPT_VARIABLES, getDefaultPromptConfig };

// ---------------------------------------------------------------------------
// Setting keys
// ---------------------------------------------------------------------------

export const CONFIG_KEYS = {
  QUOTA_POLICY: "admin.quota_policy",
  PROMPT_CONFIG: "admin.prompt_config",
} as const;

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
