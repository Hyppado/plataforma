/**
 * lib/hotmart/client.ts
 * Cliente genérico para a Hotmart REST API.
 * Injeta Authorization: Bearer <token> automaticamente em todas as requisições.
 */

import { getHotmartConfig } from "./config";
import { getAccessToken } from "./oauth";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Número de retentativas em caso de 401 (token expirado). Padrão: 1. */
  retries?: number;
}

/**
 * Faz uma requisição autenticada para a Hotmart API.
 *
 * @param path  Caminho relativo à apiBaseUrl, ex: "/payments/api/v1/subscriptions"
 * @param opts  Opções opcionais: params (query string), body, method
 */
export async function hotmartRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const config = await getHotmartConfig();
  const { method = "GET", params, body, retries = 1 } = opts;

  // Monta query string se houver parâmetros
  let url = `${config.apiBaseUrl}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        qs.set(key, String(value));
      }
    }
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }

  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`, // token nunca logado
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Se 401, tenta renovar o token uma vez
  if (response.status === 401 && retries > 0) {
    const { clearTokenCache } = await import("./oauth");
    clearTokenCache();
    return hotmartRequest<T>(path, { ...opts, retries: retries - 1 });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "(sem body)");
    throw new Error(
      `[Hotmart API] ${method} ${path} → ${response.status}. Body: ${text}`,
    );
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}
