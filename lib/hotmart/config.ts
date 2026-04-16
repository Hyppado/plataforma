/**
 * lib/hotmart/config.ts
 * Centraliza as credenciais da Hotmart.
 * Prioridade: banco de dados (admin panel) → variável de ambiente → erro.
 *
 * Sandbox: defina hotmart.sandbox = "true" no painel admin ou HOTMART_SANDBOX=true no .env.
 * Veja: https://developers.hotmart.com/docs/pt-BR/sandbox/
 */

import { createLogger } from "../logger";
import {
  getSetting,
  getSettingOrEnv,
  getSecretSetting,
  SETTING_KEYS,
} from "../settings";

const log = createLogger("hotmart/config");

/** true quando HOTMART_SANDBOX=true está definido no ambiente (fallback síncrono para uso legacy) */
export function isSandbox(): boolean {
  return process.env.HOTMART_SANDBOX?.trim().toLowerCase() === "true";
}

export async function getHotmartConfig() {
  const [clientId, clientSecret, basicToken, sandboxSetting] =
    await Promise.all([
      getSettingOrEnv(SETTING_KEYS.HOTMART_CLIENT_ID, "HOTMART_CLIENTE_ID"),
      (async () => {
        const db = await getSecretSetting(SETTING_KEYS.HOTMART_CLIENT_SECRET);
        return db || process.env.HOTMART_CLIENT_SECRET || "";
      })(),
      (async () => {
        const db = await getSecretSetting(SETTING_KEYS.HOTMART_BASIC_TOKEN);
        return db || process.env.HOTMART_BASIC || "";
      })(),
      getSetting(SETTING_KEYS.HOTMART_SANDBOX),
    ]);

  const sandbox =
    sandboxSetting != null
      ? sandboxSetting.trim().toLowerCase() === "true"
      : isSandbox();

  if (!clientId) {
    throw new Error(
      "[Hotmart] Client ID não configurado. Configure em Painel Admin → Hotmart ou defina HOTMART_CLIENTE_ID no .env.",
    );
  }
  if (!clientSecret) {
    throw new Error(
      "[Hotmart] Client Secret não configurado. Configure em Painel Admin → Hotmart ou defina HOTMART_CLIENT_SECRET no .env.",
    );
  }
  if (!basicToken) {
    throw new Error(
      "[Hotmart] Basic Token não configurado. Configure em Painel Admin → Hotmart ou defina HOTMART_BASIC no .env.",
    );
  }

  if (sandbox) {
    log.warn(
      "SANDBOX MODE ACTIVE — all calls point to sandbox.hotmart.com. Do not use in production.",
    );
  }

  return {
    clientId,
    clientSecret,
    basicToken,

    // Hotmart OAuth token endpoint (mesmo para sandbox)
    tokenUrl: "https://api-sec-vlc.hotmart.com/security/oauth/token",

    // Base URL da Hotmart REST API
    apiBaseUrl: "https://developers.hotmart.com",

    // Quanto antes do vencimento do token renovar (em ms). Padrão: 60s.
    tokenRefreshBuffer: 60_000,

    sandbox,
  } as const;
}

export type HotmartConfig = Awaited<ReturnType<typeof getHotmartConfig>>;
