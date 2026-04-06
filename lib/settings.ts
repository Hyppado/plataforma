/**
 * lib/settings.ts
 *
 * Leitura/escrita de configurações dinâmicas (tabela Setting).
 * Evita hardcodes — o admin configura via painel, o código lê do banco.
 */

import prisma from "./prisma";
import { encrypt, decrypt } from "./crypto";

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
  APP_NAME: "app.name",
  HOTMART_PRODUCT_ID: "hotmart.product_id",
  OPENAI_API_KEY: "openai.api_key",
  OPENAI_WHISPER_MODEL: "openai.whisper_model",
  OPENAI_WHISPER_LANGUAGE: "openai.whisper_language",
} as const;

// ---------------------------------------------------------------------------
// Secret Settings (encrypted at rest)
// ---------------------------------------------------------------------------

/**
 * Reads a secret setting and decrypts it.
 * Returns null if the key does not exist.
 * Throws if decryption fails (tampered data or key change).
 */
export async function getSecretSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row?.value) return null;
  return decrypt(row.value);
}

/**
 * Encrypts and saves a secret setting.
 * Always stores with type="secret" so the admin API can mask it.
 */
export async function upsertSecretSetting(
  key: string,
  plainValue: string,
  meta?: { label?: string; group?: string },
) {
  const encrypted = encrypt(plainValue);
  return prisma.setting.upsert({
    where: { key },
    update: { value: encrypted },
    create: {
      key,
      value: encrypted,
      label: meta?.label,
      group: meta?.group ?? "openai",
      type: "secret",
    },
  });
}

/**
 * Checks if a secret setting exists and has a non-empty value.
 * Does NOT decrypt — only checks existence.
 */
export async function hasSecretSetting(key: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key },
    select: { value: true },
  });
  return !!row?.value;
}
