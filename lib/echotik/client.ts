/**
 * EchoTik API Client
 *
 * Cliente genérico para a API EchoTik com Basic Auth, timeout e retry.
 *
 * Env vars necessárias:
 *   ECHOTIK_BASE_URL   — ex: "https://open.echotik.live"
 *   ECHOTIK_USERNAME   — fornecido pela EchoTik
 *   ECHOTIK_PASSWORD   — fornecido pela EchoTik
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface EchotikRequestOptions {
  /** Query-string params (serão codificados automaticamente) */
  params?: Record<string, string | number | boolean | undefined>;
  /** Timeout em ms (default 15 000) */
  timeout?: number;
  /** Número máx de tentativas (default 3) */
  retries?: number;
}

export interface EchotikError extends Error {
  status?: number;
  body?: string;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  const url = process.env.ECHOTIK_BASE_URL;
  if (!url) throw new Error("[echotik-client] ECHOTIK_BASE_URL não definida");
  return url.replace(/\/+$/, ""); // remove trailing slash
}

/**
 * Gera o header Authorization: Basic <base64(username:password)>
 * Usa ECHOTIK_USERNAME + ECHOTIK_PASSWORD do .env
 */
function getBasicAuth(): string {
  const username = process.env.ECHOTIK_USERNAME;
  const password = process.env.ECHOTIK_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "[echotik-client] ECHOTIK_USERNAME e ECHOTIK_PASSWORD são obrigatórios",
    );
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/** Espera `ms` milissegundos (para back-off entre retries) */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Função pública
// ---------------------------------------------------------------------------

/**
 * Faz uma requisição GET à API EchoTik.
 *
 * @param path  — caminho relativo, ex: "/api/v1/categories"
 * @param opts  — params, timeout, retries
 * @returns     — corpo parsado como JSON do tipo T
 *
 * @example
 * const data = await echotikRequest<CategoriesApiResponse>("/api/v1/categories", {
 *   params: { language: "en" },
 * });
 */
export async function echotikRequest<T = unknown>(
  path: string,
  opts: EchotikRequestOptions = {},
): Promise<T> {
  const { params, timeout = 15_000, retries = 3 } = opts;

  const base = getBaseUrl();
  const url = new URL(path, base);

  // Adicionar query-string params
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
      }
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: getBasicAuth(),
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(
          `[echotik-client] ${res.status} ${res.statusText} — ${url.pathname}`,
        ) as EchotikError;
        err.status = res.status;
        err.body = body;

        // 4xx → não vale retry (exceto 429)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw err;
        }

        // Quota exceeded → não vale retry (API retorna 500 com esta mensagem)
        if (body.includes("Usage Limit Exceeded")) {
          err.message = `[echotik-client] Quota excedida — ${url.pathname}`;
          throw err;
        }

        lastError = err;
      } else {
        const data: T = await res.json();
        return data;
      }
    } catch (error) {
      clearTimeout(timer);

      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new Error(
          `[echotik-client] Timeout (${timeout}ms) — ${url.pathname}`,
        );
      } else if ((error as EchotikError).status) {
        // Erros 4xx já tratados acima
        throw error;
      } else {
        lastError = error as Error;
      }
    }

    // Back-off exponencial antes de retry
    if (attempt < retries) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
      console.warn(
        `[echotik-client] Tentativa ${attempt}/${retries} falhou, retry em ${delay}ms…`,
      );
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("[echotik-client] Falha após retries");
}
