/**
 * lib/hotmart/oauth.ts
 * Obtém e cacheia (em memória) o access_token via OAuth client_credentials.
 * O token é renovado automaticamente HOTMART_REFRESH_BUFFER ms antes de expirar.
 */

import { getHotmartConfig } from "./config";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// Cache em memória (por instância de servidor — suficiente para Vercel serverless com warm function)
let cache: TokenCache | null = null;

/**
 * Retorna um access_token válido. Se o cache estiver expirado ou ausente, busca um novo.
 * Nunca loga o token ou segredos.
 */
export async function getAccessToken(): Promise<string> {
  const config = await getHotmartConfig();
  const now = Date.now();

  // Cache hit: token ainda válido com margem de segurança
  if (cache && cache.expiresAt - now > config.tokenRefreshBuffer) {
    return cache.accessToken;
  }

  // Cache miss ou prestes a expirar → busca novo token
  // Hotmart exige client_id e client_secret como query params (além do Basic)
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(`${config.tokenUrl}?${params.toString()}`, {
    method: "POST",
    headers: {
      // NUNCA logar este header
      Authorization: `Basic ${config.basicToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(sem body)");
    throw new Error(
      `[Hotmart OAuth] Falha ao obter token. Status: ${response.status}. Body: ${text}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number; // segundos
    token_type: string;
  };

  if (!data.access_token) {
    throw new Error("[Hotmart OAuth] Resposta sem access_token.");
  }

  // Armazena no cache com TTL calculado em epoch ms
  cache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cache.accessToken;
}

/** Invalida o cache (útil para testes ou refresh forçado). */
export function clearTokenCache(): void {
  cache = null;
}
