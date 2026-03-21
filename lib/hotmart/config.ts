/**
 * lib/hotmart/config.ts
 * Centraliza as variáveis de ambiente da Hotmart e valida na inicialização.
 * Lança erro claro se alguma estiver faltando para evitar falhas silenciosas.
 *
 * Sandbox: defina HOTMART_SANDBOX=true no .env para apontar para
 * https://sandbox.hotmart.com em vez da API de produção.
 * Veja: https://developers.hotmart.com/docs/pt-BR/sandbox/
 */

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `[Hotmart] Variável de ambiente obrigatória ausente: ${key}. ` +
        `Verifique seu .env ou as configurações do projeto.`,
    );
  }
  return value;
}

/** true quando HOTMART_SANDBOX=true está definido no ambiente */
export function isSandbox(): boolean {
  return process.env.HOTMART_SANDBOX?.trim().toLowerCase() === "true";
}

export function getHotmartConfig() {
  const sandbox = isSandbox();

  if (sandbox) {
    // Emite aviso visível nos logs para evitar uso acidental em produção
    console.warn(
      "[Hotmart] ⚠️  SANDBOX MODE ATIVO — todas as chamadas apontam para " +
        "https://sandbox.hotmart.com. Não use em produção.",
    );
  }

  return {
    clientId: requireEnv("HOTMART_CLIENTE_ID"),
    clientSecret: requireEnv("HOTMART_CLIENT_SECRET"),
    // Base64 de "client_id:client_secret" — usado no header Authorization do OAuth
    basicToken: requireEnv("HOTMART_BASIC"),

    // Hotmart OAuth token endpoint (mesmo para sandbox)
    tokenUrl: "https://api-sec-vlc.hotmart.com/security/oauth/token",

    // Base URL da Hotmart REST API
    // Sandbox: https://sandbox.hotmart.com
    // Produção: https://developers.hotmart.com
    apiBaseUrl: sandbox
      ? "https://sandbox.hotmart.com"
      : "https://developers.hotmart.com",

    // Quanto antes do vencimento do token renovar (em ms). Padrão: 60s.
    tokenRefreshBuffer: 60_000,

    sandbox,
  } as const;
}

export type HotmartConfig = ReturnType<typeof getHotmartConfig>;
