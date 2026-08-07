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
  /**
   * Se true, NÃO re-tenta quando a EchoTik retorna risk control (code=500).
   * Usado em chamadas de alta frequência (ex: download-url) para Fast-Fail.
   */
  fastFailRiskControl?: boolean;
}

export interface EchotikError extends Error {
  status?: number;
  body?: string;
}

/** Envelope padrão de respostas da API EchoTik (code/msg/data) */
export interface EchotikApiEnvelope {
  code: number;
  msg?: string;
  message?: string;
  data?: unknown;
}

// ─── Tipos — Hashtag Video List (Passo 1) ────────────────────────────

export interface EchotikHashtagVideoItem {
  aweme_id: string;
  desc?: string;
  author?: {
    nickname?: string;
    unique_id?: string;
  };
  video?: {
    cover?: { url_list?: string[] };
    play_addr?: { url_list?: string[] };
  };
  /** Métricas de engajamento do vídeo (play_count = visualizações) */
  statistics?: {
    play_count?: number;
    digg_count?: number;
    comment_count?: number;
    share_count?: number;
  };
}

export interface EchotikHashtagVideoResponse extends EchotikApiEnvelope {
  data?: {
    aweme_list?: EchotikHashtagVideoItem[];
    cursor?: number;
    has_more?: number;
  };
}

// ─── Tipos — Video Captions (Passo 2) ────────────────────────────────

export interface EchotikCaptionItem {
  lang: string;
  /** Texto inline da legenda (WebVTT) */
  data?: string;
  /** URL alternativa para download do arquivo de legenda */
  url?: string;
  format?: string;
  expire?: number;
}

export interface EchotikCaptionResponse extends EchotikApiEnvelope {
  data?: EchotikCaptionItem[];
}

import { createLogger } from "../logger";

const log = createLogger("echotik/client");

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

/**
 * Backoff exponencial com jitter (fator aleatório) para evitar bater na API
 * em intervalos exatos e previsíveis (risk control da EchoTik).
 *
 * Base: 3s, 6s, 12s, 24s... com fator aleatório 0.6x–1.5x.
 * Exemplo real: ~3s, ~7s, ~15s, ~30s...
 */
function getBackoffDelay(attempt: number): number {
  const base = Math.min(3000 * 2 ** (attempt - 1), 30000);
  const jitterFactor = 0.6 + Math.random() * 0.9; // 0.6x–1.5x aleatório
  return Math.round(base * jitterFactor);
}

// ---------------------------------------------------------------------------
// Risk control (code=500 no corpo)
// ---------------------------------------------------------------------------

/**
 * Detecta se a resposta parseada é um envelope EchoTik com `code=500`
 * (risk control). Nesses casos a documentação instrui a re-tentar.
 * HTTP status costuma ser 200, mas o `code` no corpo é 500.
 */
function isRetryableRiskControlCode(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;

  const envelope = data as Partial<EchotikApiEnvelope>;
  return typeof envelope.code === "number" && envelope.code === 500;
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

        // Status 5xx (incluindo "Usage Limit Exceeded") → vale retry.
        // A documentação da EchoTik diz que erros 500 NÃO consomem cota
        // e devem ser re-tentados (risk control).
        err.message = `[echotik-client] ${res.status} ${res.statusText} — ${url.pathname}`;
        lastError = err;
      } else {
        const data: T = await res.json();

        // Risk control: a documentação da EchoTik diz que endpoints realtime
        // podem retornar HTTP 200 com `code=500` no corpo (risk control).
        // Esses erros NÃO consomem cota e devem ser re-tentados.
        // Porém, se fastFailRiskControl estiver ativo, lança imediatamente.
        if (isRetryableRiskControlCode(data)) {
          if (opts.fastFailRiskControl) {
            throw new Error(
              `[echotik-client] Risk control code=500 — ${url.pathname} (fast-fail)`,
            );
          }
          lastError = new Error(
            `[echotik-client] Risk control code=500 — ${url.pathname}`,
          );
        } else {
          return data;
        }
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

    // Back-off exponencial com jitter antes de retry
    if (attempt < retries) {
      const delay = getBackoffDelay(attempt);
      log.warn("Retry failed, retrying", { attempt, retries, delayMs: delay });
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("[echotik-client] Falha após retries");
}

// ---------------------------------------------------------------------------
// Funções de alto nível (Passo 1 e Passo 2 do pipeline Achadinhos)
// ---------------------------------------------------------------------------

/**
 * Passo 1 — Busca a lista de vídeos de uma hashtag.
 *
 * Endpoint: GET /api/v3/realtime/hashtag/video/list
 *
 * ATENÇÃO (Echotik Risk Control):
 * - O count máximo seguro por chamada é 20. Para pedir mais, use `offset`
 *   para paginar com um pequeno delay entre as chamadas (ex: ~2s).
 * - O parâmetro de ordenação (`sortType`) fica PREPARADO para uso futuro,
 *   mas NÃO é enviado na URL por enquanto — evita erro 400 (Bad Request)
 *   já que não temos a documentação exata do formato (string vs integer).
 *   Por padrão, o endpoint já retorna vídeos populares/relevantes.
 *
 * @param params.hashtagId — ID numérico da hashtag (ex: "37644733")
 * @param params.region    — região (ex: "BR" para evitar vídeos EN/ES)
 * @param params.count     — quantidade de vídeos por chamada (default 20, máx recomendado 20)
 * @param params.offset    — paginação (default 0)
 * @param params.sortType  — RESERVADO para uso futuro. Não enviado na URL.
 * @returns Resposta tipada com `data.aweme_list`
 */
export async function fetchVideosByHashtag(params: {
  hashtagId: string;
  region?: string;
  count?: number;
  offset?: number;
  /** RESERVADO para uso futuro — não é enviado na URL atualmente */
  sortType?: string | number;
}): Promise<EchotikHashtagVideoResponse> {
  const { hashtagId, region = "BR", count = 20, offset = 0 } = params;

  // NOTA: `sortType` está preparado na assinatura para uso futuro,
  // mas deliberadamente NÃO é incluído na query-string para evitar
  // erro 400 (Bad Request) enquanto não confirmamos o formato exato
  // aceito pela API da EchoTik. Quando documentado, basta adicionar:
  //   ...(sortType !== undefined && { sort_type: String(sortType) }),

  return echotikRequest<EchotikHashtagVideoResponse>(
    "/api/v3/realtime/hashtag/video/list",
    {
      params: { hashtag_id: hashtagId, region, count, offset },
      retries: 5,
      timeout: 20_000,
    },
  );
}

/**
 * Passo 2 — Extrai as legendas/captions de um vídeo.
 *
 * Endpoint: GET /api/v3/realtime/video/captions
 *
 * O texto da legenda (WebVTT) fica em `data[0].data`.
 *
 * @param videoId — ID do vídeo (aweme_id) obtido no Passo 1
 * @returns Resposta tipada com `data[]` de legendas
 */
export async function fetchVideoCaptions(
  videoId: string,
  opts: { retries?: number; timeout?: number } = {},
): Promise<EchotikCaptionResponse> {
  const { retries = 5, timeout = 20_000 } = opts;

  return echotikRequest<EchotikCaptionResponse>(
    "/api/v3/realtime/video/captions",
    {
      params: { video_id: videoId },
      retries,
      timeout,
    },
  );
}
// ─── Busca de hashtags (resolução nome → ID) ──────────────────────────────

/** Uma hashtag retornada pela busca, já normalizada. */
export interface EchotikHashtagResult {
  /** ID numérico da hashtag no EchoTik (challenge_info.cid) */
  id: string;
  /** Nome sem o "#" (challenge_info.cha_name) */
  name: string;
  /** Quantidade de vídeos publicados com a hashtag */
  videoCount: number;
  /** Total de visualizações acumuladas */
  viewCount: number;
}

interface EchotikHashtagSearchResponse extends EchotikApiEnvelope {
  data?: {
    challenge_list?: Array<{
      challenge_info?: {
        cid?: string;
        cha_name?: string;
        use_count?: number;
        view_count?: number;
      };
    }>;
  };
}

/**
 * Busca hashtags por palavra-chave e devolve as entidades reais do EchoTik.
 *
 * Endpoint: GET /api/v3/realtime/hashtag/search
 * Documentação: https://opendocs.echotik.live/realtime/hashtag/search.md
 *
 * Serve para resolver um termo digitado ("achadinhosshopee") no ID numérico
 * que o endpoint de vídeos da hashtag exige — e para oferecer ao admin uma
 * lista de hashtags REAIS em vez de um campo numérico livre onde dá para
 * digitar um ID inexistente.
 *
 * Ordena por quantidade de vídeos (desc): a hashtag canônica é praticamente
 * sempre a de maior volume, e variações/erros de digitação ficam abaixo.
 */
export async function searchHashtags(params: {
  keyword: string;
  region?: string;
  count?: number;
}): Promise<EchotikHashtagResult[]> {
  const { keyword, region = "BR", count = 20 } = params;

  const response = await echotikRequest<EchotikHashtagSearchResponse>(
    "/api/v3/realtime/hashtag/search",
    {
      params: { keyword, region, count },
      // code=500 é risk control e NÃO consome cota — vale insistir
      retries: 4,
      timeout: 15_000,
    },
  );

  return (response?.data?.challenge_list ?? [])
    .map((entry) => entry.challenge_info)
    .filter((info): info is NonNullable<typeof info> => !!info?.cid && !!info?.cha_name)
    .map((info) => ({
      id: String(info.cid),
      name: String(info.cha_name),
      videoCount: Number(info.use_count ?? 0),
      viewCount: Number(info.view_count ?? 0),
    }))
    .sort((a, b) => b.videoCount - a.videoCount);
}
