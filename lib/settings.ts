/**
 * lib/settings.ts
 *
 * Leitura/escrita de configurações dinâmicas (tabela Setting).
 * Evita hardcodes — o admin configura via painel, o código lê do banco.
 */

import prisma from "./prisma";

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Lê um setting pelo key. Retorna null se não existir. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Lê um setting com fallback (env var → valor padrão). */
export async function getSettingOrEnv(
  key: string,
  envVar?: string,
  fallback?: string,
): Promise<string> {
  const dbValue = await getSetting(key);
  if (dbValue) return dbValue;
  if (envVar && process.env[envVar]) return process.env[envVar]!;
  return fallback ?? "";
}

/** Lê todos os settings de um grupo. */
export async function getSettingsByGroup(
  group: string,
): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { group } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Lê todos os settings. */
export async function getAllSettings() {
  return prisma.setting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

/** Cria ou atualiza um setting. */
export async function upsertSetting(
  key: string,
  value: string,
  meta?: { label?: string; group?: string; type?: string },
) {
  return prisma.setting.upsert({
    where: { key },
    update: { value, ...meta },
    create: {
      key,
      value,
      label: meta?.label,
      group: meta?.group ?? "general",
      type: meta?.type ?? "text",
    },
  });
}

// ---------------------------------------------------------------------------
// Settings conhecidos (constantes de key para evitar typos)
// ---------------------------------------------------------------------------

export const SETTING_KEYS = {
  HOTMART_PRODUCT_ID: "hotmart.product_id",
  HOTMART_WEBHOOK_URL: "hotmart.webhook_url",
  APP_NAME: "app.name",
} as const;
